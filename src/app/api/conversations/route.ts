import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/conversations?connectionId=xxx
 * Returns the list of conversations for a connection (for live polling).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get('connectionId');
  if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 });

  // Verify connection belongs to user
  const connection = await prisma.connection.findFirst({
    where: { id: connectionId, userId: session.user.id },
    select: { id: true },
  });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const conversations = await prisma.conversation.findMany({
    where: { connectionId },
    orderBy: { lastMessage: 'desc' },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return NextResponse.json(conversations);
}
