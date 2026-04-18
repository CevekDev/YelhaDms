import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];

async function tryDeleteFromEcotrack(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { ecotrackTracking: true, connectionId: true },
    });
    if (!order?.ecotrackTracking) return;
    const conn = await prisma.connection.findUnique({
      where: { id: order.connectionId },
      select: { ecotrackUrl: true, ecotrackToken: true },
    });
    if (!conn?.ecotrackUrl || !conn?.ecotrackToken) return;
    const { deleteEcotrackOrder } = await import('@/lib/ecotrack');
    await deleteEcotrackOrder(conn.ecotrackUrl, decrypt(conn.ecotrackToken), order.ecotrackTracking);
  } catch (e) {
    console.error('[Ecotrack] Delete order error', e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.order.findFirst({
    where: { id: params.id, connection: { userId: session.user.id } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove from Ecotrack before deleting locally
  await tryDeleteFromEcotrack(params.id);

  await prisma.order.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: params.id, connection: { userId: session.user.id } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Cancel on Ecotrack when status → CANCELLED
  if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
    await tryDeleteFromEcotrack(params.id);
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json(updated);
}
