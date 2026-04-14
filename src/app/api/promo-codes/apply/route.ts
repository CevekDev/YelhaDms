import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(1).toUpperCase(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
  }

  const { code } = parsed.data;
  const userId = session.user.id;

  // TODO: discountPercent is not currently applied to purchases
  let tokensAdded = 0;
  let newBalance = 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({
        where: { code },
        include: { uses: { where: { userId } } },
      });

      if (!promo || !promo.isActive) {
        throw Object.assign(new Error('Code promo invalide ou désactivé'), { status: 404 });
      }

      if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw Object.assign(new Error('Ce code promo a expiré'), { status: 400 });
      }

      if (promo.usedCount >= promo.maxUses) {
        throw Object.assign(new Error("Ce code promo a atteint son nombre maximum d'utilisations"), { status: 400 });
      }

      if (promo.uses.length > 0) {
        throw Object.assign(new Error('Vous avez déjà utilisé ce code promo'), { status: 400 });
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });

      const balance = user.tokenBalance + promo.tokens;

      await tx.user.update({ where: { id: userId }, data: { tokenBalance: balance } });
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: 'PROMO',
          amount: promo.tokens,
          balance,
          description: `🎟️ Code promo ${code} — +${promo.tokens} tokens`,
        },
      });
      await tx.promoCodeUse.create({ data: { promoCodeId: promo.id, userId } });
      await tx.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });

      return { tokensAdded: promo.tokens, newBalance: balance };
    });

    return NextResponse.json({ success: true, tokensAdded: result.tokensAdded, newBalance: result.newBalance });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status });
  }
}
