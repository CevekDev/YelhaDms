import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cron job: delete inactive conversations (no message for 5+ days)
 * and orders older than 2 months.
 * Vercel crons use GET and pass Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Delete conversations with no message for 5 days
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const { count: convDeleted } = await prisma.conversation.deleteMany({
    where: {
      lastMessage: { lt: fiveDaysAgo },
    },
  });

  // Delete orders older than 2 months
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const { count: ordersDeleted } = await prisma.order.deleteMany({
    where: {
      createdAt: { lt: twoMonthsAgo },
    },
  });

  return NextResponse.json({
    ok: true,
    conversationsDeleted: convDeleted,
    ordersDeleted: ordersDeleted,
  });
}
