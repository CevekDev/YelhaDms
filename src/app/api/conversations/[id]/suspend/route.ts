import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conv = await prisma.conversation.findFirst({
    where: { id: params.id, connection: { userId: session.user.id } },
  });
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { isSuspended, needsHelp } = await req.json();
  const data: any = {};
  if (isSuspended !== undefined) {
    data.isSuspended = Boolean(isSuspended);
    // Reset spam state when reactivating a conversation
    if (!isSuspended) {
      data.spamScore = 0;
      data.needsHelp = false;
    }
  }
  if (needsHelp !== undefined) data.needsHelp = Boolean(needsHelp);

  const updated = await prisma.conversation.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}
