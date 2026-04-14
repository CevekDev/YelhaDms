import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, image: true, role: true,
      tokenBalance: true, unlimitedTokens: true, twoFactorEnabled: true, createdAt: true,
    },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }

  // Note: twoFactorEnabled must be toggled via a dedicated 2FA management endpoint, not here

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée valide à mettre à jour' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, image: true, twoFactorEnabled: true, unlimitedTokens: true },
  });
  return NextResponse.json(user);
}
