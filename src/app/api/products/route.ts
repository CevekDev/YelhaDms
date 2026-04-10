import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, brand, price, description, stock } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 });
  if (price == null || isNaN(Number(price))) return NextResponse.json({ error: 'Le prix est obligatoire' }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      brand: brand?.trim() || null,
      price: Number(price),
      description: description?.trim() || null,
      stock: stock != null && stock !== '' ? Number(stock) : null,
    },
  });

  return NextResponse.json(product, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, name, brand, price, description, stock, isActive } = body;

  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  // Verify ownership
  const existing = await prisma.product.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  const data: any = {};
  if (name !== undefined) data.name = name.trim();
  if (brand !== undefined) data.brand = brand?.trim() || null;
  if (price !== undefined) data.price = Number(price);
  if (description !== undefined) data.description = description?.trim() || null;
  if (stock !== undefined) data.stock = stock != null && stock !== '' ? Number(stock) : null;
  if (isActive !== undefined) data.isActive = isActive;

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  const existing = await prisma.product.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
