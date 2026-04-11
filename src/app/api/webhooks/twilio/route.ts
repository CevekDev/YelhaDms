import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage, validateTwilioRequest } from '@/lib/twilio';
import { callDeepSeek, buildSystemPrompt } from '@/lib/deepseek';
import { transcribeAudio } from '@/lib/whisper';
import {
  getOrCreateConversation,
  upsertContactContext,
  buildContactContextString,
  getRecentHistory,
  saveMessageExchange,
  saveInboundOnly,
  handleSpam,
  logCost,
} from '@/lib/messages';

function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of body.split('&')) {
    const [k, v] = part.split('=').map(decodeURIComponent);
    if (k) params[k] = v ?? '';
  }
  return params;
}

const TWIML_OK = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

const LANGUAGE_INSTRUCTION = `
RÈGLE ABSOLUE DE LANGUE :
- Si le client écrit en arabe (أي لهجة) ou en darija algérienne → réponds TOUJOURS en arabe classique (فصحى).
- Si le client écrit en français → réponds en français.
- Si le client écrit en anglais → réponds en anglais.
- Ne mélange jamais les langues dans une même réponse.
`;

const COMMERCE_INSTRUCTION = `
RÔLE STRICT : Tu es l'assistant IA d'une boutique e-commerce. Tu ne réponds QU'AUX questions liées à :
- Les produits (prix, disponibilité, caractéristiques)
- Les commandes (suivi, délai, confirmation)
- La livraison (wilaya, frais, délai)
- Les retours et remboursements
- Les promotions et réductions
- Les informations de la boutique

Si le client pose une question hors de ces sujets, réponds poliment que tu es uniquement là pour aider avec les achats.
Si le message est hors-sujet, commence ta réponse par [HORS_SUJET] puis donne une réponse polie courte.
`;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);

  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`;

  if (!validateTwilioRequest(authToken, signature, url, params)) {
    console.error('[Twilio webhook] Invalid signature');
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  const from: string = params.From ?? '';
  const body: string = params.Body ?? '';
  const mediaUrl: string = params.MediaUrl0 ?? '';
  const mediaContentType: string = params.MediaContentType0 ?? '';
  const numMedia = parseInt(params.NumMedia ?? '0', 10);
  const profileName: string = params.ProfileName ?? '';

  const phoneNumber = from.replace('whatsapp:', '');
  const contactId = phoneNumber;
  const contactName = profileName || null;

  const connection = await prisma.connection.findFirst({
    where: { platform: 'WHATSAPP', twilioWhatsAppNumber: phoneNumber, isActive: true },
    include: {
      predefinedMessages: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      detailResponses: { where: { isActive: true } },
    },
  });

  if (!connection || connection.isSuspended) {
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  const user = await prisma.user.findUnique({ where: { id: connection.userId } });
  if (!user || user.isBanned) {
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Heures d'ouverture
  const now = new Date();
  if (connection.businessHours && !isWithinBusinessHours(connection.businessHours, now, connection.timezone)) {
    if (connection.awayMessage) await sendWhatsAppMessage(from, connection.awayMessage);
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Conversation (vérifier suspension)
  const conversation = await getOrCreateConversation({
    connectionId: connection.id,
    contactId,
    platform: 'WHATSAPP',
    contactName,
  });

  if (conversation.isSuspended) {
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  let responseText = '';
  let tokensRequired = 1;
  let messageType: 'text' | 'voice' | 'image' = 'text';
  let inboundContent = body;

  const isVoice = numMedia > 0 && (mediaContentType.startsWith('audio/') || mediaContentType === 'application/ogg');
  const isImage = numMedia > 0 && mediaContentType.startsWith('image/');

  // ── Voice ─────────────────────────────────────────────────────────────────
  if (isVoice && mediaUrl) {
    messageType = 'voice';
    tokensRequired = 2;
    if (!user.unlimitedTokens && user.tokenBalance < 2) {
      await sendWhatsAppMessage(from, '⚠️ Solde insuffisant pour traiter un message vocal.');
      return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
    }
    try {
      const audioRes = await fetch(mediaUrl, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        },
      });
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      const transcript = await transcribeAudio(audioBuffer, mediaContentType || 'audio/ogg');
      if (!transcript) return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
      inboundContent = `[Vocal]: ${transcript}`;
      logCost(user.id, 'whisper');
    } catch (err) {
      console.error('[Twilio] Voice error', err);
      await sendWhatsAppMessage(from, "Je n'ai pas pu traiter votre message vocal. Essayez en texte.");
      return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
    }
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  else if (isImage) {
    messageType = 'image';
    inboundContent = '[Image reçue]';
  }

  // ── Texte vide ────────────────────────────────────────────────────────────
  else if (!body.trim()) {
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Solde tokens ──────────────────────────────────────────────────────────
  if (tokensRequired > 0 && !user.unlimitedTokens && user.tokenBalance < tokensRequired) {
    await sendWhatsAppMessage(from, '⚠️ Solde de jetons insuffisant. Rechargez sur YelhaDms.');
    return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Réponses prédéfinies ──────────────────────────────────────────────────
  if (messageType === 'text') {
    const predefined = findPredefinedResponse(connection.predefinedMessages, body);
    if (predefined) {
      responseText = predefined;
      tokensRequired = 0;
    }
  }

  // ── Appel IA ──────────────────────────────────────────────────────────────
  if (!responseText) {
    const contactCtx = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
    });

    const history = await getRecentHistory(conversation.id);
    const systemPrompt = await buildConnectionSystemPrompt(connection, buildContactContextString(contactCtx));
    const aiMessages = [...history, { role: 'user' as const, content: inboundContent }];
    const rawResponse = await callDeepSeek(aiMessages, systemPrompt);

    if (rawResponse.startsWith('[HORS_SUJET]')) {
      responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
      const blocked = await handleSpam(conversation.id);
      if (blocked) {
        await saveInboundOnly({ conversationId: conversation.id, content: inboundContent, type: messageType });
        await upsertContactContext(connection.id, contactId, { contactName });
        if (responseText) await sendWhatsAppMessage(from, responseText);
        return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
      }
    } else {
      responseText = rawResponse;
      logCost(user.id, messageType === 'voice' ? 'deepseek_voice' : 'deepseek_text');
    }
  }

  if (!responseText) return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });

  // ── Débiter tokens ────────────────────────────────────────────────────────
  if (tokensRequired > 0 && !user.unlimitedTokens) {
    const updated = await prisma.user.updateMany({
      where: { id: connection.userId, tokenBalance: { gte: tokensRequired } },
      data: { tokenBalance: { decrement: tokensRequired } },
    });
    if (updated.count === 0) {
      await sendWhatsAppMessage(from, '⚠️ Solde insuffisant.');
      return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
    }
    const updatedUser = await prisma.user.findUnique({ where: { id: connection.userId } });
    await prisma.tokenTransaction.create({
      data: {
        userId: connection.userId,
        type: 'USAGE',
        amount: -tokensRequired,
        balance: updatedUser!.tokenBalance,
        description: `WhatsApp — ${messageType}`,
      },
    });
  }

  await sendWhatsAppMessage(from, responseText);

  try {
    await saveMessageExchange({
      conversationId: conversation.id,
      inbound: { content: inboundContent, type: messageType, tokensUsed: tokensRequired },
      outbound: { content: responseText },
    });
    await upsertContactContext(connection.id, contactId, { contactName });
  } catch (err) {
    console.error('[Twilio] Save error', err);
  }

  return new NextResponse(TWIML_OK, { headers: { 'Content-Type': 'text/xml' } });
}

async function buildConnectionSystemPrompt(connection: any, contactContext: string): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'global_system_prompt' } });
  const globalPrompt = setting?.value ?? getDefaultPrompt();

  const predefinedStr = connection.predefinedMessages
    .map((m: any) => `Mots-clés: ${m.keywords.join(', ')}\nRéponse: ${m.response}`)
    .join('\n---\n');

  const detailStr = (connection.detailResponses || [])
    .map((d: any) => `Type: ${d.questionType}\nRéponse à adapter: ${d.response}`)
    .join('\n---\n');

  let prompt = buildSystemPrompt({
    botName: connection.botName ?? 'Assistant',
    businessName: connection.businessName ?? '',
    botPersonality: connection.botPersonality,
    predefinedResponses: predefinedStr,
    customInstructions: connection.customInstructions ?? '',
    globalPrompt,
    contactContext,
    detailResponses: detailStr,
  });

  prompt += LANGUAGE_INSTRUCTION;
  prompt += COMMERCE_INSTRUCTION;

  return prompt;
}

function getDefaultPrompt(): string {
  return `Tu es {botName}, l'assistant e-commerce de {businessName}.
{botPersonality}
RÉPONSES PRÉDÉFINIES : {predefinedResponses}
INSTRUCTIONS : {customInstructions}`;
}

function findPredefinedResponse(messages: any[], text: string): string | null {
  const lower = text.toLowerCase();
  for (const msg of messages) {
    if (!msg.isActive) continue;
    for (const keyword of msg.keywords) {
      if (lower.includes(keyword.toLowerCase())) return msg.response;
    }
  }
  return null;
}

function isWithinBusinessHours(businessHours: any, now: Date, timezone: string): boolean {
  if (!businessHours) return true;
  try {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = dayNames[now.getDay()];
    const dayConfig = businessHours[day];
    if (!dayConfig?.open) return false;
    const [openH, openM] = dayConfig.start.split(':').map(Number);
    const [closeH, closeM] = dayConfig.end.split(':').map(Number);
    const current = now.getHours() * 60 + now.getMinutes();
    return current >= openH * 60 + openM && current <= closeH * 60 + closeM;
  } catch {
    return true;
  }
}
