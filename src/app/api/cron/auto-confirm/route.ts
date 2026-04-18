import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find orders due for auto-confirmation
  const dueOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      scheduledConfirmAt: { lte: now },
      confirmationSentAt: null, // don't re-send
      contactId: { not: null },
    },
    include: {
      connection: { select: { telegramBotToken: true, platform: true } },
    },
    take: 50,
  });

  let sent = 0;
  for (const order of dueOrders) {
    if (order.connection.platform !== 'TELEGRAM' || !order.connection.telegramBotToken || !order.contactId) continue;
    try {
      const token = decrypt(order.connection.telegramBotToken);
      const msg =
        `✅ <b>Confirmation de votre commande #${order.id.slice(-6).toUpperCase()}</b>\n\n` +
        (order.contactName ? `👤 Nom : ${order.contactName}\n` : '') +
        (order.contactPhone ? `📞 Téléphone : ${order.contactPhone}\n` : '') +
        (order.notes ? `📍 Adresse : ${order.notes}\n` : '') +
        ((order as any).ecotrackTracking ? `📦 Tracking : <b>${(order as any).ecotrackTracking}</b>\n` : '') +
        `\n` +
        (order.totalAmount ? `💰 Total : <b>${order.totalAmount.toLocaleString('fr-DZ')} DA</b>\n\n` : '') +
        `Veuillez confirmer que ces informations sont correctes en répondant <b>OUI</b> ou signalez une correction.`;

      await sendTelegramMessage(token, order.contactId, msg);
      await prisma.order.update({
        where: { id: order.id },
        data: { confirmationSentAt: now, scheduledConfirmAt: null },
      });
      sent++;
    } catch (e) {
      console.error(`[AutoConfirm] Error for order ${order.id}`, e);
    }
  }

  return NextResponse.json({ processed: dueOrders.length, sent });
}

// Also allow GET for simple ping
export async function GET() {
  return NextResponse.json({ ok: true });
}
