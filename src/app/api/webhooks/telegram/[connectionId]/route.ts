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

  // ── Capture owner Chat ID (first message ever received) ───────────────────
  if (!connection.telegramChatId) {
    await prisma.connection.update({
      where: { id: connection.id },
      data: { telegramChatId: String(chatId) },
    });
    // Update local reference so downstream logic has it
    (connection as any).telegramChatId = String(chatId);
  }

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
    const isFirstMessage = history.length === 0;

    const systemPrompt = await buildTelegramSystemPrompt(
      connection,
      buildContactContextString(contactCtx),
      isFirstMessage
    );

    const aiMessages = [
      ...history,
      { role: 'user' as const, content: inboundContent },
    ];

    const rawResponse = await callDeepSeek(aiMessages, systemPrompt);

    // ── Hors sujet → suspendre la conversation + needsHelp ───────────────
    if (rawResponse.startsWith('[HORS_SUJET]')) {
      responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
      // Marquer comme needsHelp + suspendre cette conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { needsHelp: true, isSuspended: true },
      });
      await saveInboundOnly({ conversationId: conversation.id, content: inboundContent, type: messageType });
      await upsertContactContext(connection.id, contactId, { contactName });
      if (responseText) await sendTelegramMessage(token, chatId, responseText);
      return NextResponse.json({ ok: true });
    }

    // ── Commande confirmée → extraire JSON et sauvegarder ────────────────
    const orderMatch = rawResponse.match(/\[COMMANDE_CONFIRMEE:(\{[\s\S]*?\})\]/);
    if (orderMatch) {
      responseText = rawResponse.replace(/\[COMMANDE_CONFIRMEE:[\s\S]*?\]/, '').trim();
      try {
        const orderData = JSON.parse(orderMatch[1]);
        await saveOrderFromBot(connection, contactId, contactName, orderData);
      } catch (e) {
        console.error('[Telegram] Order parse error', e);
      }
    } else {
      responseText = rawResponse;
    }

    logCost(user.id, messageType === 'voice' ? 'deepseek_voice' : 'deepseek_text');
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

async function buildTelegramSystemPrompt(connection: any, contactContext: string, isFirstMessage: boolean): Promise<string> {
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
    : 'Aucun produit configuré.';

  const prompt = buildSystemPrompt({
    botName: connection.botName || 'Assistant',
    businessName: connection.businessName || '',
    botPersonality: connection.botPersonality,
    predefinedResponses: predefinedStr || 'Aucune',
    customInstructions: connection.customInstructions || 'Aucune',
    globalPrompt: GLOBAL_SYSTEM_PROMPT,
    contactContext,
    detailResponses: detailStr,
    isFirstMessage,
  });

  return prompt + `\n\n══════════════════════════════════════
CATALOGUE PRODUITS DE LA BOUTIQUE
══════════════════════════════════════
${productsStr}

Important : utilise UNIQUEMENT les produits listés ci-dessus. Ne mentionne jamais un produit absent de cette liste.`;
}

async function saveOrderFromBot(connection: any, contactId: string, contactName: string | null, data: any) {
  // Find product IDs by name
  const allProducts = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const items = (data.produits || []).map((item: any) => {
    const found = allProducts.find((p) =>
      p.name.toLowerCase().includes(item.nom?.toLowerCase() || '') ||
      item.nom?.toLowerCase().includes(p.name.toLowerCase())
    );
    return {
      name: item.nom || 'Produit',
      quantity: item.quantite || 1,
      price: found?.price || item.prix || 0,
      productId: found?.id || null,
    };
  });

  const total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ') || contactName || 'Client';
  const notes = `Wilaya: ${data.wilaya || ''} — Commune: ${data.commune || ''}`;

  const order = await prisma.order.create({
    data: {
      userId: connection.userId,
      connectionId: connection.id,
      contactName: fullName,
      contactId,
      contactPhone: data.telephone || null,
      totalAmount: total,
      notes,
      items: {
        create: items.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          ...(i.productId ? { productId: i.productId } : {}),
        })),
      },
    },
  });

  console.log(`[Telegram] Order saved: ${order.id} for ${fullName}`);
}

