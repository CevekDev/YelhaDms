import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { callDeepSeek, GLOBAL_SYSTEM_PROMPT, buildSystemPrompt } from '@/lib/deepseek';
import {
  getOrCreateConversation,
  upsertContactContext,
  buildContactContextString,
  getRecentHistory,
  saveMessageExchange,
  logCost,
} from '@/lib/messages';
import { sendInstagramMessage } from '@/lib/instagram';
import crypto from 'crypto';

// ── Signature verification ────────────────────────────────────────────────────
function verifyMetaSignature(rawBody: Buffer, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // skip if not configured
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────
async function buildInstagramSystemPrompt(
  connection: any,
  contactContext: string
): Promise<string> {
  const products = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { name: true, price: true, description: true },
    take: 50,
  });

  const productsStr =
    products.length > 0
      ? products
          .map((p) => `• ${p.name}${p.price ? ` — ${p.price} DA` : ''}`)
          .join('\n')
      : 'Aucun produit configuré.';

  const predefinedStr = (connection.predefinedMessages || [])
    .map((m: any) => `Mots-clés: ${m.keywords.join(', ')}\nRéponse: ${m.response}`)
    .join('\n---\n');

  const prompt = buildSystemPrompt({
    botName: connection.botName || 'Assistant',
    businessName: connection.businessName || connection.name || 'la boutique',
    botPersonality: connection.botPersonality,
    predefinedResponses: predefinedStr || 'Aucune',
    customInstructions: connection.customInstructions || 'Aucune',
    globalPrompt: GLOBAL_SYSTEM_PROMPT,
    contactContext,
    isFirstMessage: false,
  });

  return (
    prompt +
    `\n\nCATALOGUE PRODUITS:\n${productsStr}\n\nRÈGLES: Ne jamais mentionner le stock sauf si demandé. Plateforme: Instagram DM.`
  );
}

// ── GET — Meta webhook verification ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token) {
    return new Response('Forbidden', { status: 403 });
  }

  const connection = await prisma.connection.findFirst({
    where: { instagramWebhookVerifyToken: token, platform: 'INSTAGRAM' },
  });

  if (!connection) return new Response('Forbidden', { status: 403 });
  return new Response(challenge ?? '', { status: 200 });
}

// ── POST — Receive DMs ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = Buffer.from(await req.arrayBuffer());

  // Verify Meta signature
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn('[Instagram] Invalid signature');
    return new Response('Forbidden', { status: 403 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Parse Meta payload
  const entry = body?.entry?.[0];
  const messaging = entry?.messaging?.[0];
  if (!entry || !messaging) return new Response('OK', { status: 200 });

  const sender = messaging.sender?.id as string | undefined;
  const recipient = messaging.recipient?.id as string | undefined;
  const message = messaging.message;

  // Ignore echoes and self-messages
  if (!sender || !recipient || !message) return new Response('OK', { status: 200 });
  if (message.is_echo === true) return new Response('OK', { status: 200 });
  if (sender === recipient) return new Response('OK', { status: 200 });

  const text: string = message.text ?? '';
  if (!text) return new Response('OK', { status: 200 });

  // Find connection by Instagram business user ID (entry.id = our IG user ID)
  const igBusinessId: string = entry.id;
  const connection = await prisma.connection.findFirst({
    where: { instagramUserId: igBusinessId, platform: 'INSTAGRAM', isActive: true },
    include: {
      predefinedMessages: { where: { isActive: true }, orderBy: { priority: 'asc' } },
    },
  });

  if (!connection || !connection.instagramAccessToken) {
    return new Response('OK', { status: 200 });
  }

  if (connection.isSuspended) return new Response('OK', { status: 200 });

  // Check owner token balance
  const user = await prisma.user.findUnique({ where: { id: connection.userId } });
  if (!user || user.isBanned) return new Response('OK', { status: 200 });
  if (!user.unlimitedTokens && user.tokenBalance < 1) {
    return new Response('OK', { status: 200 });
  }

  const contactId = sender;

  // Get or create conversation
  const conversation = await getOrCreateConversation({
    connectionId: connection.id,
    contactId,
    platform: 'INSTAGRAM',
  });

  if (conversation.isSuspended) return new Response('OK', { status: 200 });

  let responseText = '';
  let tokensRequired = 1;

  // Check predefined messages (0 tokens)
  const lower = text.toLowerCase();
  const predefined = connection.predefinedMessages.find((m) =>
    m.keywords.some((k) => lower.includes(k.toLowerCase()))
  );
  if (predefined) {
    responseText = predefined.response;
    tokensRequired = 0;
  }

  // Call AI if no predefined match
  if (!responseText) {
    const contactCtx = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
    });

    const history = await getRecentHistory(conversation.id);
    const systemPrompt = await buildInstagramSystemPrompt(
      connection,
      buildContactContextString(contactCtx)
    );

    const aiMessages = [
      ...history,
      { role: 'user' as const, content: text },
    ];

    const rawResponse = await callDeepSeek(aiMessages, systemPrompt);
    if (!rawResponse) return new Response('OK', { status: 200 });

    responseText = rawResponse;
  }

  if (!responseText) return new Response('OK', { status: 200 });

  // Log API cost
  if (tokensRequired > 0) {
    logCost(user.id, 'deepseek_text');
  }

  // Decrypt token and send message
  const accessToken = decrypt(connection.instagramAccessToken);
  try {
    await sendInstagramMessage(accessToken, sender, responseText);
  } catch (err) {
    console.error('[Instagram] Send error', err);
    return new Response('OK', { status: 200 });
  }

  // Deduct token atomically
  if (tokensRequired > 0 && !user.unlimitedTokens) {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: connection.userId, tokenBalance: { gte: tokensRequired } },
        data: { tokenBalance: { decrement: tokensRequired } },
        select: { tokenBalance: true },
      });
      await prisma.tokenTransaction.create({
        data: {
          userId: connection.userId,
          type: 'USAGE',
          amount: -tokensRequired,
          balance: updatedUser.tokenBalance,
          description: 'Instagram DM — text',
        },
      });
    } catch {
      // insufficient balance race condition — already sent, log and continue
      console.warn('[Instagram] Token deduction failed (race condition)');
    }
  }

  // Save message exchange and contact context
  try {
    await saveMessageExchange({
      conversationId: conversation.id,
      inbound: { content: text, type: 'text', tokensUsed: tokensRequired },
      outbound: { content: responseText },
    });
    await upsertContactContext(connection.id, contactId, { contactName: null, metadata: {} });
  } catch (err) {
    console.error('[Instagram] Save error', err);
  }

  return new Response('OK', { status: 200 });
}
