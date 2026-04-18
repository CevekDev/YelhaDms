import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];

const STATUS_NOTIF: Record<string, string> = {
  CONFIRMED:  '✅ Votre commande #{id} a été *confirmée* ! Nous la préparons. 🎉',
  PROCESSING: '🔄 Votre commande #{id} est *en cours de traitement*.',
  SHIPPED:    '🚚 Votre commande #{id} a été *expédiée* !{tracking} Vous la recevrez bientôt.',
  DELIVERED:  '📦 Votre commande #{id} a été *livrée* ! Merci pour votre confiance. 🙏',
  CANCELLED:  '❌ Votre commande #{id} a été *annulée*. Contactez-nous pour plus d\'infos.',
  RETURNED:   '↩️ Votre commande #{id} a été *retournée*.',
};

async function sendTelegramNotification(orderId: string, newStatus: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        contactId: true,
        ecotrackTracking: true,
        trackingCode: true,
        connection: { select: { telegramBotToken: true, platform: true } },
      },
    });
    if (!order?.contactId || order.connection.platform !== 'TELEGRAM' || !order.connection.telegramBotToken) return;
    const template = STATUS_NOTIF[newStatus];
    if (!template) return;
    const shortId = orderId.slice(-6).toUpperCase();
    const tracking = order.ecotrackTracking || order.trackingCode;
    const msg = template
      .replace('{id}', shortId)
      .replace('{tracking}', tracking ? `\n📦 Tracking : *${tracking}*` : '');
    const token = decrypt(order.connection.telegramBotToken);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: order.contactId, text: msg, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('[Notification] Error', e);
  }
}

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.order.findFirst({
    where: { id: params.id, connection: { userId: session.user.id } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await tryDeleteFromEcotrack(params.id);
  await prisma.order.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { status, scheduledConfirmAt } = body;

  // Support updating scheduledConfirmAt only
  if (scheduledConfirmAt !== undefined && !status) {
    const order = await prisma.order.findFirst({
      where: { id: params.id, connection: { userId: session.user.id } },
    });
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.order.update({
      where: { id: params.id },
      data: { scheduledConfirmAt: scheduledConfirmAt ? new Date(scheduledConfirmAt) : null },
    });
    return NextResponse.json(updated);
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: params.id, connection: { userId: session.user.id } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
    await tryDeleteFromEcotrack(params.id);
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status },
  });

  // Send customer notification if status changed
  if (order.status !== status) {
    sendTelegramNotification(params.id, status); // fire & forget
  }

  return NextResponse.json(updated);
}
