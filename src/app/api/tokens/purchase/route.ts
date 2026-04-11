import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createChargilyCheckout } from '@/lib/chargily';
import { apiRatelimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Rate limit — skip if Redis is unavailable
    try {
      const ip = req.headers.get('x-forwarded-for') ?? session.user.id;
      const { success } = await apiRatelimit.limit(ip);
      if (!success) return NextResponse.json({ error: 'Trop de requêtes, réessayez dans une minute.' }, { status: 429 });
    } catch (rlErr) {
      console.warn('[purchase] Rate limit check failed (skipping):', rlErr);
    }

    const body = await req.json();
    const { packageId, locale = 'fr' } = body;

    if (!packageId) {
      return NextResponse.json({ error: 'Package ID manquant' }, { status: 400 });
    }

    const pkg = await prisma.tokenPackage.findUnique({
      where: { id: packageId, isActive: true },
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Forfait introuvable ou inactif' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });
    if (!user?.email) {
      return NextResponse.json({ error: 'Email utilisateur manquant' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yelha-production.up.railway.app';

    const checkout = await createChargilyCheckout({
      amount: pkg.price,
      currency: 'DZD',
      customerEmail: user.email,
      customerName: user.name || undefined,
      successUrl: `${appUrl}/${locale}/dashboard/tokens?success=true`,
      failureUrl: `${appUrl}/${locale}/dashboard/tokens?canceled=true`,
      description: `YelhaDms — ${pkg.name} (${pkg.tokens} tokens)`,
      metadata: {
        userId: session.user.id,
        packageId: pkg.id,
        tokens: pkg.tokens.toString(),
      },
      locale: locale as 'fr' | 'ar' | 'en',
    });

    return NextResponse.json({ url: checkout.checkout_url });
  } catch (err: any) {
    console.error('[purchase] Error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
