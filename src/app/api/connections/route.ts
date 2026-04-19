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
    whatsappPhoneNumberId: z.string().min(1),
    whatsappAccessToken: z.string().min(10),
    whatsappVerifyToken: z.string().min(6),
  }),
  z.object({
    platform: z.literal('TELEGRAM'),
    name: z.string().min(1).max(100),
    botName: z.string().min(1).max(50).default('Assistant'),
    businessName: z.string().max(100).optional(),
    telegramBotToken: z.string().min(20),
  }),
  z.object({
    platform: z.literal('INSTAGRAM'),
    name: z.string().min(1).max(100),
    botName: z.string().min(1).max(50).default('Assistant'),
    businessName: z.string().max(100).optional(),
    instagramBusinessAccountId: z.string().min(1),
    instagramAccessToken: z.string().min(10),
    instagramVerifyToken: z.string().min(6),
  }),
  z.object({
    platform: z.literal('FACEBOOK'),
    name: z.string().min(1).max(100),
    botName: z.string().min(1).max(50).default('Assistant'),
    businessName: z.string().max(100).optional(),
    messengerPageId: z.string().min(1),
    messengerAccessToken: z.string().min(10),
    messengerVerifyToken: z.string().min(6),
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

  // Strip all sensitive fields before returning
  const safe = connections.map(({
    telegramBotToken, instagramAccessToken, instagramPassword, instagramSessionData,
    whatsappAccessToken, whatsappVerifyToken, messengerAccessToken, messengerVerifyToken,
    telegramWebhookSecret, ecotrackToken, instagramWebhookVerifyToken,
    ...c
  }) => c);
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

  const BOT_LIMITS: Record<string, number> = {
    FREE: 1, STARTER: 1, BUSINESS: 3, PRO: 5, AGENCY: Infinity,
  };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planLevel: true, isPartner: true },
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

  // Instagram is reserved for partners only
  if (data.platform === 'INSTAGRAM' && !user?.isPartner) {
    return NextResponse.json({ error: 'Instagram DM est réservé aux partenaires YelhaDms.' }, { status: 403 });
  }

  // ── WhatsApp (Meta Cloud API) ─────────────────────────────────────────────
  if (data.platform === 'WHATSAPP') {
    const validRes = await fetch(
      `https://graph.facebook.com/v20.0/${data.whatsappPhoneNumberId}?fields=id,display_phone_number&access_token=${data.whatsappAccessToken}`
    );
    const validData = await validRes.json();
    if (!validRes.ok || validData.error) {
      return NextResponse.json({ error: 'Phone Number ID ou Access Token invalide. Vérifiez vos credentials Meta.' }, { status: 400 });
    }

    const connection = await prisma.connection.create({
      data: {
        userId: session.user.id,
        platform: 'WHATSAPP',
        name: data.name,
        botName: data.botName,
        businessName: data.businessName,
        whatsappPhoneNumberId: data.whatsappPhoneNumberId,
        whatsappAccessToken: encrypt(data.whatsappAccessToken),
        whatsappVerifyToken: encrypt(data.whatsappVerifyToken),
      },
    });

    return NextResponse.json({ id: connection.id, platform: 'WHATSAPP', name: connection.name });
  }

  // ── Facebook Messenger ────────────────────────────────────────────────────
  if (data.platform === 'FACEBOOK') {
    // Validate page ID + access token
    const validRes = await fetch(
      `https://graph.facebook.com/v20.0/${data.messengerPageId}?fields=id,name&access_token=${data.messengerAccessToken}`
    );
    const validData = await validRes.json();
    if (!validRes.ok || validData.error || validData.id !== data.messengerPageId) {
      return NextResponse.json({ error: 'Page ID ou Access Token invalide. Vérifiez vos credentials Meta.' }, { status: 400 });
    }

    const connection = await prisma.connection.create({
      data: {
        userId: session.user.id,
        platform: 'FACEBOOK',
        name: data.name,
        botName: data.botName,
        businessName: data.businessName,
        messengerPageId: data.messengerPageId,
        messengerAccessToken: encrypt(data.messengerAccessToken),
        messengerVerifyToken: encrypt(data.messengerVerifyToken),
      },
    });

    return NextResponse.json({ id: connection.id, platform: 'FACEBOOK', name: connection.name, pageName: validData.name });
  }

  // ── Instagram (Meta Graph API) ────────────────────────────────────────────
  if (data.platform === 'INSTAGRAM') {
    const validRes = await fetch(
      `https://graph.facebook.com/v20.0/${data.instagramBusinessAccountId}?fields=id,name,username&access_token=${data.instagramAccessToken}`
    );
    const validData = await validRes.json();
    if (!validRes.ok || validData.error) {
      return NextResponse.json({ error: 'Instagram Business Account ID ou Access Token invalide. Vérifiez vos identifiants Meta.' }, { status: 400 });
    }

    const connection = await prisma.connection.create({
      data: {
        userId: session.user.id,
        platform: 'INSTAGRAM',
        name: data.name,
        botName: data.botName,
        businessName: data.businessName,
        instagramUsername: validData.username ?? null,
        instagramBusinessAccountId: data.instagramBusinessAccountId,
        instagramAccessToken: encrypt(data.instagramAccessToken),
        instagramWebhookVerifyToken: encrypt(data.instagramVerifyToken),
      },
    });

    return NextResponse.json({
      id: connection.id,
      platform: 'INSTAGRAM',
      name: connection.name,
      username: validData.username,
    });
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (data.platform === 'TELEGRAM') {
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

    return NextResponse.json({ id: connection.id, platform: 'TELEGRAM', name: connection.name });
  }

  return NextResponse.json({ error: 'Platform non supportée' }, { status: 400 });
}
