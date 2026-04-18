import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { callDeepSeek, buildSystemPrompt, GLOBAL_SYSTEM_PROMPT } from '@/lib/deepseek';
import { sendLowTokenEmail } from '@/lib/resend';
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
import {
  validateLocation,
  handleEcotrackMessage,
  buildLocationSuggestionsMsg,
  finalizeEcotrackOrder,
  type EcotrackState,
} from '@/lib/ecotrack';


// ── Fetch Telegram profile photo URL (temporary but functional) ──────────
async function getTelegramProfilePhotoUrl(botToken: string, userId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const data = await res.json();
    const fileId = data?.result?.photos?.[0]?.[0]?.file_id;
    if (!fileId) return null;
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData?.result?.file_path;
    if (!filePath) return null;
    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  } catch {
    return null;
  }
}

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
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || telegramUser.username || null
    : null;
  const telegramUsername: string | null = telegramUser?.username || null;

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

  // ── Build merged metadata with profile photo (refresh if older than 1h) ──
  const conn = connection; // non-null reference for use inside closures
  async function buildMergedMetadata(): Promise<Record<string, any>> {
    const existing = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: conn.id, contactId } },
      select: { metadata: true },
    });
    const existingMeta = (existing?.metadata as Record<string, any> | null) ?? {};

    const lastFetch = existingMeta.lastPhotoFetch ? Number(existingMeta.lastPhotoFetch) : 0;
    const oneHour = 60 * 60 * 1000;
    const needsRefresh = !telegramUser?.is_bot && (Date.now() - lastFetch > oneHour);

    let photoUrl: string | null = existingMeta.profilePhotoUrl ?? null;
    if (telegramUser && needsRefresh) {
      const fetched = await getTelegramProfilePhotoUrl(token, telegramUser.id);
      if (fetched !== null) {
        photoUrl = fetched;
      }
    }

    return {
      ...existingMeta,
      ...(telegramUsername ? { telegramUsername } : {}),
      ...(photoUrl ? { profilePhotoUrl: photoUrl } : {}),
      ...(needsRefresh ? { lastPhotoFetch: Date.now() } : {}),
    };
  }

  // Handle /start command
  if (text === '/start') {
    if (connection.welcomeMessage) {
      await sendTelegramMessage(token, chatId, connection.welcomeMessage);
    }
    const metadata = await buildMergedMetadata();
    await upsertContactContext(connection.id, contactId, { contactName, metadata });
    return NextResponse.json({ ok: true });
  }

  // ── Confirmation reply detection ─────────────────────────────────────────
  if (text) {
    const lower = text.toLowerCase().trim();
    const isYes = /^(oui|yes|confirme|confirm|ok|d'accord|dacord|yep|ouii|ouiii|ouais|yep|correct|exact|c'est bon|cest bon|c bon|je confirme|valide|validé|accepte|j'accepte)/.test(lower);
    const isNo  = /^(non|no|annule|cancel|annuler|pas bon|faux|incorrect|je refuse|refuse|nope|nan|naan)/.test(lower);

    if (isYes || isNo) {
      const pendingOrder = await prisma.order.findFirst({
        where: {
          connectionId: connection.id,
          contactId,
          status: 'PENDING',
          confirmationSentAt: { not: null },
        },
        orderBy: { confirmationSentAt: 'desc' },
      });

      if (pendingOrder) {
        let newStatus: 'CONFIRMED' | 'CANCELLED' | 'SHIPPED' = isYes ? 'CONFIRMED' : 'CANCELLED';
        let replyMsg = '';

        if (isYes) {
          // Auto-ship via Ecotrack if enabled and order has a tracking code
          const connEcoToken = (connection as any).ecotrackToken as string | null;
          const connEcoUrl = (connection as any).ecotrackUrl as string | null;
          const autoShip = (connection as any).ecotrackAutoShip as boolean;

          if (autoShip && connEcoToken && connEcoUrl && pendingOrder.ecotrackTracking) {
            try {
              const { shipEcotrackOrder } = await import('@/lib/ecotrack');
              const shipped = await shipEcotrackOrder(connEcoUrl, decrypt(connEcoToken), pendingOrder.ecotrackTracking);
              if (shipped) {
                newStatus = 'SHIPPED';
                replyMsg = `✅ Commande *#${pendingOrder.id.slice(-6).toUpperCase()}* confirmée et *expédiée* ! 🚚\n📦 Tracking : *${pendingOrder.ecotrackTracking}*\n\nMerci pour votre confiance ! 🎉`;
              }
            } catch (e) {
              console.error('[Ecotrack] Auto-ship error', e);
            }
          }
          if (!replyMsg) {
            replyMsg = `✅ Votre commande *#${pendingOrder.id.slice(-6).toUpperCase()}* a été *confirmée* avec succès ! Merci pour votre confiance. 🎉`;
            if (pendingOrder.ecotrackTracking) replyMsg += `\n📦 Tracking : *${pendingOrder.ecotrackTracking}*`;
          }
        } else {
          replyMsg = `❌ Votre commande *#${pendingOrder.id.slice(-6).toUpperCase()}* a été *annulée*. N'hésitez pas à nous recontacter si vous changez d'avis.`;
          // Remove from Ecotrack if tracking exists
          if (pendingOrder.ecotrackTracking) {
            const connEcoToken = (connection as any).ecotrackToken as string | null;
            const connEcoUrl = (connection as any).ecotrackUrl as string | null;
            if (connEcoToken && connEcoUrl) {
              try {
                const { deleteEcotrackOrder } = await import('@/lib/ecotrack');
                await deleteEcotrackOrder(connEcoUrl, decrypt(connEcoToken), pendingOrder.ecotrackTracking);
              } catch (e) { console.error('[Ecotrack] Delete order error', e); }
            }
          }
        }

        await prisma.order.update({ where: { id: pendingOrder.id }, data: { status: newStatus } });
        await sendTelegramMessage(token, chatId, replyMsg);

        const metadata = await buildMergedMetadata();
        await upsertContactContext(connection.id, contactId, { contactName, metadata });
        await saveInboundOnly({ conversationId: (await getOrCreateConversation({ connectionId: connection.id, contactId, platform: 'TELEGRAM', contactName })).id, content: text, type: 'text' });

        return NextResponse.json({ ok: true });
      }
    }
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

  // ── Ecotrack state machine (intercepts text messages mid-order flow) ────────
  const ecoRawToken = (connection as any).ecotrackToken as string | null;
  const ecoUrl = (connection as any).ecotrackUrl as string | null;
  const ecoEnabled = !!(ecoRawToken && ecoUrl);

  if (ecoEnabled && messageType === 'text' && text) {
    const ctxForEco = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
      select: { metadata: true },
    });
    const metaForEco = (ctxForEco?.metadata as Record<string, any> | null) ?? {};
    const ecoState = metaForEco.ecotrackState as EcotrackState | undefined;

    if (ecoState) {
      const ecoToken = decrypt(ecoRawToken!);
      const result = await handleEcotrackMessage(ecoState, text, ecoToken, ecoUrl!);
      if (result.handled) {
        const newMeta = { ...metaForEco, ecotrackState: result.newState ?? undefined };
        await upsertContactContext(connection.id, contactId, { contactName, metadata: newMeta });
        if (result.responseText) await sendTelegramMessage(token, chatId, result.responseText);
        await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
        return NextResponse.json({ ok: true });
      }
    }
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
    // logCost moved below — only charged if a valid response is produced

    // ── Hors sujet → spam score approach ────────────────────────────────
    if (rawResponse.startsWith('[HORS_SUJET]')) {
      responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
      const blocked = await handleSpam(conversation.id);
      if (blocked) {
        await saveInboundOnly({ conversationId: conversation.id, content: inboundContent, type: messageType });
        await upsertContactContext(connection.id, contactId, { contactName, metadata: await buildMergedMetadata() });
        if (responseText) await sendTelegramMessage(token, chatId, responseText);
        return NextResponse.json({ ok: true });
      }
    }

    // ── Commande annulée ─────────────────────────────────────────────────
    if (rawResponse.includes('[COMMANDE_ANNULEE]')) {
      responseText = rawResponse.replace('[COMMANDE_ANNULEE]', '').trim();
      try {
        const latestOrder = await prisma.order.findFirst({
          where: { connectionId: connection.id, contactId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (latestOrder) {
          await prisma.order.update({ where: { id: latestOrder.id }, data: { status: 'CANCELLED' } });
          console.log(`[Telegram] Order cancelled: ${latestOrder.id}`);
        }
      } catch (e) {
        console.error('[Telegram] Order cancellation error', e);
      }
    }
    // ── Commande modifiée → mettre à jour la commande existante ──────────
    else if (rawResponse.includes('[COMMANDE_MODIFIEE:')) {
      const tagStart = rawResponse.indexOf('[COMMANDE_MODIFIEE:');
      const jsonStart = tagStart + '[COMMANDE_MODIFIEE:'.length;
      const tagEnd = rawResponse.lastIndexOf('}]');
      if (tagEnd > jsonStart) {
        const jsonStr = rawResponse.slice(jsonStart, tagEnd + 1);
        responseText = (rawResponse.slice(0, tagStart) + rawResponse.slice(tagEnd + 2)).trim();
        try {
          const orderData = JSON.parse(jsonStr);
          await updateOrCreateOrder(connection, contactId, contactName, orderData);
        } catch (e) {
          console.error('[Telegram] Order modify error', e, 'JSON:', jsonStr);
        }
      } else {
        responseText = rawResponse;
      }
    }
    // ── Commande confirmée → créer ou réactiver une commande existante ───
    else {
      const tagStart = rawResponse.indexOf('[COMMANDE_CONFIRMEE:');
      if (tagStart !== -1) {
        const jsonStart = tagStart + '[COMMANDE_CONFIRMEE:'.length;
        const tagEnd = rawResponse.lastIndexOf('}]');
        if (tagEnd > jsonStart) {
          const jsonStr = rawResponse.slice(jsonStart, tagEnd + 1);
          responseText = (rawResponse.slice(0, tagStart) + rawResponse.slice(tagEnd + 2)).trim();
          try {
            const orderData = JSON.parse(jsonStr);
            // If there's a recently cancelled order for this contact, update it instead of creating new
            const recentCancelled = await prisma.order.findFirst({
              where: {
                connectionId: connection.id,
                contactId,
                status: 'CANCELLED',
                updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }, // within last 10 min
              },
              orderBy: { updatedAt: 'desc' },
            });
            let newOrderId: string;
            if (recentCancelled) {
              newOrderId = await updateOrCreateOrder(connection, contactId, contactName, orderData, recentCancelled.id);
            } else {
              newOrderId = await saveOrderFromBot(connection, contactId, contactName, orderData);
            }

            // ── Ecotrack: validate address + start delivery flow ─────────
            if (ecoEnabled && newOrderId) {
              try {
                const ecoToken = decrypt(ecoRawToken!);
                const { found, suggestions } = await validateLocation(ecoUrl!, ecoToken, orderData.wilaya || '', orderData.commune || '');
                if (found) {
                  const newState: EcotrackState = {
                    step: 'awaiting_delivery_type',
                    orderId: newOrderId,
                    orderData,
                    wilayaId: found.wilayaId,
                    wilayaName: found.wilayaName,
                    communeName: found.communeName,
                    codePostal: found.codePostal,
                    hasStopDesk: found.hasStopDesk,
                  };
                  const currMeta = (contactCtx?.metadata as Record<string, any> | null) ?? {};
                  await upsertContactContext(connection.id, contactId, { contactName, metadata: { ...currMeta, ecotrackState: newState } });
                  responseText = `✅ Commande enregistrée !\n\n📍 Livraison à *${found.communeName}*, ${found.wilayaName}.\n\nComment souhaitez-vous recevoir votre colis ?\n1️⃣ Livraison à *domicile*\n${found.hasStopDesk ? '2️⃣ Retrait en *Stop Desk* (agence)' : '2️⃣ Stop Desk _(non disponible dans cette commune)_'}`;
                } else if (suggestions.length > 0) {
                  const newState: EcotrackState = {
                    step: 'awaiting_location_confirm',
                    orderId: newOrderId,
                    orderData,
                    wilayaId: suggestions[0].wilayaId,
                    wilayaName: suggestions[0].wilayaName,
                    communeName: suggestions[0].communeName,
                    codePostal: suggestions[0].codePostal,
                    hasStopDesk: suggestions[0].hasStopDesk,
                    suggestions,
                  };
                  const currMeta = (contactCtx?.metadata as Record<string, any> | null) ?? {};
                  await upsertContactContext(connection.id, contactId, { contactName, metadata: { ...currMeta, ecotrackState: newState } });
                  responseText = buildLocationSuggestionsMsg(suggestions, orderData.commune || '', orderData.wilaya || '');
                }
                // If no match: responseText stays as the AI's message, no Ecotrack state
              } catch (ecoErr) {
                console.error('[Ecotrack] Location validation error', ecoErr);
              }
            }
          } catch (e) {
            console.error('[Telegram] Order parse error', e, 'JSON:', jsonStr);
          }
        } else {
          responseText = rawResponse;
        }
      } else if (!rawResponse.startsWith('[HORS_SUJET]')) {
        responseText = rawResponse;
      }
    }
  }

  if (!responseText) return NextResponse.json({ ok: true });

  // ── Facturer le coût API uniquement si une réponse est produite ───────────
  if (tokensRequired > 0) {
    logCost(user.id, messageType === 'voice' ? 'deepseek_voice' : 'deepseek_text');
  }

  // ── Débiter tokens (atomique) ─────────────────────────────────────────────
  if (tokensRequired > 0 && !user.unlimitedTokens) {
    let newBalance: number;
    try {
      const updatedUser = await prisma.user.update({
        where: { id: connection.userId, tokenBalance: { gte: tokensRequired } },
        data: { tokenBalance: { decrement: tokensRequired } },
        select: { tokenBalance: true },
      });
      newBalance = updatedUser.tokenBalance;
    } catch {
      // Prisma throws when WHERE matches 0 rows (insufficient balance)
      await sendTelegramMessage(token, chatId, '⚠️ Solde de jetons insuffisant.');
      return NextResponse.json({ ok: true });
    }
    await prisma.tokenTransaction.create({
      data: {
        userId: connection.userId,
        type: 'USAGE',
        amount: -tokensRequired,
        balance: newBalance,
        description: `Telegram — ${messageType}`,
      },
    });

    // Check low token alert
    if (newBalance <= 100) {
      const freshUser = await prisma.user.findUnique({ where: { id: connection.userId }, select: { lowTokenAlertSent: true, email: true, name: true } });
      if (freshUser && !freshUser.lowTokenAlertSent) {
        await prisma.user.update({ where: { id: connection.userId }, data: { lowTokenAlertSent: true } });
        try { await sendLowTokenEmail(freshUser.email, freshUser.name ?? '', newBalance); } catch {}
      }
    }
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
    await upsertContactContext(connection.id, contactId, { contactName, metadata: await buildMergedMetadata() });
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
        `• ${p.name}${p.price ? ` — ${p.price} DA` : ''}${p.description ? ` [détails disponibles si demandé]` : ''}`
      ).join('\n')
    : 'Aucun produit configuré.';

  const prompt = buildSystemPrompt({
    botName: connection.botName || 'Assistant',
    businessName: connection.businessName || connection.name || 'la boutique',
    botPersonality: connection.botPersonality,
    predefinedResponses: predefinedStr || 'Aucune',
    customInstructions: connection.customInstructions || 'Aucune',
    globalPrompt: GLOBAL_SYSTEM_PROMPT,
    contactContext,
    detailResponses: detailStr,
    isFirstMessage,
    commerceType: connection.commerceType || 'products',
  });

  // Build per-product detail map for the description section
  const productDetailsStr = products
    .filter((p: any) => p.description)
    .map((p: any) => `• ${p.name} : ${p.description}`)
    .join('\n');

  return prompt + `\n\n══════════════════════════════════════
CATALOGUE PRODUITS DE LA BOUTIQUE
══════════════════════════════════════
${productsStr}

RÈGLES PRODUITS (STRICTES) :
- Quand tu parles d'un produit, donne son nom et son prix. C'est tout par défaut.
- ❌ NE MENTIONNE JAMAIS le stock/disponibilité sauf si le client demande EXPLICITEMENT.
- ❌ NE donne PAS la description sauf si le client demande "plus de détails" ou "décris-moi".
- ❌ N'invente JAMAIS un produit absent de cette liste.
- Si le client demande "quoi comme produits" → liste les noms + prix uniquement.

${productDetailsStr ? `DESCRIPTIONS (à n'utiliser QUE si le client demande des détails) :\n${productDetailsStr}` : ''}`;
}

async function saveOrderFromBot(connection: any, contactId: string, contactName: string | null, data: any): Promise<string> {
  // Find product IDs by name
  const allProducts = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const items = (data.produits || []).map((item: any) => {
    const itemNameLower = (item.nom ?? '').toLowerCase();
    // 1. Exact match first
    let found = allProducts.find((p) => p.name.toLowerCase() === itemNameLower);
    // 2. Substring match only for names 4+ characters long
    if (!found && itemNameLower.length >= 4) {
      found = allProducts.find(
        (p) =>
          p.name.toLowerCase().includes(itemNameLower) ||
          (p.name.length >= 4 && itemNameLower.includes(p.name.toLowerCase()))
      );
    }
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
  return order.id;
}

/**
 * Update an existing order (by orderId) or create a new one.
 * Used for COMMANDE_MODIFIEE and for re-confirming after cancellation.
 */
async function updateOrCreateOrder(
  connection: any,
  contactId: string,
  contactName: string | null,
  data: any,
  existingOrderId?: string
): Promise<string> {
  const allProducts = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const items = (data.produits || []).map((item: any) => {
    const lower = (item.nom ?? '').toLowerCase();
    let found = allProducts.find((p) => p.name.toLowerCase() === lower);
    if (!found && lower.length >= 4) {
      found = allProducts.find(
        (p) => p.name.toLowerCase().includes(lower) || (p.name.length >= 4 && lower.includes(p.name.toLowerCase()))
      );
    }
    return { name: item.nom || 'Produit', quantity: item.quantite || 1, price: found?.price || item.prix || 0, productId: found?.id || null };
  });

  const total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ') || contactName || 'Client';
  const notes = `Wilaya: ${data.wilaya || ''} — Commune: ${data.commune || ''}`;

  if (existingOrderId) {
    // Delete old items and replace with new ones
    await prisma.orderItem.deleteMany({ where: { orderId: existingOrderId } });
    await prisma.order.update({
      where: { id: existingOrderId },
      data: {
        contactName: fullName,
        contactPhone: data.telephone || null,
        totalAmount: total,
        notes,
        status: 'PENDING',
        items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) },
      },
    });
    console.log(`[Telegram] Order updated: ${existingOrderId} for ${fullName}`);
    return existingOrderId;
  } else {
    // Find most recent PENDING order for this contact and update it
    const latest = await prisma.order.findFirst({
      where: { connectionId: connection.id, contactId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      await prisma.orderItem.deleteMany({ where: { orderId: latest.id } });
      await prisma.order.update({
        where: { id: latest.id },
        data: {
          contactName: fullName,
          contactPhone: data.telephone || null,
          totalAmount: total,
          notes,
          items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) },
        },
      });
      console.log(`[Telegram] Order modified in place: ${latest.id} for ${fullName}`);
      return latest.id;
    } else {
      return saveOrderFromBot(connection, contactId, contactName, data);
    }
  }
}

