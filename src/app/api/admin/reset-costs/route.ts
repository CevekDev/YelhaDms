import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { period } = await req.json() as { period: 'today' | 'week' | 'month' | 'all' };

  const now = new Date();
  let since: Date | null = null;

  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const where = since ? { createdAt: { gte: since } } : {};
  const { count } = await prisma.costLog.deleteMany({ where });

  return NextResponse.json({ success: true, deleted: count });
}
