import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r' && text[i + 1] === '\n') {
        row.push(field); rows.push(row); row = []; field = ''; i++;
      } else if (c === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else { field += c; }
    }
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(f => f.trim() !== ''))
    .map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
      return obj;
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

type ImportedProduct = {
  externalId: string;
  name: string;
  brand: string | null;
  price: number;
  description: string | null;
  stock: number | null;
  sizes: string[];
  colors: string[];
  models: string[];
  source: 'woocommerce' | 'shopify';
};

// ── Shopify CSV ───────────────────────────────────────────────────────────────
// One product = multiple rows sharing the same Handle (variants)

function parseShopify(rows: Record<string, string>[]): ImportedProduct[] {
  type Entry = { row: Record<string, string>; sizes: Set<string>; colors: Set<string>; models: Set<string> };
  const map = new Map<string, Entry>();

  for (const row of rows) {
    const handle = row['Handle'];
    if (!handle) continue;

    if (!map.has(handle)) {
      map.set(handle, { row, sizes: new Set(), colors: new Set(), models: new Set() });
    }
    const entry = map.get(handle)!;

    for (let i = 1; i <= 3; i++) {
      const name = (row[`Option${i} Name`] || '').toLowerCase();
      const val = (row[`Option${i} Value`] || '').trim();
      if (!val || val === 'Default Title') continue;
      if (/taille|size/i.test(name)) entry.sizes.add(val);
      else if (/couleur|color/i.test(name)) entry.colors.add(val);
      else if (name) entry.models.add(val);
    }
  }

  const products: ImportedProduct[] = [];
  for (const [handle, { row, sizes, colors, models }] of Array.from(map.entries())) {
    const name = (row['Title'] || '').trim();
    if (!name) continue;
    const rawPrice = parseFloat(row['Variant Price'] || '0');
    const rawStock = parseInt(row['Variant Inventory Qty'] || '');
    const vendor = (row['Vendor'] || '').trim();
    const bodyHtml = row['Body (HTML)'] || '';

    products.push({
      externalId: `csv_shopify_${handle}`,
      name: name.substring(0, 200),
      brand: vendor && vendor !== name ? vendor.substring(0, 100) : null,
      price: isNaN(rawPrice) ? 0 : rawPrice,
      description: bodyHtml ? stripHtml(bodyHtml).substring(0, 800) : null,
      stock: isNaN(rawStock) ? null : rawStock,
      sizes: Array.from(sizes),
      colors: Array.from(colors),
      models: Array.from(models),
      source: 'shopify',
    });
  }
  return products;
}

// ── WooCommerce CSV ───────────────────────────────────────────────────────────

function parseWooCommerce(rows: Record<string, string>[]): ImportedProduct[] {
  const products: ImportedProduct[] = [];

  for (const row of rows) {
    const name = (row['Name'] || '').trim();
    if (!name) continue;

    // Skip variable parent rows (no price), keep simple + variation
    const type = (row['Type'] || '').toLowerCase();
    if (type === 'variable') continue;

    const rawPrice = parseFloat(row['Regular price'] || row['Sale price'] || '0');
    const rawStock = parseInt(row['Stock'] || '');
    const desc = (row['Short description'] || row['Description'] || '').trim();

    const sizes: string[] = [];
    const colors: string[] = [];
    const models: string[] = [];

    for (let i = 1; i <= 6; i++) {
      const attrName = (row[`Attribute ${i} name`] || '').toLowerCase();
      const attrVals = row[`Attribute ${i} value(s)`] || '';
      if (!attrName || !attrVals) continue;
      const vals = attrVals.split('|').map(v => v.trim()).filter(Boolean);
      if (/taille|size/i.test(attrName)) sizes.push(...vals);
      else if (/couleur|color/i.test(attrName)) colors.push(...vals);
      else if (vals.length) models.push(...vals);
    }

    const id = row['ID'] || '';
    const sku = row['SKU'] || '';
    const externalId = `csv_wc_${id || sku || slug(name)}`;

    products.push({
      externalId,
      name: name.substring(0, 200),
      brand: null,
      price: isNaN(rawPrice) ? 0 : rawPrice,
      description: desc ? stripHtml(desc).substring(0, 800) : null,
      stock: isNaN(rawStock) ? null : rawStock,
      sizes,
      colors,
      models,
      source: 'woocommerce',
    });
  }
  return products;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

  const platform = formData.get('platform') as string;
  const file = formData.get('file') as File | null;

  if (!platform || !['woocommerce', 'shopify'].includes(platform)) {
    return NextResponse.json({ error: 'Plateforme invalide' }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Fichier CSV requis' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
  }

  // Read and strip BOM
  let text = await file.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCSV(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Fichier CSV vide ou format invalide' }, { status: 400 });
  }

  const fetched = platform === 'shopify' ? parseShopify(rows) : parseWooCommerce(rows);

  if (fetched.length === 0) {
    return NextResponse.json({ error: 'Aucun produit trouvé dans ce fichier CSV' }, { status: 400 });
  }

  const valid = fetched.filter(p => p.name.length > 0);

  // Capacity check
  const currentCount = await prisma.product.count({ where: { userId: session.user.id } });
  const remaining = 500 - currentCount;
  if (remaining <= 0) {
    return NextResponse.json({ error: 'Limite de 500 produits atteinte' }, { status: 400 });
  }

  // Deduplication
  const existing = await prisma.product.findMany({
    where: { userId: session.user.id, externalId: { in: valid.map(p => p.externalId) } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map(p => p.externalId));

  const toInsert = valid.filter(p => !existingSet.has(p.externalId)).slice(0, remaining);
  const skipped = valid.length - toInsert.length;

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, total: fetched.length, skipped, message: 'Tous les produits sont déjà importés' });
  }

  await prisma.product.createMany({
    data: toInsert.map(p => ({
      userId: session.user.id,
      externalId: p.externalId,
      source: p.source,
      name: p.name,
      brand: p.brand,
      price: p.price,
      description: p.description,
      stock: p.stock,
      sizes: p.sizes,
      colors: p.colors,
      models: p.models,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ imported: toInsert.length, total: fetched.length, skipped });
}
