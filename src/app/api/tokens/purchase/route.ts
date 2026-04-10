import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createChargilyCheckout } from '@/lib/chargily';
import { apiRatelimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? session.user.id;
  const { success } = await apiRatelimit.limit(ip);
  if (!success) return NextResponse.json({ error: 'Trop de requêtes, réessayez.' }, { status: 429 });

  const body = await req.json();
  const { packageId, locale = 'fr' } = body;

  if (!packageId) return NextResponse.json({ error: 'Package ID manquant' }, { status: 400 });

  const pkg = await prisma.tokenPackage.findUnique({ where: { id: packageId, isActive: true } });
  if (!pkg) return NextResponse.json({ error: 'Package introuvable' }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });
  if (!user?.email) return NextResponse.json({ error: 'Email utilisateur manquant' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yelha-production.up.railway.app';

  try {
    const checkout = await createChargilyCheckout({
      amount: pkg.price,
      currency: 'DZD',
      customerEmail: user.email,
      customerName: user.name || undefined,
      successUrl: `${appUrl}/${locale}/dashboard/tokens?success=true`,
      failureUrl: `${appUrl}/${locale}/dashboard/tokens?canceled=true`,
      description: `Yelha — ${pkg.name} (${pkg.tokens} tokens)`,
      metadata: {
        userId: session.user.id,
        packageId: pkg.id,
        tokens: pkg.tokens.toString(),
      },
      locale: locale as 'fr' | 'ar' | 'en',
    });

    return NextResponse.json({ url: checkout.checkout_url });
  } catch (err: any) {
    console.error('[purchase] Chargily error:', err.message);
    return NextResponse.json(
      { error: 'Erreur de paiement: ' + err.message },
      { status: 500 }
    );
  }
}
