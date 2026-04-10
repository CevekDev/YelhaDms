import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET — list all promo codes
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { uses: true } } },
  });

  return NextResponse.json(codes);
}

// POST — create a promo code
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { code, tokens, discountPercent, maxUses, expiresAt, description } = body;

  if (!code || code.length < 3) {
    return NextResponse.json({ error: 'Code trop court (min 3 caractères)' }, { status: 400 });
  }

  const cleanCode = String(code).toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  try {
    const promo = await prisma.promoCode.create({
      data: {
        code: cleanCode,
        tokens: Number(tokens) || 0,
        discountPercent: discountPercent != null ? Number(discountPercent) : null,
        maxUses: Number(maxUses) || 1,
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return NextResponse.json(promo);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 400 });
    }
    console.error('[promo-codes POST]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — deactivate a promo code
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await req.json();
  await prisma.promoCode.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
