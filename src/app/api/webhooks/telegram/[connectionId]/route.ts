import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { callDeepSeek, buildSystemPrompt, GLOBAL_SYSTEM_PROMPT } from '@/lib/deepseek';
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

// Détection langue arabe/darija → réponse en arabe classique
const LANGUAGE_INSTRUCTION = `
RÈGLE ABSOLUE DE LANGUE :
- Si le client écrit en arabe (أي لهجة) ou en darija algérienne → réponds TOUJOURS en arabe classique (فصحى).
- Si le client écrit en français → réponds en français.
- Si le client écrit en anglais → réponds en anglais.
- Ne mélange jamais les langues dans une même réponse.
`;

// System prompt strict commerce
const COMMERCE_INSTRUCTION = `
RÔLE STRICT : Tu es l'assistant IA d'une boutique e-commerce. Tu ne réponds QU'AUX questions liées à :
- Les produits de la boutique (prix, disponibilité, caractéristiques, tailles, couleurs)
- Les commandes (suivi, délai, confirmation)
- La livraison (wilaya, frais, délai)
- Les retours et remboursements
- Les promotions et réductions
- Les informations de contact de la boutique

Si le client pose une question hors de ces sujets (politique, sport, blagues, demandes personnelles, etc.), réponds poliment que tu es uniquement là pour aider avec les achats et les produits.
Réponds de manière professionnelle et courte (2-4 phrases maximum sauf si une liste est nécessaire).
`;

export async function POST(
  req: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const body = await req.json();

  const connection = await prisma.connection.findFirst({
    where: { id: params.connectionId, platform: 'TELEGRAM', isActive: true },
    include: {
      predefinedMessages: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      detailResponses: { where: { isActive: true } },
    },
  });

  if (!connection || !connection.telegramBotToken) {
    return NextResponse.json({ ok: true });
  }

  // Bot suspendu par le propriétaire
  if (connection.isSuspended) {
    return NextResponse.json({ ok: true });
  }

  const token = decrypt(connection.telegramBotToken);
  const message = body.message || body.callback_query?.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const text: string = message.text || '';
  const telegramUser = message.from;
  const contactId = String(chatId);
  const contactName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || null
    : null;

  const user = await prisma.user.findUnique({ where: { id: connection.userId } });
  if (!user || user.isBanned) return NextResponse.json({ ok: true });

  // Handle /start command
  if (text === '/start') {
    if (connection.welcomeMessage) {
      await sendTelegramMessage(token, chatId, connection.welcomeMessage);
    }
    await upsertContactContext(connection.id, contactId, { contactName });
    return NextResponse.json({ ok: true });
  }

  // Récupérer la conversation (pour vérifier suspension/needsHelp)
  const conversation = await getOrCreateConversation({
    connectionId: connection.id,
    contactId,
    platform: 'TELEGRAM',
    contactName,
  });

  // Conversation suspendue
  if (conversation.isSuspended) {
    return NextResponse.json({ ok: true });
  }

  let responseText = '';
  let tokensRequired = 1;
  let messageType: 'text' | 'voice' | 'image' = 'text';
  let inboundContent = text;

  // ── Voice ────────────────────────────────────────────────────────────────
  if (message.voice) {
    messageType = 'voice';
    tokensRequired = 2;
    if (!user.unlimitedTokens && user.tokenBalance < 2) {
      await sendTelegramMessage(token, chatId, '⚠️ Solde insuffisant pour traiter un message vocal.');
      return NextResponse.json({ ok: true });
    }
    try {
      const fileRes = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${message.voice.file_id}`
      );
      const fileData = await fileRes.json();
      const filePath = fileData.result?.file_path;
      if (!filePath) return NextResponse.json({ ok: true });

      const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      const transcript = await transcribeAudio(audioBuffer, 'audio/ogg');
      if (!transcript) return NextResponse.json({ ok: true });

      inboundContent = `[Vocal]: ${transcript}`;
      logCost(user.id, 'whisper');
    } catch (err) {
      console.error('[Telegram] Voice transcription error', err);
      await sendTelegramMessage(token, chatId, "Je n'ai pas pu traiter votre message vocal. Essayez en texte.");
      return NextResponse.json({ ok: true });
    }
  }

  // ── Image ────────────────────────────────────────────────────────────────
  else if (message.photo) {
    messageType = 'image';
    inboundContent = '[Image reçue]';
  }

  // ── Text manquant ─────────────────────────────────────────────────────────
  else if (!text) {
    return NextResponse.json({ ok: true });
  }

  // ── Solde tokens ─────────────────────────────────────────────────────────
  if (tokensRequired > 0 && !user.unlimitedTokens && user.tokenBalance < tokensRequired) {
    await sendTelegramMessage(token, chatId, '⚠️ Solde de jetons insuffisant. Rechargez votre compte sur YelhaDms.');
    return NextResponse.json({ ok: true });
  }

  // ── Réponses prédéfinies (texte uniquement, 0 token) ─────────────────────
  if (messageType === 'text' && text) {
    const lower = text.toLowerCase();
    const predefined = connection.predefinedMessages.find((m) =>
      m.keywords.some((k) => lower.includes(k.toLowerCase()))
    );
    if (predefined) {
      responseText = predefined.response;
      tokensRequired = 0;
    }
  }

  // ── Appel IA ─────────────────────────────────────────────────────────────
  if (!responseText) {
    const contactCtx = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
    });

    const history = await getRecentHistory(conversation.id);

    const systemPrompt = await buildTelegramSystemPrompt(
      connection,
      buildContactContextString(contactCtx)
    );

    const aiMessages = [
      ...history,
      { role: 'user' as const, content: inboundContent },
    ];

    const rawResponse = await callDeepSeek(aiMessages, systemPrompt);

    // Détecter si l'IA a marqué le message comme hors-sujet (spam)
    if (rawResponse.startsWith('[HORS_SUJET]')) {
      responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
      // Incrémenter score spam
      const blocked = await handleSpam(conversation.id);
      if (blocked) {
        // Enregistrer le message sans réponse et notifier
        await saveInboundOnly({ conversationId: conversation.id, content: inboundContent, type: messageType });
        await upsertContactContext(connection.id, contactId, { contactName });
        // On répond une dernière fois puis on bloque
        if (responseText) await sendTelegramMessage(token, chatId, responseText);
        return NextResponse.json({ ok: true });
      }
    } else {
      responseText = rawResponse;
      logCost(user.id, messageType === 'voice' ? 'deepseek_voice' : 'deepseek_text');
    }
  }

  if (!responseText) return NextResponse.json({ ok: true });

  // ── Débiter tokens ────────────────────────────────────────────────────────
  if (tokensRequired > 0 && !user.unlimitedTokens) {
    const updated = await prisma.user.updateMany({
      where: { id: connection.userId, tokenBalance: { gte: tokensRequired } },
      data: { tokenBalance: { decrement: tokensRequired } },
    });
    if (updated.count === 0) {
      await sendTelegramMessage(token, chatId, '⚠️ Solde de jetons insuffisant.');
      return NextResponse.json({ ok: true });
    }
    const newUser = await prisma.user.findUnique({ where: { id: connection.userId } });
    await prisma.tokenTransaction.create({
      data: {
        userId: connection.userId,
        type: 'USAGE',
        amount: -tokensRequired,
        balance: newUser!.tokenBalance,
        description: `Telegram — ${messageType}`,
      },
    });
  }

  // ── Envoyer ───────────────────────────────────────────────────────────────
  await sendTelegramMessage(token, chatId, responseText);

  // ── Sauvegarder ───────────────────────────────────────────────────────────
  try {
    await saveMessageExchange({
      conversationId: conversation.id,
      inbound: { content: inboundContent, type: messageType, tokensUsed: tokensRequired },
      outbound: { content: responseText },
    });
    await upsertContactContext(connection.id, contactId, { contactName });
  } catch (err) {
    console.error('[Telegram] Save error', err);
  }

  return NextResponse.json({ ok: true });
}

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function buildTelegramSystemPrompt(connection: any, contactContext: string): Promise<string> {
  const predefinedStr = connection.predefinedMessages
    .map((m: any) => `Mots-clés: ${m.keywords.join(', ')}\nRéponse: ${m.response}`)
    .join('\n---\n');

  const detailStr = (connection.detailResponses || [])
    .map((d: any) => `Type: ${d.questionType}\nRéponse à adapter: ${d.response}`)
    .join('\n---\n');

  const products = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { name: true, description: true, price: true, stock: true },
    take: 50,
  });

  const productsStr = products.length > 0
    ? products.map((p: any) =>
        `• ${p.name}${p.price ? ` — ${p.price} DA` : ''}${p.stock !== null ? ` (Stock: ${p.stock})` : ''}${p.description ? `\n  ${p.description}` : ''}`
      ).join('\n')
    : 'Aucun produit configuré pour le moment.';

  let prompt = buildSystemPrompt({
    botName: connection.botName || 'Assistant',
    businessName: connection.businessName || '',
    botPersonality: connection.botPersonality,
    predefinedResponses: predefinedStr,
    customInstructions: connection.customInstructions || '',
    globalPrompt: GLOBAL_SYSTEM_PROMPT,
    contactContext,
    detailResponses: detailStr,
  });

  prompt += `\n\nCATALOGUE PRODUITS DE LA BOUTIQUE :\n${productsStr}\n\nRéponds aux questions sur ces produits avec les informations ci-dessus. Ne propose jamais de produits qui ne sont pas dans cette liste.`;
  prompt += LANGUAGE_INSTRUCTION;
  prompt += COMMERCE_INSTRUCTION;
  prompt += `\nSi le message est hors-sujet commerce, commence ta réponse par [HORS_SUJET] puis donne une réponse polie courte.`;

  return prompt;
}

