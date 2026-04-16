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
  loginInstagram,
  sendInstagramPrivateDM,
  getNewInstagramMessages,
  getInstagramProfilePicUrl,
} from '@/lib/instagram-private';
import { mirrorImageToR2 } from '@/lib/r2';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    where: {
      platform: 'INSTAGRAM',
      isActive: true,
      isSuspended: false,
      instagramSessionData: { not: null },
    },
    include: {
      predefinedMessages: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      detailResponses: { where: { isActive: true } },
    },
  });

  const results: { id: string; processed: number; error?: string }[] = [];

  for (const connection of connections) {
    let processed = 0;
    try {
      let sessionData = connection.instagramSessionData!;
      const afterTs = connection.instagramLastMessageTs ?? BigInt(0);

      // Fetch new messages — re-login if session expired
      let messages;
      try {
        messages = await getNewInstagramMessages(sessionData, afterTs);
      } catch {
        if (!connection.instagramPassword) {
          results.push({ id: connection.id, processed: 0, error: 'Session expired, no password stored' });
          continue;
        }
        const pwd = decrypt(connection.instagramPassword);
        sessionData = await loginInstagram(connection.instagramUsername!, pwd);
        await prisma.connection.update({
          where: { id: connection.id },
          data: { instagramSessionData: sessionData },
        });
        messages = await getNewInstagramMessages(sessionData, afterTs);
      }

      if (messages.length === 0) {
        results.push({ id: connection.id, processed: 0 });
        continue;
      }

      const user = await prisma.user.findUnique({ where: { id: connection.userId } });
      if (!user || user.isBanned) {
        results.push({ id: connection.id, processed: 0, error: 'User banned/not found' });
        continue;
      }

      let maxTs = afterTs;

      for (const msg of messages) {
        if (msg.timestampMicros > maxTs) maxTs = msg.timestampMicros;

        const contactId = msg.senderId;
        const text = msg.text.trim();
        if (!text) continue;

        // ── Solde ─────────────────────────────────────────────────────────────
        if (!user.unlimitedTokens && user.tokenBalance < 1) continue;

        // ── Conversation ──────────────────────────────────────────────────────
        const conversation = await getOrCreateConversation({
          connectionId: connection.id,
          contactId,
          platform: 'INSTAGRAM',
        });
        if (conversation.isSuspended) continue;

        // ── Profil photo → R2 ─────────────────────────────────────────────────
        await refreshProfilePhoto(sessionData, connection.id, contactId);

        // ── Welcome message (first ever contact) ──────────────────────────────
        const history = await getRecentHistory(conversation.id);
        const isFirstMessage = history.length === 0;
        if (isFirstMessage && connection.welcomeMessage) {
          await sendInstagramPrivateDM(sessionData, contactId, connection.welcomeMessage);
          await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
          const ctxMeta = await getContactMeta(connection.id, contactId);
          await upsertContactContext(connection.id, contactId, { contactName: null, metadata: ctxMeta });
          continue;
        }

        let responseText = '';
        let tokensRequired = 1;

        // ── Réponses prédéfinies (0 token) ────────────────────────────────────
        const lower = text.toLowerCase();
        const predefined = connection.predefinedMessages.find((m) =>
          m.keywords.some((k: string) => lower.includes(k.toLowerCase()))
        );
        if (predefined) {
          responseText = predefined.response;
          tokensRequired = 0;
        }

        // ── Appel IA ──────────────────────────────────────────────────────────
        if (!responseText) {
          const contactCtx = await prisma.contactContext.findUnique({
            where: { connectionId_contactId: { connectionId: connection.id, contactId } },
          });
          const systemPrompt = await buildIgSystemPrompt(connection, buildContactContextString(contactCtx), isFirstMessage);
          const aiMessages = [...history, { role: 'user' as const, content: text }];
          const rawResponse = await callDeepSeek(aiMessages, systemPrompt);

          // ── Hors sujet ─────────────────────────────────────────────────────
          if (rawResponse.startsWith('[HORS_SUJET]')) {
            responseText = rawResponse.replace('[HORS_SUJET]', '').trim();
            const blocked = await handleSpam(conversation.id);
            if (blocked) {
              await saveInboundOnly({ conversationId: conversation.id, content: text, type: 'text' });
              const meta = await getContactMeta(connection.id, contactId);
              await upsertContactContext(connection.id, contactId, { contactName: null, metadata: meta });
              if (responseText) await sendInstagramPrivateDM(sessionData, contactId, responseText);
              continue;
            }
          }
          // ── Commande annulée ───────────────────────────────────────────────
          else if (rawResponse.includes('[COMMANDE_ANNULEE]')) {
            responseText = rawResponse.replace('[COMMANDE_ANNULEE]', '').trim();
            try {
              const latestOrder = await prisma.order.findFirst({
                where: { connectionId: connection.id, contactId, status: 'PENDING' },
                orderBy: { createdAt: 'desc' },
              });
              if (latestOrder) {
                await prisma.order.update({ where: { id: latestOrder.id }, data: { status: 'CANCELLED' } });
              }
            } catch {}
          }
          // ── Commande modifiée ──────────────────────────────────────────────
          else if (rawResponse.includes('[COMMANDE_MODIFIEE:')) {
            const tagStart = rawResponse.indexOf('[COMMANDE_MODIFIEE:');
            const jsonStart = tagStart + '[COMMANDE_MODIFIEE:'.length;
            const tagEnd = rawResponse.lastIndexOf('}]');
            if (tagEnd > jsonStart) {
              const jsonStr = rawResponse.slice(jsonStart, tagEnd + 1);
              responseText = (rawResponse.slice(0, tagStart) + rawResponse.slice(tagEnd + 2)).trim();
              try {
                const orderData = JSON.parse(jsonStr);
                await updateOrCreateOrder(connection, contactId, null, orderData);
              } catch (e) { console.error('[Instagram] Order modify error', e); }
            } else {
              responseText = rawResponse;
            }
          }
          // ── Commande confirmée ─────────────────────────────────────────────
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
                  if (recentCancelled) {
                    await updateOrCreateOrder(connection, contactId, null, orderData, recentCancelled.id);
                  } else {
                    await saveOrderFromBot(connection, contactId, null, orderData);
                  }
                } catch (e) { console.error('[Instagram] Order parse error', e); }
              } else {
                responseText = rawResponse;
              }
            } else if (!rawResponse.startsWith('[HORS_SUJET]')) {
              responseText = rawResponse;
            }
          }
        }

        if (!responseText) continue;

        // ── Facturer API cost ─────────────────────────────────────────────────
        if (tokensRequired > 0) logCost(user.id, 'deepseek_text');

        // ── Débiter tokens ────────────────────────────────────────────────────
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
            continue;
          }
          await prisma.tokenTransaction.create({
            data: {
              userId: connection.userId,
              type: 'USAGE',
              amount: -tokensRequired,
              balance: newBalance,
              description: 'Instagram DM',
            },
          });
          if (newBalance <= 100) {
            const fresh = await prisma.user.findUnique({
              where: { id: connection.userId },
              select: { lowTokenAlertSent: true, email: true, name: true },
            });
            if (fresh && !fresh.lowTokenAlertSent) {
              await prisma.user.update({ where: { id: connection.userId }, data: { lowTokenAlertSent: true } });
              try { await sendLowTokenEmail(fresh.email, fresh.name ?? '', newBalance); } catch {}
            }
          }
        }

        // ── Envoyer réponse ────────────────────────────────────────────────────
        await sendInstagramPrivateDM(sessionData, contactId, responseText);

        // ── Sauvegarder ────────────────────────────────────────────────────────
        await saveMessageExchange({
          conversationId: conversation.id,
          inbound: { content: text, type: 'text', tokensUsed: tokensRequired },
          outbound: { content: responseText },
        });
        const meta = await getContactMeta(connection.id, contactId);
        await upsertContactContext(connection.id, contactId, { contactName: null, metadata: meta });

        processed++;
      }

      // Mettre à jour le timestamp du dernier message
      if (maxTs > afterTs) {
        await prisma.connection.update({
          where: { id: connection.id },
          data: { instagramLastMessageTs: maxTs },
        });
      }

      results.push({ id: connection.id, processed });
    } catch (err) {
      console.error(`[Instagram cron] ${connection.id}:`, err);
      results.push({ id: connection.id, processed, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Fetch Instagram profile pic and mirror to R2. Refreshes every 24h.
 */
async function refreshProfilePhoto(
  sessionData: string,
  connectionId: string,
  contactId: string
): Promise<void> {
  try {
    const existing = await prisma.contactContext.findUnique({
      where: { connectionId_contactId: { connectionId, contactId } },
      select: { metadata: true },
    });
    const meta = (existing?.metadata as Record<string, unknown> | null) ?? {};
    const lastFetch = meta.lastPhotoFetch ? Number(meta.lastPhotoFetch) : 0;
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - lastFetch < oneDay && meta.profilePhotoUrl) return;

    const picUrl = await getInstagramProfilePicUrl(sessionData, contactId);
    if (!picUrl) return;

    // Mirror to R2 — key: avatars/ig_{contactId}.jpg
    const r2Key = `avatars/ig_${contactId}.jpg`;
    const r2Url = await mirrorImageToR2(picUrl, r2Key);

    await prisma.contactContext.upsert({
      where: { connectionId_contactId: { connectionId, contactId } },
      update: {
        metadata: {
          ...(meta as object),
          profilePhotoUrl: r2Url ?? picUrl, // fallback to IG URL if R2 not configured
          lastPhotoFetch: Date.now(),
        },
      },
      create: {
        connectionId,
        contactId,
        metadata: {
          profilePhotoUrl: r2Url ?? picUrl,
          lastPhotoFetch: Date.now(),
        },
      },
    });
  } catch (e) {
    console.error('[Instagram] Profile photo refresh error:', e);
  }
}

async function getContactMeta(connectionId: string, contactId: string): Promise<Record<string, unknown>> {
  const ctx = await prisma.contactContext.findUnique({
    where: { connectionId_contactId: { connectionId, contactId } },
    select: { metadata: true },
  });
  return (ctx?.metadata as Record<string, unknown> | null) ?? {};
}

async function buildIgSystemPrompt(connection: any, contactContext: string, isFirstMessage: boolean): Promise<string> {
  const predefinedStr = connection.predefinedMessages
    .map((m: any) => `Mots-clés: ${m.keywords.join(', ')}\nRéponse: ${m.response}`)
    .join('\n---\n');

  const detailStr = (connection.detailResponses || [])
    .map((d: any) => `Type: ${d.questionType}\nRéponse à adapter: ${d.response}`)
    .join('\n---\n');

  const products = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { name: true, description: true, price: true },
    take: 50,
  });

  const productsStr = products.length > 0
    ? products.map((p: any) => `• ${p.name}${p.price ? ` — ${p.price} DA` : ''}`).join('\n')
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

  const productDetailsStr = products
    .filter((p: any) => p.description)
    .map((p: any) => `• ${p.name} : ${p.description}`)
    .join('\n');

  return prompt + `\n\n══════════════════════════════════════
CATALOGUE PRODUITS (Instagram DM)
══════════════════════════════════════
${productsStr}

RÈGLES PRODUITS (STRICTES) :
- Donne nom et prix uniquement par défaut.
- ❌ NE MENTIONNE JAMAIS le stock sauf si explicitement demandé.
- ❌ NE donne PAS la description sauf si le client demande des détails.
- ❌ N'invente JAMAIS un produit absent de cette liste.

${productDetailsStr ? `DESCRIPTIONS (uniquement si demandé) :\n${productDetailsStr}` : ''}`;
}

async function saveOrderFromBot(connection: any, contactId: string, contactName: string | null, data: any) {
  const allProducts = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const items = (data.produits || []).map((item: any) => {
    const itemNameLower = (item.nom ?? '').toLowerCase();
    let found = allProducts.find((p) => p.name.toLowerCase() === itemNameLower);
    if (!found && itemNameLower.length >= 4) {
      found = allProducts.find(
        (p) => p.name.toLowerCase().includes(itemNameLower) ||
          (p.name.length >= 4 && itemNameLower.includes(p.name.toLowerCase()))
      );
    }
    return { name: item.nom || 'Produit', quantity: item.quantite || 1, price: found?.price || item.prix || 0, productId: found?.id || null };
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
      items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) },
    },
  });
  console.log(`[Instagram] Order saved: ${order.id} for ${fullName}`);
}

async function updateOrCreateOrder(connection: any, contactId: string, contactName: string | null, data: any, existingOrderId?: string) {
  const allProducts = await prisma.product.findMany({
    where: { userId: connection.userId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const items = (data.produits || []).map((item: any) => {
    const lower = (item.nom ?? '').toLowerCase();
    let found = allProducts.find((p) => p.name.toLowerCase() === lower);
    if (!found && lower.length >= 4) {
      found = allProducts.find((p) => p.name.toLowerCase().includes(lower) || (p.name.length >= 4 && lower.includes(p.name.toLowerCase())));
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
      data: { contactName: fullName, contactPhone: data.telephone || null, totalAmount: total, notes, status: 'PENDING', items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) } },
    });
  } else {
    const latest = await prisma.order.findFirst({ where: { connectionId: connection.id, contactId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (latest) {
      await prisma.orderItem.deleteMany({ where: { orderId: latest.id } });
      await prisma.order.update({ where: { id: latest.id }, data: { contactName: fullName, contactPhone: data.telephone || null, totalAmount: total, notes, items: { create: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, ...(i.productId ? { productId: i.productId } : {}) })) } } });
    } else {
      await saveOrderFromBot(connection, contactId, contactName, data);
    }
  }
}
