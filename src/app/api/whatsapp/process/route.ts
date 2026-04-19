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
  type EcotrackState,
} from '@/lib/ecotrack';

// Internal endpoint called by the WhatsApp microservice
// Authenticated via WHATSAPP_SERVICE_SECRET header

export async function POST(req: NextRequest) {
  // Verify secret
  const secret = req.headers.get('x-whatsapp-secret');
  if (!secret || secret !== process.env.WHATSAPP_SERVICE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    connectionId,
    contactId,        // WhatsApp JID e.g. "213xxxxxxxx@s.whatsapp.net"
    contactName,      // notifyName
    content,          // text content or "[Vocal]: transcript" or "[Image reçue]"
    contentType,      // "text" | "voice" | "image"
    audioBase64,      // present when contentType === "voice"
    audioMime,        // e.g. "audio/ogg"
    profilePhotoUrl,  // profile pic URL from WA (temporary, refreshed every hour)
  } = body as {
    connectionId: string;
    contactId: string;
    contactName: string | null;
    content: string;
    contentType: 'text' | 'voice' | 'image';
    audioBase64?: string;
    audioMime?: string;
    profilePhotoUrl?: string;
  };

  if (!connectionId || !contactId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Build metadata merging existing data with new profile photo (refresh every hour)
  async function buildWAMetadata(): Promise<Record<string, any>> {
    const existing = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId, contactId } },
      select: { metadata: true },
    });
    const existingMeta = (existing?.metadata as Record<string, any> | null) ?? {};
    const lastFetch = existingMeta.lastPhotoFetch ? Number(existingMeta.lastPhotoFetch) : 0;
    const needsRefresh = Date.now() - lastFetch > 60 * 60 * 1000;

    const newPhoto = profilePhotoUrl && needsRefresh ? profilePhotoUrl : (existingMeta.profilePhotoUrl ?? undefined);
    return {
      ...existingMeta,
      ...(newPhoto ? { profilePhotoUrl: newPhoto } : {}),
      ...(profilePhotoUrl && needsRefresh ? { lastPhotoFetch: Date.now() } : {}),
    };
  }

  const connection = await prisma.connection.findFirst({
    where: { id: connectionId, platform: 'WHATSAPP', isActive: true },
    include: {
      predefinedMessages: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      detailResponses: { where: { isActive: true } },
    },
  });

  if (!connection) return NextResponse.json({ reply: null });
  if (connection.isSuspended) return NextResponse.json({ reply: null });

  const user = await prisma.user.findUnique({ where: { id: connection.userId } });
  if (!user || user.isBanned) return NextResponse.json({ reply: null });

  const ecoRawToken = (connection as any).ecotrackToken as string | null;
  const ecoUrl = (connection as any).ecotrackUrl as string | null;
  const ecoEnabled = !!(ecoRawToken && ecoUrl);

  // ── Confirmation reply detection ─────────────────────────────────────────
  if (contentType === 'text' && content) {
    const lower = content.toLowerCase().trim();
    const isYes = /^(oui|yes|confirme|confirm|ok|d'accord|dacord|yep|ouii|ouiii|ouais|correct|exact|c'est bon|cest bon|c bon|je confirme|valide|validé|accepte|j'accepte)/.test(lower);
    const isNo  = /^(non|no|annule|cancel|annuler|pas bon|faux|incorrect|je refuse|refuse|nope|nan|naan)/.test(lower);

    if (isYes || isNo) {
      let skipConfirmation = false;
      if (ecoEnabled) {
        const ctxEco = await prisma.contactContext.findUnique({
          where: { connectionId_contactId: { connectionId: connection.id, contactId } },
          select: { metadata: true },
        });
        skipConfirmation = !!(ctxEco?.metadata as any)?.ecotrackState;
      }

      if (!skipConfirmation) {
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
            const autoShip = (connection as any).ecotrackAutoShip as boolean;
            if (autoShip && ecoEnabled && pendingOrder.ecotrackTracking) {
              try {
                const { shipEcotrackOrder } = await import('@/lib/ecotrack');
                const shipped = await shipEcotrackOrder(ecoUrl!, decrypt(ecoRawToken!), pendingOrder.ecotrackTracking);
                if (shipped) {
                  newStatus = 'SHIPPED';
                  replyMsg = `✅ Commande *#${pendingOrder.id.slice(-6).toUpperCase()}* confirmée et *expédiée* ! 🚚\n📦 Tracking : *${pendingOrder.ecotrackTracking}*\n\nMerci pour votre confiance ! 🎉`;
                }
              } catch (e) { console.error('[WA] Auto-ship error', e); }
            }
            if (!replyMsg) {
              replyMsg = `✅ Votre commande *#${pendingOrder.id.slice(-6).toUpperCase()}* a été *confirmée* avec succès ! Merci pour votre confiance. 🎉`;
              if (pendingOrder.ecotrackTracking) replyMsg += `\n📦 Tracking : *${pendingOrder.ecotrackTracking}*`;
            }
          } else {
            replyMsg = `❌ Votre commande *#${pendingOrder.id.slice(-6).toUpperCase()}* a été *annulée*. N'hésitez pas à nous recontacter si vous changez d'avis.`;
            if (pendingOrder.ecotrackTracking && ecoEnabled) {
              try {
                const { deleteEcotrackOrder } = await import('@/lib/ecotrack');
                await deleteEcotrackOrder(ecoUrl!, decrypt(ecoRawToken!), pendingOrder.ecotrackTracking);
              } catch (e) { console.error('[WA] Delete order error', e); }
            }
          }

          await prisma.order.update({ where: { id: pendingOrder.id }, data: { status: newStatus } });
          const conv = await getOrCreateConversation({ connectionId: connection.id, contactId, platform: 'WHATSAPP', contactName });
          await upsertContactContext(connection.id, contactId, { contactName, metadata: await buildWAMetadata() });
          await saveInboundOnly({ conversationId: conv.id, content, type: 'text' });
          return NextResponse.json({ reply: replyMsg });
        }
      }
    }
  }

  // ── Conversation ─────────────────────────────────────────────────────────
  const conversation = await getOrCreateConversation({
    connectionId: connection.id,
    contactId,
    platform: 'WHATSAPP',
    contactName,
  });

  if (conversation.isSuspended) return NextResponse.json({ reply: null });

  let responseText = '';
  let tokensRequired = 1;
  let messageType: 'text' | 'voice' | 'image' = contentType;
  let inboundContent = content;

  // ── Voice transcription (done server-side here) ───────────────────────────
  if (contentType === 'voice') {
    tokensRequired = 2;
    if (!user.unlimitedTokens && user.tokenBalance < 2) {
      return NextResponse.json({ reply: '⚠️ Solde insuffisant pour traiter un message vocal.' });
    }
    if (audioBase64 && audioMime) {
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const transcript = await transcribeAudio(audioBuffer, audioMime as any);
        if (!transcript) return NextResponse.json({ reply: null });
        inboundContent = `[Vocal]: ${transcript}`;
        logCost(user.id, 'whisper');
      } catch (err) {
        console.error('[WA] Voice transcription error', err);
        return NextResponse.json({ reply: "Je n'ai pas pu traiter votre message vocal. Essayez en texte." });
      }
    } else {
      return NextResponse.json({ reply: null });
    }
  }

  // ── Token balance check ───────────────────────────────────────────────────
  if (tokensRequired > 0 && !user.unlimitedTokens && user.tokenBalance < tokensRequired) {
    return NextResponse.json({ reply: '⚠️ Solde de jetons insuffisant. Rechargez votre compte sur YelhaDms.' });
  }

  // ── Ecotrack state machine ───────────────────────────────────────────────
  if (ecoEnabled && messageType === 'text' && content) {
    const ctxForEco = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
      select: { metadata: true },
    });
    const metaForEco = (ctxForEco?.metadata as Record<string, any> | null) ?? {};
    const ecoState = metaForEco.ecotrackState as EcotrackState | undefined;

    if (ecoState) {
      const ecoToken = decrypt(ecoRawToken!);
      const ecoDeliveryFee = (connection as any).deliveryFee as number | null ?? 0;
      const result = await handleEcotrackMessage(ecoState, content, ecoToken, ecoUrl!, ecoDeliveryFee);
      if (result.handled) {
        const newMeta = { ...metaForEco, ecotrackState: result.newState ?? undefined, ...(profilePhotoUrl ? { profilePhotoUrl } : {}) };
        await upsertContactContext(connection.id, contactId, { contactName, metadata: newMeta });
        await saveInboundOnly({ conversationId: conversation.id, content, type: 'text' });
        return NextResponse.json({ reply: result.responseText || null });
      }
    }
  }

  // ── Predefined messages ───────────────────────────────────────────────────
  if (messageType === 'text' && content) {
    const lower = content.toLowerCase();
    const predefined = connection.predefinedMessages.find((m) =>
      m.keywords.some((k) => lower.includes(k.toLowerCase()))
    );
    if (predefined) {
      responseText = predefined.response;
      tokensRequired = 0;
    }
  }

  // ── DeepSeek AI ───────────────────────────────────────────────────────────
  if (!responseText) {
    const contactCtx = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
    });

    const history = await getRecentHistory(conversation.id);
    const isFirstMessage = history.length === 0;
    const systemPrompt = await buildWASystemPrompt(
      connection,
      buildContactContextString(contactCtx),
      isFirstMessage,
      (connection as any).deliveryFee ?? 0,
      (connection as any).deliveryPricingText ?? null,
    );

    const aiMessages = [
      ...history,
      { role: 'user' as const, content: inboundContent },
    ];

    let rawResponse: string;
    try {
      rawResponse = await callDeepSeek(aiMessages, systemPrompt);
    } catch (err) {
      console.error('[WA] DeepSeek error', err);
      return NextResponse.json({ reply: "Désolé, une erreur technique s'est produite. Réessayez dans un instant." });
    }

    // ── HORS_SUJET ──────────────────────────────────────────────────────────
    if (rawResponse.startsWith('[HORS_SUJET]')) {
      responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
      const blocked = await handleSpam(conversation.id);
      if (blocked) {
        await saveInboundOnly({ conversationId: conversation.id, content: inboundContent, type: messageType });
        await upsertContactContext(connection.id, contactId, { contactName, metadata: await buildWAMetadata() });
        return NextResponse.json({ reply: responseText || null });
      }
    }

    // ── COMMANDE_ANNULEE ────────────────────────────────────────────────────
    else if (rawResponse.includes('[COMMANDE_ANNULEE]')) {
      responseText = rawResponse.replace('[COMMANDE_ANNULEE]', '').trim();
      try {
        const latestOrder = await prisma.order.findFirst({
          where: { connectionId: connection.id, contactId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (latestOrder) {
          await prisma.order.update({ where: { id: latestOrder.id }, data: { status: 'CANCELLED' } });
          if (latestOrder.ecotrackTracking && ecoEnabled) {
            try {
              const { deleteEcotrackOrder } = await import('@/lib/ecotrack');
              await deleteEcotrackOrder(ecoUrl!, decrypt(ecoRawToken!), latestOrder.ecotrackTracking);
            } catch (e) { console.error('[WA] Delete on annulation error', e); }
          }
        }
        if (ecoEnabled) {
          const ctxCancel = await prisma.contactContext.findUnique({
            where: { connectionId_contactId: { connectionId: connection.id, contactId } },
            select: { metadata: true },
          });
          if ((ctxCancel?.metadata as any)?.ecotrackState) {
            const clearedMeta = { ...(ctxCancel!.metadata as Record<string, any>) };
            delete clearedMeta.ecotrackState;
            await upsertContactContext(connection.id, contactId, { contactName, metadata: clearedMeta });
          }
        }
      } catch (e) { console.error('[WA] Order cancellation error', e); }
    }

    // ── COMMANDE_MODIFIEE ────────────────────────────────────────────────────
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
        } catch (e) { console.error('[WA] Order modify error', e); }
      } else {
        responseText = rawResponse;
      }
    }

    // ── COMMANDE_CONFIRMEE ────────────────────────────────────────────────────
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
            const recentCancelled = await prisma.order.findFirst({
              where: {
                connectionId: connection.id,
                contactId,
                status: 'CANCELLED',
                updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
              },
              orderBy: { updatedAt: 'desc' },
            });
            let newOrderId: string;
            if (recentCancelled) {
              newOrderId = await updateOrCreateOrder(connection, contactId, contactName, orderData, recentCancelled.id);
            } else {
              newOrderId = await saveOrderFromBot(connection, contactId, contactName, orderData);
            }

            // ── Ecotrack location validation ─────────────────────────────
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
                  const currCtx = await prisma.contactContext.findUnique({
                    where: { connectionId_contactId: { connectionId: connection.id, contactId } },
                    select: { metadata: true },
                  });
                  const currMeta = (currCtx?.metadata as Record<string, any> | null) ?? {};
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
                  const currCtx2 = await prisma.contactContext.findUnique({
                    where: { connectionId_contactId: { connectionId: connection.id, contactId } },
                    select: { metadata: true },
                  });
                  const currMeta2 = (currCtx2?.metadata as Record<string, any> | null) ?? {};
                  await upsertContactContext(connection.id, contactId, { contactName, metadata: { ...currMeta2, ecotrackState: newState } });
                  responseText = buildLocationSuggestionsMsg(suggestions, orderData.commune || '', orderData.wilaya || '');
                } else {
                  // No match at all — ask user to retype address manually
                  const newState: EcotrackState = {
                    step: 'awaiting_address_input',
                    orderId: newOrderId,
                    orderData,
                    wilayaId: 0,
                    wilayaName: '',
                    communeName: '',
                    codePostal: '',
                    hasStopDesk: false,
                    retryCount: 0,
                  };
                  const currCtx3 = await prisma.contactContext.findUnique({
                    where: { connectionId_contactId: { connectionId: connection.id, contactId } },
                    select: { metadata: true },
                  });
                  const currMeta3 = (currCtx3?.metadata as Record<string, any> | null) ?? {};
                  await upsertContactContext(connection.id, contactId, { contactName, metadata: { ...currMeta3, ecotrackState: newState } });
                  responseText = `📍 Je n'ai pas pu localiser *${orderData.wilaya || ''}* / *${orderData.commune || ''}*.\n\nVeuillez saisir votre wilaya et commune dans ce format :\n*Wilaya / Commune*\nExemple : *Alger / Bab El Oued*`;
                }
              } catch (ecoErr) { console.error('[WA] Ecotrack location error', ecoErr); }
            }
          } catch (e) { console.error('[WA] Order parse error', e); }
        } else {
          responseText = rawResponse;
        }
      } else if (!rawResponse.startsWith('[HORS_SUJET]')) {
        responseText = rawResponse;
      }
    }
  }

  // ── ORDER_STATUS_QUERY ────────────────────────────────────────────────────
  if (responseText.includes('[ORDER_STATUS_QUERY]')) {
    responseText = responseText.replace('[ORDER_STATUS_QUERY]', '').trim();
    try {
      const latestOrder = await prisma.order.findFirst({
        where: { connectionId: connection.id, contactId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, trackingCode: true, ecotrackTracking: true, totalAmount: true, createdAt: true },
      });
      if (latestOrder) {
        const statusLabels: Record<string, string> = {
          PENDING: '⏳ En attente de confirmation',
          CONFIRMED: '✅ Confirmée',
          PROCESSING: '🔄 En cours de traitement',
          SHIPPED: '🚚 Expédiée',
          DELIVERED: '📦 Livrée',
          CANCELLED: '❌ Annulée',
          RETURNED: '↩️ Retournée',
        };
        const tracking = latestOrder.ecotrackTracking || latestOrder.trackingCode;
        responseText = `📦 *Commande #${latestOrder.id.slice(-6).toUpperCase()}*\n` +
          `Statut : ${statusLabels[latestOrder.status] || latestOrder.status}\n` +
          (tracking ? `Tracking : *${tracking}*\n` : '') +
          (latestOrder.totalAmount ? `Total : *${latestOrder.totalAmount.toLocaleString('fr-DZ')} DA*\n` : '') +
          `Date : ${latestOrder.createdAt.toLocaleDateString('fr-DZ')}`;
      } else {
        responseText = `Aucune commande trouvée pour votre compte.`;
      }
    } catch (e) { console.error('[ORDER_STATUS] Error', e); }
  }

  if (!responseText) return NextResponse.json({ reply: null });

  // ── Facturer tokens ───────────────────────────────────────────────────────
  if (tokensRequired > 0) {
    logCost(user.id, messageType === 'voice' ? 'deepseek_voice' : 'deepseek_text');
  }

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
      return NextResponse.json({ reply: '⚠️ Solde de jetons insuffisant.' });
    }
    await prisma.tokenTransaction.create({
      data: {
        userId: connection.userId,
        type: 'USAGE',
        amount: -tokensRequired,
        balance: newBalance,
        description: `WhatsApp — ${messageType}`,
      },
    });

    if (newBalance <= 100) {
      const freshUser = await prisma.user.findUnique({ where: { id: connection.userId }, select: { lowTokenAlertSent: true, email: true, name: true } });
      if (freshUser && !freshUser.lowTokenAlertSent) {
        await prisma.user.update({ where: { id: connection.userId }, data: { lowTokenAlertSent: true } });
        try { await sendLowTokenEmail(freshUser.email, freshUser.name ?? '', newBalance); } catch {}
      }
    }
  }

  // ── Save conversation ─────────────────────────────────────────────────────
  try {
    await saveMessageExchange({
      conversationId: conversation.id,
      inbound: { content: inboundContent, type: messageType, tokensUsed: tokensRequired },
      outbound: { content: responseText },
    });
    await upsertContactContext(connection.id, contactId, { contactName, metadata: await buildWAMetadata() });
  } catch (err) { console.error('[WA] Save error', err); }

  return NextResponse.json({ reply: responseText });
}

async function buildWASystemPrompt(connection: any, contactContext: string, isFirstMessage: boolean, deliveryFee = 0, deliveryPricingText?: string | null): Promise<string> {
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
    deliveryFee,
  });

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

${productDetailsStr ? `DESCRIPTIONS (à n'utiliser QUE si le client demande des détails) :\n${productDetailsStr}` : ''}

${deliveryPricingText && deliveryPricingText.trim() ? `TARIFICATION LIVRAISON PAR WILAYA :
${deliveryPricingText.trim()}
- Utilise ce tableau pour calculer les frais de livraison selon la wilaya du client.
- Si la wilaya n'est pas listée, utilise le tarif "Autres" ou la valeur par défaut.
- Inclus le frais de livraison dans le récapitulatif de commande.` : ''}`;
}

async function saveOrderFromBot(connection: any, contactId: string, contactName: string | null, data: any): Promise<string> {
  const allProducts = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const items = (data.produits || []).map((item: any) => {
    const itemNameLower = (item.nom ?? '').toLowerCase();
    let found = allProducts.find((p) => p.name.toLowerCase() === itemNameLower);
    if (!found && itemNameLower.length >= 4) {
      found = allProducts.find(
        (p) => p.name.toLowerCase().includes(itemNameLower) || (p.name.length >= 4 && itemNameLower.includes(p.name.toLowerCase()))
      );
    }
    return { name: item.nom || 'Produit', quantity: item.quantite || 1, price: found?.price || item.prix || 0, productId: found?.id || null };
  });

  const total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ') || contactName || 'Client';
  const notes = `Wilaya: ${data.wilaya || ''} — Commune: ${data.commune || ''}`;
  const autoConfirmDelay = (connection.autoConfirmDelay ?? 0) as number;
  const scheduledConfirmAt = autoConfirmDelay > 0 ? new Date(Date.now() + autoConfirmDelay * 60 * 60 * 1000) : null;

  const order = await prisma.order.create({
    data: {
      userId: connection.userId,
      connectionId: connection.id,
      contactName: fullName,
      contactId,
      contactPhone: data.telephone || null,
      totalAmount: total,
      notes,
      ...(scheduledConfirmAt ? { scheduledConfirmAt } : {}),
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

  return order.id;
}

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
    return existingOrderId;
  }

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
    return latest.id;
  }

  return saveOrderFromBot(connection, contactId, contactName, data);
}
