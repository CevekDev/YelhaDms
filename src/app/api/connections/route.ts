import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { apiRatelimit, getRateLimitKey } from '@/lib/ratelimit';
import { z } from 'zod';

const connectionSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('WHATSAPP'),
    name: z.string().min(1).max(100),
    botName: z.string().min(1).max(50).default('Assistant'),
    businessName: z.string().max(100).optional(),
    twilioWhatsAppNumber: z.string().min(5).max(20),
  }),
  z.object({
    platform: z.literal('TELEGRAM'),
    name: z.string().min(1).max(100),
    botName: z.string().min(1).max(50).default('Assistant'),
    businessName: z.string().max(100).optional(),
    telegramBotToken: z.string().min(20),
  }),
]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connections = await prisma.connection.findMany({
    where: { userId: session.user.id },
    include: { predefinedMessages: { orderBy: { priority: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  // Strip sensitive fields before returning
  const safe = connections.map(({ telegramBotToken, ...c }) => c);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { success } = await apiRatelimit.limit(getRateLimitKey(req, session.user.id));
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await req.json();
  const parsed = connectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // Enforce per-platform bot limits based on plan
  const BOT_LIMITS: Record<string, number> = {
    FREE: 1, STARTER: 1, BUSINESS: 3, PRO: 5, AGENCY: Infinity,
  };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planLevel: true },
  });
  const limit = BOT_LIMITS[user?.planLevel ?? 'FREE'] ?? 1;
  const existingCount = await prisma.connection.count({
    where: { userId: session.user.id, platform: data.platform },
  });
  if (existingCount >= limit) {
    return NextResponse.json(
      { error: `Limite de ${limit} bot(s) ${data.platform} atteinte pour votre plan.` },
      { status: 403 }
    );
  }

  if (data.platform === 'TELEGRAM') {
    // Validate bot token against Telegram API
    const validateRes = await fetch(`https://api.telegram.org/bot${data.telegramBotToken}/getMe`);
    if (!validateRes.ok) {
      return NextResponse.json({ error: 'Token Telegram invalide' }, { status: 400 });
    }
    const botInfo = await validateRes.json();
    if (!botInfo.ok) {
      return NextResponse.json({ error: 'Token Telegram invalide' }, { status: 400 });
    }

    const encryptedToken = encrypt(data.telegramBotToken);
    const connection = await prisma.connection.create({
      data: {
        userId: session.user.id,
        platform: 'TELEGRAM',
        name: data.name,
        businessName: data.businessName,
        botName: data.botName,
        telegramBotToken: encryptedToken,
        telegramBotUsername: botInfo.result.username,
      },
    });

    // Register Telegram webhook
    const webhookRes = await fetch(`https://api.telegram.org/bot${data.telegramBotToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telegram/${connection.id}`,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    if (webhookRes.ok) {
      await prisma.connection.update({ where: { id: connection.id }, data: { telegramWebhookSet: true } });
    }

    return NextResponse.json({ id: connection.id, platform: connection.platform, name: connection.name });
  }

  // WHATSAPP (Twilio)
  const connection = await prisma.connection.create({
    data: {
      userId: session.user.id,
      platform: 'WHATSAPP',
      name: data.name,
      businessName: data.businessName,
      botName: data.botName,
      twilioWhatsAppNumber: data.twilioWhatsAppNumber,
    },
  });

  return NextResponse.json({ id: connection.id, platform: connection.platform, name: connection.name });
}
