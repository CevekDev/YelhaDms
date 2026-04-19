import express, { Request, Response } from 'express';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  isJidBroadcast,
  isJidGroup,
  downloadMediaMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3001;
const SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET!;
const NEXT_APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

if (!SERVICE_SECRET || !NEXT_APP_URL) {
  console.error('Missing WHATSAPP_SERVICE_SECRET or NEXT_PUBLIC_APP_URL');
  process.exit(1);
}

const SESSIONS_DIR = './.whatsapp-sessions';
const SECRET_BUF = Buffer.from(SERVICE_SECRET);

// Accept only safe IDs (prevents path traversal via connectionId/userId)
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;
function isSafeId(v: unknown): v is string {
  return typeof v === 'string' && SAFE_ID.test(v);
}

// ── Silent logger for Baileys ────────────────────────────────────────────────
const silentLogger = {
  level: 'silent' as const,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: (obj: any, msg?: string) => {
    if (msg) console.error('[Baileys]', msg, obj);
    else console.error('[Baileys]', obj);
  },
  fatal: (obj: any, msg?: string) => {
    if (msg) console.error('[Baileys]', msg, obj);
    else console.error('[Baileys]', obj);
  },
  child: () => silentLogger,
} as any;

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireSecret(req: Request, res: Response, next: express.NextFunction) {
  const header = req.headers['x-whatsapp-secret'];
  if (typeof header !== 'string') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const got = Buffer.from(header);
  if (got.length !== SECRET_BUF.length || !crypto.timingSafeEqual(got, SECRET_BUF)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ── In-memory state ──────────────────────────────────────────────────────────
interface SessionState {
  sock: WASocket;
  status: 'initializing' | 'qr' | 'ready' | 'disconnected';
  qrDataUrl: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  intentionalDisconnect: boolean;
  sseListeners: Set<(event: string, data: any) => void>;
}

const sessions = new Map<string, SessionState>();

// ── SSE helper ───────────────────────────────────────────────────────────────
function broadcastToSession(connectionId: string, event: string, data: any) {
  const session = sessions.get(connectionId);
  if (!session) return;
  for (const listener of session.sseListeners) {
    listener(event, data);
  }
}

// ── Create/replace Baileys client ────────────────────────────────────────────
async function createClient(userId: string, connectionId: string): Promise<void> {
  if (!isSafeId(connectionId) || !isSafeId(userId)) {
    throw new Error('Invalid connectionId or userId');
  }

  const existing = sessions.get(connectionId);
  // Preserve SSE listeners across the replacement
  const carriedListeners = existing?.sseListeners ?? new Set<(event: string, data: any) => void>();

  if (existing) {
    // Mark stale so its close handler knows it's been superseded and stays quiet
    existing.intentionalDisconnect = true;
    (existing as any).__superseded = true;
    sessions.delete(connectionId);
    try { existing.sock?.end(undefined); } catch {}
  }

  // Resolve and verify path stays inside SESSIONS_DIR
  const sessionsRoot = path.resolve(SESSIONS_DIR);
  const authDir = path.resolve(sessionsRoot, connectionId);
  if (!authDir.startsWith(sessionsRoot + path.sep) && authDir !== sessionsRoot) {
    throw new Error('Invalid auth path');
  }
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false,
    browser: ['YelhaDms', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    retryRequestDelayMs: 2_000,
    qrTimeout: 60_000,
    markOnlineOnConnect: false,
    getMessage: async () => ({ conversation: '' }),
  });

  const sessionState: SessionState = {
    sock,
    status: 'initializing',
    qrDataUrl: null,
    phoneNumber: null,
    displayName: null,
    intentionalDisconnect: false,
    sseListeners: carriedListeners,
  };
  sessions.set(connectionId, sessionState);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Ignore events from a socket that has been superseded by a newer createClient
    if ((sessionState as any).__superseded) return;

    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr);
        sessionState.qrDataUrl = dataUrl;
        sessionState.status = 'qr';
        broadcastToSession(connectionId, 'qr', { qr: dataUrl });

        await fetch(`${NEXT_APP_URL}/api/whatsapp/qr-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
          body: JSON.stringify({ connectionId, userId, qrDataUrl: dataUrl }),
        }).catch((e) => console.error('[WA] QR update error', e));
      } catch (err) {
        console.error(`[${connectionId}] QR generation error`, err);
      }
    }

    if (connection === 'open') {
      // sock.user.id is e.g. "213555555555:0@s.whatsapp.net"
      sessionState.phoneNumber = sock.user?.id?.split(':')[0] ?? null;
      sessionState.displayName = sock.user?.name ?? null;
      sessionState.status = 'ready';
      sessionState.qrDataUrl = null;

      await fetch(`${NEXT_APP_URL}/api/whatsapp/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
        body: JSON.stringify({
          userId,
          connectionId,
          phoneNumber: sessionState.phoneNumber,
          displayName: sessionState.displayName,
          isActive: true,
        }),
      }).catch((e) => console.error('[WA] DB update error', e));

      broadcastToSession(connectionId, 'ready', {
        phoneNumber: sessionState.phoneNumber,
        displayName: sessionState.displayName,
      });

      console.log(`[${connectionId}] Ready — +${sessionState.phoneNumber}`);
    }

    if (connection === 'close') {
      // Only act if this handler still owns the map slot
      if (sessions.get(connectionId) !== sessionState) return;

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[${connectionId}] Disconnected — code ${statusCode}`);

      const wasIntentional = sessionState.intentionalDisconnect;
      sessionState.status = 'disconnected';
      broadcastToSession(connectionId, 'disconnected', {});

      await fetch(`${NEXT_APP_URL}/api/whatsapp/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
        body: JSON.stringify({ connectionId, isActive: false }),
      }).catch(() => {});

      sessions.delete(connectionId);

      if (loggedOut || wasIntentional) {
        // Permanently remove auth — session invalidated or manually disconnected
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
      } else {
        // Transient error — reconnect automatically
        console.log(`[${connectionId}] Reconnecting in 3s...`);
        setTimeout(() => {
          // Another createClient may have raced us; skip if a session is already there
          if (sessions.has(connectionId)) return;
          createClient(userId, connectionId).catch((e) =>
            console.error(`[${connectionId}] Reconnect error:`, e)
          );
        }, 3_000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        const jid = msg.key.remoteJid ?? '';
        if (!jid || isJidGroup(jid) || isJidBroadcast(jid)) continue;
        if (jid === 'status@broadcast') continue;

        const m = msg.message;
        if (!m) continue;

        let contentType: 'text' | 'voice' | 'image' = 'text';
        let content = '';
        let audioBase64: string | undefined;
        let audioMime: string | undefined;

        if (m.audioMessage) {
          if (!m.audioMessage.ptt) continue; // skip non-voice audio
          contentType = 'voice';
          const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
          audioBase64 = buffer.toString('base64');
          audioMime = m.audioMessage.mimetype || 'audio/ogg; codecs=opus';
        } else if (m.imageMessage) {
          contentType = 'image';
          content = '[Image reçue]';
        } else {
          content = m.conversation || m.extendedTextMessage?.text || '';
          if (!content.trim()) continue;
        }

        // Human-like delay
        const delay = Math.floor(Math.random() * 3000) + 2000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Profile photo (best-effort)
        let profilePhotoUrl: string | undefined;
        try {
          profilePhotoUrl = (await sock.profilePictureUrl(jid, 'image')) ?? undefined;
        } catch {}

        const processRes = await fetch(`${NEXT_APP_URL}/api/whatsapp/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
          body: JSON.stringify({
            connectionId,
            contactId: jid,
            contactName: msg.pushName || null,
            content,
            contentType,
            ...(audioBase64 ? { audioBase64, audioMime } : {}),
            ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
          }),
        });

        const { reply } = (await processRes.json()) as { reply: string | null };
        if (!reply) continue;

        // Typing indicator
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await sock.sendPresenceUpdate('paused', jid);

        await sock.sendMessage(jid, { text: reply });
      } catch (err) {
        console.error(`[${connectionId}] Message handling error`, err);
      }
    }
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Init endpoint — starts a WA client, responds immediately (QR delivered via callback)
app.post('/init', requireSecret, async (req: Request, res: Response) => {
  const { connectionId, userId } = req.body as { connectionId: string; userId: string };
  if (!isSafeId(connectionId) || !isSafeId(userId)) {
    res.status(400).json({ error: 'Invalid params' });
    return;
  }

  res.json({ ok: true });

  createClient(userId, connectionId).catch(async (err) => {
    console.error(`[${connectionId}] Init error`, err);
    await fetch(`${NEXT_APP_URL}/api/whatsapp/qr-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
      body: JSON.stringify({ connectionId, userId, error: err?.message || 'Failed to start' }),
    }).catch(() => {});
  });
});

// SSE connect endpoint — streams QR code then ready/disconnected event
app.get('/connect', requireSecret, async (req: Request, res: Response) => {
  const connectionId = req.query.connectionId as string;
  const userId = req.query.userId as string;

  if (!isSafeId(connectionId) || !isSafeId(userId)) {
    res.status(400).json({ error: 'Invalid params' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const existing = sessions.get(connectionId);
  if (existing?.status === 'ready') {
    send('ready', { phoneNumber: existing.phoneNumber, displayName: existing.displayName });
    res.end();
    return;
  }

  if (existing?.status === 'qr' && existing.qrDataUrl) {
    send('qr', { qr: existing.qrDataUrl });
  }

  const session = existing || sessions.get(connectionId);
  const listener = (event: string, data: any) => {
    send(event, data);
    if (event === 'ready' || event === 'disconnected' || event === 'error') {
      cleanup();
    }
  };

  const cleanup = () => {
    const s = sessions.get(connectionId);
    if (s) s.sseListeners.delete(listener);
    res.end();
  };

  req.on('close', cleanup);

  if (session) {
    session.sseListeners.add(listener);
  } else {
    const tempState: SessionState = {
      sock: null as any,
      status: 'initializing',
      qrDataUrl: null,
      phoneNumber: null,
      displayName: null,
      intentionalDisconnect: false,
      sseListeners: new Set([listener]),
    };
    sessions.set(connectionId, tempState);

    createClient(userId, connectionId).catch((err) => {
      console.error(`[${connectionId}] Init error`, err);
      send('error', { message: err.message || 'Initialization failed' });
      cleanup();
    });
  }
});

// Send message endpoint — called by Next.js for manual replies & auto-confirm
app.post('/send', requireSecret, async (req: Request, res: Response) => {
  const { connectionId, contactId, message } = req.body as {
    connectionId: string;
    contactId: string;
    message: string;
  };
  if (!isSafeId(connectionId) || typeof contactId !== 'string' || !contactId || typeof message !== 'string' || !message) {
    res.status(400).json({ error: 'Invalid params' });
    return;
  }
  // Guard against unexpected JID shapes / injection into Baileys
  if (!/^[0-9]+(?::[0-9]+)?@(s\.whatsapp\.net|c\.us)$/.test(contactId)) {
    res.status(400).json({ error: 'Invalid contactId' });
    return;
  }
  const session = sessions.get(connectionId);
  if (!session || session.status !== 'ready') {
    res.status(400).json({ error: 'Session not ready' });
    return;
  }
  try {
    await session.sock.sendMessage(contactId, { text: message });
    res.json({ ok: true });
  } catch (err: any) {
    console.error(`[${connectionId}] Send error`, err);
    res.status(500).json({ error: err?.message || 'Send failed' });
  }
});

// Disconnect endpoint
app.post('/disconnect', requireSecret, async (req: Request, res: Response) => {
  const { connectionId } = req.body as { connectionId: string };
  if (!isSafeId(connectionId)) {
    res.status(400).json({ error: 'Invalid params' });
    return;
  }
  const session = sessions.get(connectionId);
  if (session) {
    session.intentionalDisconnect = true;
    sessions.delete(connectionId);
    try { await session.sock.logout(); } catch {}
    // Wipe auth dir (safe because connectionId passed isSafeId)
    try { fs.rmSync(path.join(SESSIONS_DIR, connectionId), { recursive: true, force: true }); } catch {}
  }
  res.json({ success: true });
});

// Status endpoint
app.get('/status/:connectionId', requireSecret, (req: Request, res: Response) => {
  const { connectionId } = req.params;
  if (!isSafeId(connectionId)) {
    res.status(400).json({ error: 'Invalid params' });
    return;
  }
  const session = sessions.get(connectionId);
  res.json({ status: session?.status ?? 'disconnected' });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, sessions: sessions.size });
});

// ── Startup — reconnect active sessions ───────────────────────────────────────
async function reconnectActiveSessions() {
  try {
    const res = await fetch(`${NEXT_APP_URL}/api/whatsapp/active-sessions`, {
      headers: { 'x-whatsapp-secret': SERVICE_SECRET },
    });
    if (!res.ok) return;
    const { sessions: activeSessions } = (await res.json()) as {
      sessions: { userId: string; connectionId: string }[];
    };
    for (const { userId, connectionId } of activeSessions) {
      if (!isSafeId(connectionId) || !isSafeId(userId)) {
        console.warn(`[startup] Skipping invalid session id ${connectionId}`);
        continue;
      }
      console.log(`[startup] Reconnecting ${connectionId}...`);
      createClient(userId, connectionId).catch((e) =>
        console.error(`[startup] Failed to reconnect ${connectionId}:`, e)
      );
    }
  } catch (e) {
    console.error('[startup] Could not fetch active sessions:', e);
  }
}

app.listen(PORT, () => {
  console.log(`WhatsApp service running on port ${PORT}`);
  reconnectActiveSessions();
});
