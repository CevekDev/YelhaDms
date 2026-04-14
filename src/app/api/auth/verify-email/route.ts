import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { code, email } = await req.json();

  if (!code || !email) {
    return NextResponse.json({ error: 'Code et email requis' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  // Always verify the code — never issue a token without proof of code ownership
  const verificationToken = await prisma.userVerificationToken.findFirst({
    where: {
      userId: user.id,
      token: code,
      used: false,
      expires: { gt: new Date() },
    },
  });

  if (!verificationToken) {
    return NextResponse.json({ error: 'Code invalide ou expiré.' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: user.emailVerified ?? new Date() },
    }),
    prisma.userVerificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    }),
  ]);

  // Generate a short-lived auto-login token (5 minutes)
  const autoLoginToken = `al_${uuidv4()}`;
  await prisma.userVerificationToken.create({
    data: {
      userId: user.id,
      token: autoLoginToken,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json({ success: true, autoLoginToken, email: user.email });
}
