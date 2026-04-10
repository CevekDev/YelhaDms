import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChargilySignature } from '@/lib/chargily';
import { sendTokenPurchaseEmail } from '@/lib/resend';

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get('signature') ?? '';

  if (!verifyChargilySignature(rawBody, signature)) {
    console.error('[Chargily webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, data } = event;

  if (type === 'checkout.paid') {
    const checkout = data;
    const metadata = checkout.metadata as Record<string, string> | null;
    if (!metadata?.userId || !metadata?.tokens) {
      console.error('[Chargily webhook] Missing metadata in checkout', checkout.id);
      return NextResponse.json({ received: true });
    }

    const userId = metadata.userId;
    const tokenAmount = parseInt(metadata.tokens, 10);
    const packageId = metadata.packageId ?? '';
    const amountDZD = checkout.amount ?? 0;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { tokenBalance: { increment: tokenAmount } },
      });

      await tx.tokenTransaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          amount: tokenAmount,
          balance: user.tokenBalance,
          description: `Achat de ${tokenAmount} tokens via Chargily — ${amountDZD} DZD`,
          pricePaid: amountDZD,
          chargilyCheckoutId: checkout.id,
        },
      });
    });

    // Send confirmation email
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        await sendTokenPurchaseEmail(user.email, user.name ?? '', tokenAmount, amountDZD);
      }
    } catch (emailErr) {
      // Non-blocking — log but don't fail
      console.error('[Chargily webhook] Failed to send confirmation email', emailErr);
    }
  } else if (type === 'checkout.failed') {
    // Log failure — nothing else to do (no status column on TokenTransaction yet)
    const checkout = data;
    console.warn('[Chargily webhook] Checkout failed:', checkout.id);
  }

  return NextResponse.json({ received: true });
}
