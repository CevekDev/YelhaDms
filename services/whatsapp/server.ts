import express, { Request, Response } from 'express';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import QRCode from 'qrcode';

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

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireSecret(req: Request, res: Response, next: express.NextFunction) {
  if (req.headers['x-whatsapp-secret'] !== SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ── In-memory state ──────────────────────────────────────────────────────────
interface SessionState {
  client: Client;
  status: 'initializing' | 'qr' | 'ready' | 'disconnected';
  qrDataUrl: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  // SSE writers waiting for events
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

// ── Create/replace WA client ─────────────────────────────────────────────────
async function createClient(userId: string, connectionId: string): Promise<void> {
  // Destroy existing if any
  const existing = sessions.get(connectionId);
  if (existing) {
    try { await existing.client.destroy(); } catch {}
    sessions.delete(connectionId);
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: connectionId,
      dataPath: './.whatsapp-sessions',
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update',
        '--ignore-certificate-errors',
        '--disable-plugins',
      ],
    },
  });

  const state: SessionState = {
    client,
    status: 'initializing',
    qrDataUrl: null,
    phoneNumber: null,
    displayName: null,
    sseListeners: new Set(),
  };
  sessions.set(connectionId, state);

  client.on('qr', async (qr: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr);
      state.qrDataUrl = dataUrl;
      state.status = 'qr';
      broadcastToSession(connectionId, 'qr', { qr: dataUrl });

      // Push QR to Next.js so the browser can poll for it
      await fetch(`${NEXT_APP_URL}/api/whatsapp/qr-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
        body: JSON.stringify({ connectionId, userId, qrDataUrl: dataUrl }),
      }).catch((e) => console.error('[WA] QR update error', e));
    } catch (err) {
      console.error(`[${connectionId}] QR generation error`, err);
    }
  });

  client.on('ready', async () => {
    const info = client.info;
    state.phoneNumber = info?.wid?.user ?? null;
    state.displayName = info?.pushname ?? null;
    state.status = 'ready';
    state.qrDataUrl = null;

    // Persist session to DB via Next.js internal API
    await fetch(`${NEXT_APP_URL}/api/whatsapp/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
      body: JSON.stringify({
        userId,
        connectionId,
        phoneNumber: state.phoneNumber,
        displayName: state.displayName,
        isActive: true,
      }),
    }).catch((e) => console.error('[WA] DB update error', e));

    broadcastToSession(connectionId, 'ready', {
      phoneNumber: state.phoneNumber,
      displayName: state.displayName,
    });

    console.log(`[${connectionId}] Ready — +${state.phoneNumber}`);
  });

  client.on('message', async (message: Message) => {
    try {
      if (message.fromMe) return;
      if (message.isStatus) return;
      if (message.from.includes('@g.us')) return;
      if (message.from === 'status@broadcast') return;

      let contentType: 'text' | 'voice' | 'image' = 'text';
      let content = message.body || '';
      let audioBase64: string | undefined;
      let audioMime: string | undefined;

      if (message.hasMedia) {
        if (message.type === 'ptt' || message.type === 'audio') {
          contentType = 'voice';
          const media = await message.downloadMedia();
          audioBase64 = media.data;
          audioMime = media.mimetype || 'audio/ogg';
          content = '';
        } else if (message.type === 'image') {
          contentType = 'image';
          content = '[Image reçue]';
        } else {
          return; // unsupported media
        }
      } else if (!content.trim()) {
        return;
      }

      // Human-like delay
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Fetch profile photo (best-effort, expires but refreshed periodically)
      let profilePhotoUrl: string | undefined;
      try {
        const contact = await client.getContactById(message.from);
        profilePhotoUrl = await contact.getProfilePicUrl() || undefined;
      } catch {}

      // Call Next.js for bot processing
      const processRes = await fetch(`${NEXT_APP_URL}/api/whatsapp/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
        body: JSON.stringify({
          connectionId,
          contactId: message.from,
          contactName: (message as any).notifyName || null,
          content,
          contentType,
          ...(audioBase64 ? { audioBase64, audioMime } : {}),
          ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
        }),
      });

      const { reply } = await processRes.json() as { reply: string | null };
      if (!reply) return;

      // Typing indicator
      const chat = await message.getChat();
      await chat.sendStateTyping();
      await new Promise(resolve => setTimeout(resolve, 1500));

      await message.reply(reply);

    } catch (err) {
      console.error(`[${connectionId}] Message handling error`, err);
    }
  });

  client.on('disconnected', async () => {
    state.status = 'disconnected';
    broadcastToSession(connectionId, 'disconnected', {});

    await fetch(`${NEXT_APP_URL}/api/whatsapp/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
      body: JSON.stringify({ connectionId, isActive: false }),
    }).catch(() => {});

    sessions.delete(connectionId);
    console.log(`[${connectionId}] Disconnected`);
  });

  client.on('auth_failure', async () => {
    state.status = 'disconnected';
    broadcastToSession(connectionId, 'error', { message: 'Authentication failed' });
    sessions.delete(connectionId);
  });

  await client.initialize();
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Init endpoint — starts a WA client, responds immediately (QR delivered via callback)
app.post('/init', requireSecret, async (req: Request, res: Response) => {
  const { connectionId, userId } = req.body as { connectionId: string; userId: string };
  if (!connectionId || !userId) {
    res.status(400).json({ error: 'Missing params' });
    return;
  }

  // Respond immediately, client init happens in background
  res.json({ ok: true });

  createClient(userId, connectionId).catch(async (err) => {
    console.error(`[${connectionId}] Init error`, err);
    // Notify Next.js so the modal can show an error
    await fetch(`${NEXT_APP_URL}/api/whatsapp/qr-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': SERVICE_SECRET },
      body: JSON.stringify({ connectionId, userId, error: err?.message || 'Puppeteer failed to start' }),
    }).catch(() => {});
  });
});

// SSE connect endpoint — streams QR code then ready/disconnected event
app.get('/connect', requireSecret, async (req: Request, res: Response) => {
  const connectionId = req.query.connectionId as string;
  const userId = req.query.userId as string;

  if (!connectionId || !userId) {
    res.status(400).json({ error: 'Missing params' });
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

  // Check if already ready
  const existing = sessions.get(connectionId);
  if (existing?.status === 'ready') {
    send('ready', { phoneNumber: existing.phoneNumber, displayName: existing.displayName });
    res.end();
    return;
  }

  // If QR already generated, send it immediately
  if (existing?.status === 'qr' && existing.qrDataUrl) {
    send('qr', { qr: existing.qrDataUrl });
  }

  // Register SSE listener
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
    // Start new client — register listener first so we catch the QR
    const tempState: SessionState = {
      client: null as any,
      status: 'initializing',
      qrDataUrl: null,
      phoneNumber: null,
      displayName: null,
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

// Disconnect endpoint
app.post('/disconnect', requireSecret, async (req: Request, res: Response) => {
  const { connectionId } = req.body as { connectionId: string };
  const session = sessions.get(connectionId);
  if (session) {
    try {
      await session.client.logout();
      await session.client.destroy();
    } catch {}
    sessions.delete(connectionId);
  }
  res.json({ success: true });
});

// Status endpoint
app.get('/status/:connectionId', requireSecret, (req: Request, res: Response) => {
  const { connectionId } = req.params;
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
    const { sessions: activeSessions } = await res.json() as { sessions: { userId: string; connectionId: string }[] };
    for (const { userId, connectionId } of activeSessions) {
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
