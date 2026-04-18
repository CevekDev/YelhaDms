import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/$/, '');
  if (!u.startsWith('http')) u = 'https://' + u;
  return u;
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

// ── WooCommerce ───────────────────────────────────────────────────────────────

async function fetchWooCommerce(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<ImportedProduct[]> {
  const base = normalizeUrl(storeUrl);
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const results: ImportedProduct[] = [];
  let page = 1;

  while (results.length < 1000) {
    const res = await fetch(
      `${base}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`,
      {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (res.status === 401 || res.status === 403) {
      throw new Error('Clés API invalides ou accès refusé (vérifiez Consumer Key et Secret)');
    }
    if (res.status === 404) {
      throw new Error("URL introuvable — vérifiez que WooCommerce REST API est activé sur votre site");
    }
    if (!res.ok) {
      throw new Error(`Erreur WooCommerce ${res.status}`);
    }

    const data: any[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const p of data) {
      const attrs: any[] = p.attributes || [];
      const sizeAttr = attrs.find((a: any) => /taille|size/i.test(a.name));
      const colorAttr = attrs.find((a: any) => /couleur|color/i.test(a.name));

      const rawPrice = parseFloat(p.regular_price || p.sale_price || p.price || '0');
      const desc = p.short_description
        ? stripHtml(p.short_description)
        : p.description
        ? stripHtml(p.description).substring(0, 800)
        : null;

      results.push({
        externalId: `wc_${p.id}`,
        name: String(p.name || '').trim(),
        brand: null,
        price: isNaN(rawPrice) ? 0 : rawPrice,
        description: desc || null,
        stock: p.manage_stock ? (p.stock_quantity ?? null) : null,
        sizes: sizeAttr?.options?.filter(Boolean) ?? [],
        colors: colorAttr?.options?.filter(Boolean) ?? [],
        models: [],
        source: 'woocommerce',
      });
    }

    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
    if (page >= totalPages || page >= 10) break;
    page++;
  }

  return results;
}

// ── Shopify ───────────────────────────────────────────────────────────────────

async function fetchShopify(
  shop: string,
  accessToken: string
): Promise<ImportedProduct[]> {
  const domain = shop
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const results: ImportedProduct[] = [];
  let pageInfo: string | null = null;

  while (results.length < 1000) {
    const params = new URLSearchParams({ limit: '250', status: 'active' });
    if (pageInfo) params.set('page_info', pageInfo);

    const res = await fetch(
      `https://${domain}/admin/api/2024-01/products.json?${params}`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (res.status === 401 || res.status === 403) {
      throw new Error('Token API Shopify invalide ou accès refusé');
    }
    if (res.status === 404) {
      throw new Error("Boutique Shopify introuvable — vérifiez l'URL (ex: maboutique.myshopify.com)");
    }
    if (!res.ok) {
      throw new Error(`Erreur Shopify ${res.status}`);
    }

    const data = await res.json();
    const batch: any[] = data.products || [];
    if (batch.length === 0) break;

    for (const p of batch) {
      const variant = p.variants?.[0] ?? {};
      const options: any[] = p.options ?? [];

      const sizeOpt = options.find((o: any) => /taille|size/i.test(o.name));
      const colorOpt = options.find((o: any) => /couleur|color/i.test(o.name));

      const sizes = (sizeOpt?.values ?? []).filter((v: string) => v !== 'Default Title');
      const colors = (colorOpt?.values ?? []).filter((v: string) => v !== 'Default Title');

      const rawPrice = parseFloat(variant.price || '0');
      const desc = p.body_html ? stripHtml(p.body_html).substring(0, 800) : null;

      results.push({
        externalId: `shopify_${p.id}`,
        name: String(p.title || '').trim(),
        brand: p.vendor && p.vendor !== domain ? p.vendor.trim() : null,
        price: isNaN(rawPrice) ? 0 : rawPrice,
        description: desc || null,
        stock: variant.inventory_quantity ?? null,
        sizes,
        colors,
        models: [],
        source: 'shopify',
      });
    }

    // Shopify cursor pagination
    const link = res.headers.get('Link') || '';
    const nextMatch = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    if (!nextMatch) break;
    pageInfo = nextMatch[1];
  }

  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });

  const { platform, url, key, secret } = body as {
    platform: string;
    url: string;
    key: string;
    secret?: string;
  };

  if (!platform || !url?.trim() || !key?.trim()) {
    return NextResponse.json({ error: 'URL et clé API requis' }, { status: 400 });
  }
  if (!['woocommerce', 'shopify'].includes(platform)) {
    return NextResponse.json({ error: 'Plateforme invalide' }, { status: 400 });
  }
  if (platform === 'woocommerce' && !secret?.trim()) {
    return NextResponse.json({ error: 'Consumer Secret requis pour WooCommerce' }, { status: 400 });
  }

  // Check capacity
  const currentCount = await prisma.product.count({ where: { userId: session.user.id } });
  const remaining = 500 - currentCount;
  if (remaining <= 0) {
    return NextResponse.json({ error: 'Limite de 500 produits atteinte' }, { status: 400 });
  }

  // Fetch from external platform
  let fetched: ImportedProduct[];
  try {
    if (platform === 'woocommerce') {
      fetched = await fetchWooCommerce(url, key, secret!);
    } else {
      fetched = await fetchShopify(url, key);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur de connexion' }, { status: 400 });
  }

  if (fetched.length === 0) {
    return NextResponse.json({ error: 'Aucun produit trouvé dans cette boutique' }, { status: 400 });
  }

  // Filter valid products
  const valid = fetched.filter(p => p.name && p.name.length > 0);

  // Skip already-imported external IDs (prevents duplicates on re-import)
  const existingExternalIds = await prisma.product.findMany({
    where: { userId: session.user.id, externalId: { in: valid.map(p => p.externalId) } },
    select: { externalId: true },
  });
  const existingIdSet = new Set(existingExternalIds.map(p => p.externalId));

  const toInsert = valid
    .filter(p => !existingIdSet.has(p.externalId))
    .slice(0, remaining);

  const skipped = valid.length - toInsert.length;

  if (toInsert.length === 0) {
    return NextResponse.json({
      imported: 0,
      total: fetched.length,
      skipped,
      message: 'Tous les produits sont déjà importés',
    });
  }

  await prisma.product.createMany({
    data: toInsert.map(p => ({
      userId: session.user.id,
      externalId: p.externalId,
      source: p.source,
      name: p.name.substring(0, 200),
      brand: p.brand?.substring(0, 100) ?? null,
      price: p.price,
      description: p.description?.substring(0, 1000) ?? null,
      stock: p.stock,
      sizes: p.sizes,
      colors: p.colors,
      models: p.models,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    imported: toInsert.length,
    total: fetched.length,
    skipped,
  });
}
