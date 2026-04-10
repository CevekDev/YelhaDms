import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.twoFactorCode || !user.twoFactorCodeExpiry) {
      return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 });
    }

    if (new Date() > user.twoFactorCodeExpiry) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorCode: null, twoFactorCodeExpiry: null },
      });
      return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.' }, { status: 400 });
    }

    if (user.twoFactorCode !== code.trim()) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: null, twoFactorCodeExpiry: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[2fa/verify]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
