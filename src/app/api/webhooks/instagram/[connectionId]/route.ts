import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { callDeepSeek, buildSystemPrompt, GLOBAL_SYSTEM_PROMPT } from '@/lib/deepseek';
import { sendLowTokenEmail } from '@/lib/resend';
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
import { sendMessengerMessage } from '@/lib/messenger';

// ── Webhook verification (GET) ────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return new Response('Bad request', { status: 400 });
  }

  const connection = await prisma.connection.findFirst({
    where: { id: params.connectionId, platform: 'INSTAGRAM', isActive: true },
    select: { instagramWebhookVerifyToken: true },
  });

  if (!connection?.instagramWebhookVerifyToken) return new Response('Not found', { status: 404 });

  const storedToken = decrypt(connection.instagramWebhookVerifyToken);
  if (storedToken !== token) return new Response('Forbidden', { status: 403 });

  return new Response(challenge, { status: 200 });
}

// ── Message handler (POST) ────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const body = await req.json();

  // Instagram Graph API webhook payload (same structure as Messenger)
  const entry = body?.entry?.[0];
  if (!entry) return NextResponse.json({ ok: true });

  const messaging = entry?.messaging?.[0];
  if (!messaging) return NextResponse.json({ ok: true });

  // Skip echo messages (from page itself)
  if (messaging.message?.is_echo) return NextResponse.json({ ok: true });

  const senderIgsid: string = messaging.sender?.id;
  const text: string = messaging.message?.text || '';
  if (!senderIgsid || !text) return NextResponse.json({ ok: true });

  const contactId = senderIgsid;
  const contactName: string | null = null;

  const connection = await prisma.connection.findFirst({
    where: { id: params.connectionId, platform: 'INSTAGRAM', isActive: true },
    include: {
      predefinedMessages: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      detailResponses: { where: { isActive: true } },
    },
  });

  if (!connection || !connection.instagramAccessToken) return NextResponse.json({ ok: true });
  if (connection.isSuspended) return NextResponse.json({ ok: true });

  const accessToken = decrypt(connection.instagramAccessToken);

  async function sendMessage(txt: string) {
    await sendMessengerMessage(accessToken, contactId, txt);
  }

  const user = await prisma.user.findUnique({ where: { id: connection.userId } });
  if (!user || user.isBanned) return NextResponse.json({ ok: true });

  // ── Ecotrack connection fields ─────────────────────────────────────────────
  const ecoRawToken = (connection as any).ecotrackToken as string | null;
  const ecoUrl = (connection as any).ecotrackUrl as string | null;
  const ecoEnabled = !!(ecoRawToken && ecoUrl);
  const ecoDeliveryFee = (connection as any).deliveryFee as number ?? 0;

  // ── Conversation ───────────────────────────────────────────────────────────
  const conversation = await getOrCreateConversation({
    connectionId: connection.id,
    contactId,
    platform: 'INSTAGRAM',
    contactName,
  });
  if (conversation.isSuspended) return NextResponse.json({ ok: true });

  const history = await getRecentHistory(conversation.id);
  const isFirstMessage = history.length === 0;

  // ── Welcome message on first contact ──────────────────────────────────────
  if (isFirstMessage && connection.welcomeMessage) {
    await sendMessage(connection.welcomeMessage);
    await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
    await upsertContactContext(connection.id, contactId, { contactName });
    return NextResponse.json({ ok: true });
  }

  // ── Confirmation reply detection ───────────────────────────────────────────
  const lower = text.toLowerCase().trim();
  const isYes = /^(oui|yes|confirme|confirm|ok|d'accord|dacord|ouii|ouiii|ouais|yep|correct|exact|c'est bon|cest bon|c bon|je confirme|valide|validé|accepte|j'accepte)/.test(lower);
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
        where: { connectionId: connection.id, contactId, status: 'PENDING', confirmationSentAt: { not: null } },
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
                replyMsg = `✅ Commande #${pendingOrder.id.slice(-6).toUpperCase()} confirmée et expédiée ! 🚚\nTracking : ${pendingOrder.ecotrackTracking}\n\nMerci pour votre confiance ! 🎉`;
              }
            } catch (e) { console.error('[Instagram] Auto-ship error', e); }
          }
          if (!replyMsg) {
            replyMsg = `✅ Votre commande #${pendingOrder.id.slice(-6).toUpperCase()} a été confirmée ! Merci pour votre confiance. 🎉`;
            if (pendingOrder.ecotrackTracking) replyMsg += `\nTracking : ${pendingOrder.ecotrackTracking}`;
          }
        } else {
          replyMsg = `❌ Votre commande #${pendingOrder.id.slice(-6).toUpperCase()} a été annulée. N'hésitez pas à nous recontacter.`;
          if (pendingOrder.ecotrackTracking && ecoEnabled) {
            try {
              const { deleteEcotrackOrder } = await import('@/lib/ecotrack');
              await deleteEcotrackOrder(ecoUrl!, decrypt(ecoRawToken!), pendingOrder.ecotrackTracking);
            } catch (e) { console.error('[Instagram] Ecotrack delete error', e); }
          }
        }

        await prisma.order.update({ where: { id: pendingOrder.id }, data: { status: newStatus } });
        await sendMessage(replyMsg);
        await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
        await upsertContactContext(connection.id, contactId, { contactName });
        return NextResponse.json({ ok: true });
      }
    }
  }

  // ── Ecotrack state machine ─────────────────────────────────────────────────
  if (ecoEnabled) {
    const ctxForEco = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
      select: { metadata: true },
    });
    const metaForEco = (ctxForEco?.metadata as Record<string, any> | null) ?? {};
    const ecoState = metaForEco.ecotrackState as EcotrackState | undefined;

    if (ecoState) {
      const ecoToken = decrypt(ecoRawToken!);
      const result = await handleEcotrackMessage(ecoState, text, ecoToken, ecoUrl!, ecoDeliveryFee);
      if (result.handled) {
        const newMeta = { ...metaForEco, ecotrackState: result.newState ?? undefined };
        await upsertContactContext(connection.id, contactId, { contactName, metadata: newMeta });
        if (result.responseText) await sendMessage(result.responseText);
        await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
        return NextResponse.json({ ok: true });
      }
    }
  }

  // ── Token check ────────────────────────────────────────────────────────────
  if (!user.unlimitedTokens && user.tokenBalance < 1) return NextResponse.json({ ok: true });

  let responseText = '';
  let tokensRequired = 1;

  // ── Réponses prédéfinies (0 token) ────────────────────────────────────────
  const predefined = connection.predefinedMessages.find((m) =>
    m.keywords.some((k) => lower.includes(k.toLowerCase()))
  );
  if (predefined) { responseText = predefined.response; tokensRequired = 0; }

  // ── Appel IA ───────────────────────────────────────────────────────────────
  if (!responseText) {
    const contactCtx = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId: connection.id, contactId } },
    });
    const systemPrompt = await buildIgSystemPrompt(connection, buildContactContextString(contactCtx), isFirstMessage, ecoDeliveryFee);
    const aiMessages = [...history, { role: 'user' as const, content: text }];
    const rawResponse = await callDeepSeek(aiMessages, systemPrompt);

    if (rawResponse.startsWith('[HORS_SUJET]')) {
      responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
      const blocked = await handleSpam(conversation.id);
      if (blocked) {
        await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
        await upsertContactContext(connection.id, contactId, { contactName });
        if (responseText) await sendMessage(responseText);
        return NextResponse.json({ ok: true });
      }
    } else if (rawResponse.includes('[COMMANDE_ANNULEE]')) {
      responseText = rawResponse.replace('[COMMANDE_ANNULEE]', '').trim();
      try {
        const latestOrder = await prisma.order.findFirst({
          where: { connectionId: connection.id, contactId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (latestOrder) {
          await prisma.order.update({ where: { id: latestOrder.id }, data: { status: 'CANCELLED' } });
          if (latestOrder.ecotrackTracking && ecoEnabled) {
            try { const { deleteEcotrackOrder } = await import('@/lib/ecotrack'); await deleteEcotrackOrder(ecoUrl!, decrypt(ecoRawToken!), latestOrder.ecotrackTracking); } catch {}
          }
        }
        if (ecoEnabled) {
          const ctxCancel = await prisma.contactContext.findUnique({ where: { connectionId_contactId: { connectionId: connection.id, contactId } }, select: { metadata: true } });
          if ((ctxCancel?.metadata as any)?.ecotrackState) {
            const clearedMeta = { ...(ctxCancel!.metadata as Record<string, any>) };
            delete clearedMeta.ecotrackState;
            await upsertContactContext(connection.id, contactId, { contactName, metadata: clearedMeta });
          }
        }
      } catch (e) { console.error('[Instagram] Cancellation error', e); }
    } else if (rawResponse.includes('[COMMANDE_MODIFIEE:')) {
      const tagStart = rawResponse.indexOf('[COMMANDE_MODIFIEE:');
      const jsonStart = tagStart + '[COMMANDE_MODIFIEE:'.length;
      const tagEnd = rawResponse.lastIndexOf('}]');
      if (tagEnd > jsonStart) {
        responseText = (rawResponse.slice(0, tagStart) + rawResponse.slice(tagEnd + 2)).trim();
        try { await updateOrCreateOrder(connection, contactId, contactName, JSON.parse(rawResponse.slice(jsonStart, tagEnd + 1))); } catch (e) { console.error('[Instagram] Order modify error', e); }
      } else { responseText = rawResponse; }
    } else {
      const tagStart = rawResponse.indexOf('[COMMANDE_CONFIRMEE:');
      if (tagStart !== -1) {
        const jsonStart = tagStart + '[COMMANDE_CONFIRMEE:'.length;
        const tagEnd = rawResponse.lastIndexOf('}]');
        if (tagEnd > jsonStart) {
          responseText = (rawResponse.slice(0, tagStart) + rawResponse.slice(tagEnd + 2)).trim();
          try {
            const orderData = JSON.parse(rawResponse.slice(jsonStart, tagEnd + 1));
            const recentCancelled = await prisma.order.findFirst({
              where: { connectionId: connection.id, contactId, status: 'CANCELLED', updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
              orderBy: { updatedAt: 'desc' },
            });
            const newOrderId = recentCancelled
              ? await updateOrCreateOrder(connection, contactId, contactName, orderData, recentCancelled.id)
              : await saveOrderFromBot(connection, contactId, contactName, orderData);

            if (ecoEnabled && newOrderId) {
              try {
                const ecoToken = decrypt(ecoRawToken!);
                const { found, suggestions } = await validateLocation(ecoUrl!, ecoToken, orderData.wilaya || '', orderData.commune || '');
                const contactCtxFresh = await prisma.contactContext.findUnique({ where: { connectionId_contactId: { connectionId: connection.id, contactId } } });
                if (found) {
                  const newState: EcotrackState = { step: 'awaiting_delivery_type', orderId: newOrderId, orderData, wilayaId: found.wilayaId, wilayaName: found.wilayaName, communeName: found.communeName, codePostal: found.codePostal, hasStopDesk: found.hasStopDesk };
                  await upsertContactContext(connection.id, contactId, { contactName, metadata: { ...((contactCtxFresh?.metadata as Record<string, any> | null) ?? {}), ecotrackState: newState } });
                  responseText = `✅ Commande enregistrée !\n\n📍 Livraison à ${found.communeName}, ${found.wilayaName}.\n\nComment souhaitez-vous recevoir votre colis ?\n1️⃣ Livraison à domicile\n${found.hasStopDesk ? '2️⃣ Retrait en Stop Desk (agence)' : '2️⃣ Stop Desk (non disponible dans cette commune)'}`;
                } else if (suggestions.length > 0) {
                  const newState: EcotrackState = { step: 'awaiting_location_confirm', orderId: newOrderId, orderData, wilayaId: suggestions[0].wilayaId, wilayaName: suggestions[0].wilayaName, communeName: suggestions[0].communeName, codePostal: suggestions[0].codePostal, hasStopDesk: suggestions[0].hasStopDesk, suggestions };
                  await upsertContactContext(connection.id, contactId, { contactName, metadata: { ...((contactCtxFresh?.metadata as Record<string, any> | null) ?? {}), ecotrackState: newState } });
                  responseText = buildLocationSuggestionsMsg(suggestions, orderData.commune || '', orderData.wilaya || '');
                }
              } catch (ecoErr) { console.error('[Instagram][Ecotrack] Error', ecoErr); }
            }
          } catch (e) { console.error('[Instagram] Order parse error', e); }
        } else { responseText = rawResponse; }
      } else if (!rawResponse.startsWith('[HORS_SUJET]')) { responseText = rawResponse; }
    }

    if (responseText.includes('[ORDER_STATUS_QUERY]')) {
      responseText = responseText.replace('[ORDER_STATUS_QUERY]', '').trim();
      try {
        const latestOrder = await prisma.order.findFirst({
          where: { connectionId: connection.id, contactId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, trackingCode: true, ecotrackTracking: true, totalAmount: true, createdAt: true },
        });
        if (latestOrder) {
          const statusLabels: Record<string, string> = { PENDING: '⏳ En attente', CONFIRMED: '✅ Confirmée', PROCESSING: '🔄 En traitement', SHIPPED: '🚚 Expédiée', DELIVERED: '📦 Livrée', CANCELLED: '❌ Annulée', RETURNED: '↩️ Retournée' };
          const tracking = latestOrder.ecotrackTracking || latestOrder.trackingCode;
          responseText = `📦 Commande #${latestOrder.id.slice(-6).toUpperCase()}\nStatut : ${statusLabels[latestOrder.status] || latestOrder.status}\n` + (tracking ? `Tracking : ${tracking}\n` : '') + (latestOrder.totalAmount ? `Total : ${latestOrder.totalAmount.toLocaleString('fr-DZ')} DA\n` : '') + `Date : ${latestOrder.createdAt.toLocaleDateString('fr-DZ')}`;
        } else { responseText = `Aucune commande trouvée pour votre compte.`; }
      } catch (e) { console.error('[Instagram][ORDER_STATUS] Error', e); }
    }
  }

  if (!responseText) return NextResponse.json({ ok: true });

  if (tokensRequired > 0) logCost(user.id, 'deepseek_text');
  if (tokensRequired > 0 && !user.unlimitedTokens) {
    let newBalance: number;
    try {
      const updated = await prisma.user.update({
        where: { id: connection.userId, tokenBalance: { gte: tokensRequired } },
        data: { tokenBalance: { decrement: tokensRequired } },
        select: { tokenBalance: true },
      });
      newBalance = updated.tokenBalance;
    } catch {
      await sendMessage('⚠️ Solde de jetons insuffisant.');
      return NextResponse.json({ ok: true });
    }
    await prisma.tokenTransaction.create({ data: { userId: connection.userId, type: 'USAGE', amount: -tokensRequired, balance: newBalance, description: 'Instagram DM' } });
    if (newBalance <= 100) {
      const freshUser = await prisma.user.findUnique({ where: { id: connection.userId }, select: { lowTokenAlertSent: true, email: true, name: true } });
      if (freshUser && !freshUser.lowTokenAlertSent) {
        await prisma.user.update({ where: { id: connection.userId }, data: { lowTokenAlertSent: true } });
        try { await sendLowTokenEmail(freshUser.email, freshUser.name ?? '', newBalance); } catch {}
      }
    }
  }

  await sendMessage(responseText);
  try {
    await saveMessageExchange({ conversationId: conversation.id, inbound: { content: text, type: 'text', tokensUsed: tokensRequired }, outbound: { content: responseText } });
    await upsertContactContext(connection.id, contactId, { contactName });
  } catch (err) { console.error('[Instagram] Save error', err); }

  return NextResponse.json({ ok: true });
}

async function buildIgSystemPrompt(connection: any, contactContext: string, isFirstMessage: boolean, deliveryFee = 0): Promise<string> {
  const predefinedStr = connection.predefinedMessages.map((m: any) => `Mots-clés: ${m.keywords.join(', ')}\nRéponse: ${m.response}`).join('\n---\n');
  const detailStr = (connection.detailResponses || []).map((d: any) => `Type: ${d.questionType}\nRéponse à adapter: ${d.response}`).join('\n---\n');
  const products = await prisma.product.findMany({ where: { userId: connection.userId, isActive: true }, select: { name: true, description: true, price: true }, take: 50 });
  const productsStr = products.length > 0 ? products.map((p: any) => `• ${p.name}${p.price ? ` — ${p.price} DA` : ''}`).join('\n') : 'Aucun produit configuré.';
  const prompt = buildSystemPrompt({ botName: connection.botName || 'Assistant', businessName: connection.businessName || connection.name || 'la boutique', botPersonality: connection.botPersonality, predefinedResponses: predefinedStr || 'Aucune', customInstructions: connection.customInstructions || 'Aucune', globalPrompt: GLOBAL_SYSTEM_PROMPT, contactContext, detailResponses: detailStr, isFirstMessage, commerceType: connection.commerceType || 'products', deliveryFee });
  const productDetailsStr = products.filter((p: any) => p.description).map((p: any) => `• ${p.name} : ${p.description}`).join('\n');
  return prompt + `\n\n══════════════════════════════════════\nCATALOGUE PRODUITS (Instagram DM)\n══════════════════════════════════════\n${productsStr}\n\nRÈGLES PRODUITS (STRICTES) :\n- Donne nom et prix uniquement par défaut.\n- ❌ NE MENTIONNE JAMAIS le stock sauf si explicitement demandé.\n- ❌ NE donne PAS la description sauf si le client demande des détails.\n- ❌ N'invente JAMAIS un produit absent de cette liste.\n\n${productDetailsStr ? `DESCRIPTIONS (uniquement si demandé) :\n${productDetailsStr}` : ''}`;
}

async function saveOrderFromBot(connection: any, contactId: string, contactName: string | null, data: any): Promise<string> {
  const allProducts = await prisma.product.findMany({ where: { userId: connection.userId, isActive: true }, select: { id: true, name: true, price: true } });
  const items = (data.produits || []).map((item: any) => {
    const lower = (item.nom ?? '').toLowerCase();
    let found = allProducts.find((p) => p.name.toLowerCase() === lower);
    if (!found && lower.length >= 4) found = allProducts.find((p) => p.name.toLowerCase().includes(lower) || (p.name.length >= 4 && lower.includes(p.name.toLowerCase())));
    return { name: item.nom || 'Produit', quantity: item.quantite || 1, price: found?.price || item.prix || 0, productId: found?.id || null };
  });
  const total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ') || contactName || 'Client';
  const autoConfirmDelay = (connection.autoConfirmDelay ?? 0) as number;
  const scheduledConfirmAt = autoConfirmDelay > 0 ? new Date(Date.now() + autoConfirmDelay * 3600000) : null;
  const order = await prisma.order.create({
    data: { userId: connection.userId, connectionId: connection.id, contactName: fullName, contactId, contactPhone: data.telephone || null, totalAmount: total, notes: `Wilaya: ${data.wilaya || ''} — Commune: ${data.commune || ''}`, ...(scheduledConfirmAt ? { scheduledConfirmAt } : {}), items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) } },
  });
  return order.id;
}

async function updateOrCreateOrder(connection: any, contactId: string, contactName: string | null, data: any, existingOrderId?: string): Promise<string> {
  const allProducts = await prisma.product.findMany({ where: { userId: connection.userId, isActive: true }, select: { id: true, name: true, price: true } });
  const items = (data.produits || []).map((item: any) => {
    const lower = (item.nom ?? '').toLowerCase();
    let found = allProducts.find((p) => p.name.toLowerCase() === lower);
    if (!found && lower.length >= 4) found = allProducts.find((p) => p.name.toLowerCase().includes(lower) || (p.name.length >= 4 && lower.includes(p.name.toLowerCase())));
    return { name: item.nom || 'Produit', quantity: item.quantite || 1, price: found?.price || item.prix || 0, productId: found?.id || null };
  });
  const total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ') || contactName || 'Client';
  const notes = `Wilaya: ${data.wilaya || ''} — Commune: ${data.commune || ''}`;
  if (existingOrderId) {
    await prisma.orderItem.deleteMany({ where: { orderId: existingOrderId } });
    await prisma.order.update({ where: { id: existingOrderId }, data: { contactName: fullName, contactPhone: data.telephone || null, totalAmount: total, notes, status: 'PENDING', items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) } } });
    return existingOrderId;
  }
  const latest = await prisma.order.findFirst({ where: { connectionId: connection.id, contactId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  if (latest) {
    await prisma.orderItem.deleteMany({ where: { orderId: latest.id } });
    await prisma.order.update({ where: { id: latest.id }, data: { contactName: fullName, contactPhone: data.telephone || null, totalAmount: total, notes, items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) } } });
    return latest.id;
  }
  return saveOrderFromBot(connection, contactId, contactName, data);
}
