import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Load order with connection info
  const order = await prisma.order.findFirst({
    where: {
      id: params.id,
      connection: { userId: session.user.id },
    },
    include: {
      connection: true,
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const connection = order.connection;

  if (connection.platform === 'TELEGRAM') {
    if (!connection.telegramBotToken || !order.contactId) {
      return NextResponse.json({ error: 'Missing bot token or contact ID' }, { status: 400 });
    }

    const token = decrypt(connection.telegramBotToken);

    const confirmMsg =
      `✅ <b>Confirmation de votre commande #${order.id.slice(-6).toUpperCase()}</b>\n\n` +
      (order.contactName ? `👤 Nom : ${order.contactName}\n` : '') +
      (order.contactPhone ? `📞 Téléphone : ${order.contactPhone}\n` : '') +
      (order.notes ? `📍 Adresse : ${order.notes}\n` : '') +
      `\n` +
      (order.totalAmount ? `💰 Total : <b>${order.totalAmount.toLocaleString('fr-DZ')} DA</b>\n\n` : '') +
      `Veuillez confirmer que ces informations sont correctes en répondant <b>OUI</b> ou signalez une correction.`;

    await sendTelegramMessage(token, order.contactId, confirmMsg);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Platform not supported' }, { status: 400 });
}
