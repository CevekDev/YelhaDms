import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PACK_DEFINITIONS = {
  STARTER:  { tokens: 500,   price: 2500  },
  BUSINESS: { tokens: 2000,  price: 5000  },
  PRO:      { tokens: 5000,  price: 10000 },
  AGENCY:   { tokens: 15000, price: 22000 },
} as const;

const schema = z.object({
  userId: z.string(),
  pack: z.enum(['STARTER', 'BUSINESS', 'PRO', 'AGENCY']),
  mode: z.enum(['offer', 'activate']),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userId, pack, mode } = parsed.data;
  const packDef = PACK_DEFINITIONS[pack];

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const newBalance = user.tokenBalance + packDef.tokens;

  const isOffer = mode === 'offer';
  const transactionType = isOffer ? 'ADMIN_GRANT' : 'PACK_GRANT';
  const pricePaid = isOffer ? 0 : packDef.price;
  const description = isOffer
    ? `🎁 Pack ${pack} offert par l'admin`
    : `✅ Pack ${pack} activé — achat confirmé`;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        tokenBalance: newBalance,
        planLevel: pack,
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        userId,
        type: transactionType,
        amount: packDef.tokens,
        balance: newBalance,
        description,
        pricePaid,
      },
    }),
  ]);

  return NextResponse.json({ success: true, newBalance, tokens: packDef.tokens, planLevel: pack });
}
