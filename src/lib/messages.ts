import { prisma } from '@/lib/prisma';

/** Nombre max de messages conservés par conversation */
const MAX_MESSAGES = 30;

/** Nombre de messages d'historique passés à l'IA */
const HISTORY_MESSAGES = 20;

/** Score spam à partir duquel on flag la conversation */
const SPAM_THRESHOLD = 3;

/**
 * Supprime les messages les plus anciens si la conversation dépasse MAX_MESSAGES.
 */
export async function pruneMessages(conversationId: string): Promise<void> {
  const count = await prisma.message.count({ where: { conversationId } });
  if (count <= MAX_MESSAGES) return;

  const excess = count - MAX_MESSAGES;
  const oldest = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: excess,
    select: { id: true },
  });

  if (oldest.length > 0) {
    await prisma.message.deleteMany({
      where: { id: { in: oldest.map((m) => m.id) } },
    });
  }
}

/**
 * Incrémente le score spam. Si le seuil est atteint, flag needsHelp et suspend la conv.
 * Retourne true si la conversation doit être bloquée.
 */
export async function handleSpam(conversationId: string): Promise<boolean> {
  const conv = await prisma.conversation.update({
    where: { id: conversationId },
    data: { spamScore: { increment: 1 } },
    select: { spamScore: true, needsHelp: true },
  });

  if (conv.spamScore >= SPAM_THRESHOLD && !conv.needsHelp) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { needsHelp: true },
    });
    return true;
  }

  return conv.spamScore >= SPAM_THRESHOLD;
}

/**
 * Récupère ou crée un ContactContext pour un contact donné.
 */
export async function upsertContactContext(
  connectionId: string,
  contactId: string,
  update: {
    contactName?: string | null;
    wilaya?: string | null;
    notes?: string | null;
    metadata?: Record<string, any> | null;
  } = {}
) {
  const cleanUpdate = Object.fromEntries(
    Object.entries(update).filter(([, v]) => v !== undefined)
  );

  return prisma.contactContext.upsert({
    where: { connectionId_contactId: { connectionId, contactId } },
    create: {
      connectionId,
      contactId,
      ...cleanUpdate,
      lastSeenAt: new Date(),
    },
    update: {
      ...cleanUpdate,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Construit la chaîne de contexte client à injecter dans le system prompt.
 */
export function buildContactContextString(ctx: {
  contactName?: string | null;
  wilaya?: string | null;
  notes?: string | null;
  metadata?: any;
} | null): string {
  if (!ctx) return '';
  const lines: string[] = [];
  if (ctx.contactName) lines.push(`- Prénom/Nom client : ${ctx.contactName}`);
  if (ctx.wilaya) lines.push(`- Wilaya : ${ctx.wilaya}`);
  if (ctx.notes) lines.push(`- Notes : ${ctx.notes}`);
  if (ctx.metadata && Object.keys(ctx.metadata).length > 0) {
    for (const [k, v] of Object.entries(ctx.metadata)) {
      lines.push(`- ${k} : ${v}`);
    }
  }
  if (lines.length === 0) return '';
  return `\n\n[CONTEXTE CLIENT]\n${lines.join('\n')}`;
}

/**
 * Récupère les N derniers messages d'une conversation pour l'historique IA.
 * S'arrête au dernier marqueur [SETTINGS_RESET] pour garantir que les
 * nouveaux réglages prennent effet immédiatement.
 */
export async function getRecentHistory(
  conversationId: string
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_MESSAGES,
    select: { direction: true, content: true, type: true },
  });

  // Stop at the most recent settings_reset marker (newest-first scan)
  const cutIdx = messages.findIndex((m) => m.type === 'settings_reset');
  const relevant = cutIdx === -1 ? messages : messages.slice(0, cutIdx);

  return relevant
    .filter((m) => m.direction === 'inbound' || m.direction === 'outbound')
    .reverse()
    .map((m) => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    }));
}

/**
 * Sauvegarde un échange (inbound + outbound) et élague si nécessaire.
 */
export async function saveMessageExchange(opts: {
  conversationId: string;
  inbound: { content: string; type: string; tokensUsed: number };
  outbound: { content: string };
}): Promise<void> {
  const { conversationId, inbound, outbound } = opts;

  await prisma.message.createMany({
    data: [
      {
        conversationId,
        direction: 'inbound',
        content: inbound.content,
        type: inbound.type,
        tokensUsed: inbound.tokensUsed,
      },
      {
        conversationId,
        direction: 'outbound',
        content: outbound.content,
        type: 'text',
        tokensUsed: 0,
      },
    ],
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessage: new Date(), isNew: false },
  });

  pruneMessages(conversationId).catch(console.error);
}

/**
 * Sauvegarde un message inbound sans réponse (ex: message bloqué).
 */
export async function saveInboundOnly(opts: {
  conversationId: string;
  content: string;
  type: string;
}): Promise<void> {
  await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      direction: 'inbound',
      content: opts.content,
      type: opts.type,
      tokensUsed: 0,
    },
  });
  await prisma.conversation.update({
    where: { id: opts.conversationId },
    data: { lastMessage: new Date() },
  });
}

/**
 * Récupère ou crée une conversation pour un contact.
 */
export async function getOrCreateConversation(opts: {
  connectionId: string;
  contactId: string;
  platform: 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM';
  contactName?: string | null;
}) {
  const { connectionId, contactId, platform, contactName } = opts;

  let conversation = await prisma.conversation.findFirst({
    where: { connectionId, contactId },
  });

  if (!conversation) {
    try {
      conversation = await prisma.conversation.create({
        data: {
          connectionId,
          externalId: contactId,
          platform,
          contactId,
          contactName: contactName || null,
        },
      });
    } catch (err: any) {
      // P2002: unique constraint violation — conversation was created concurrently
      if (err?.code === 'P2002') {
        conversation = await prisma.conversation.findFirst({
          where: { connectionId, contactId },
        });
        if (!conversation) throw err; // unexpected
      } else {
        throw err;
      }
    }
  }

  if (!conversation) throw new Error('Failed to get or create conversation');

  if (contactName && !conversation.contactName) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { contactName },
    });
  }

  return conversation;
}

/**
 * Enregistre un coût API estimé.
 * DeepSeek text: ~$0.000154 par message (800 tokens avg)
 * Whisper: ~$0.003 par message vocal (30s avg)
 */
export async function logCost(userId: string, type: 'deepseek_text' | 'deepseek_voice' | 'whisper'): Promise<void> {
  const costMap = {
    deepseek_text: 0.000154,
    deepseek_voice: 0.000154,
    whisper: 0.003,
  };
  await prisma.costLog.create({
    data: { userId, type, estimatedCost: costMap[type] },
  }).catch(() => {}); // Ne jamais bloquer le bot pour un log
}
