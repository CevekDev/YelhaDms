import { IgApiClient } from 'instagram-private-api';
import { encrypt, decrypt } from '@/lib/encryption';

// Keep one client per session in memory to avoid re-deserializing on every poll
const clientCache = new Map<string, { ig: IgApiClient; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface IgMessage {
  itemId: string;
  senderId: string;
  text: string;
  timestampMicros: bigint; // µs since epoch
}

/**
 * Login to Instagram and return encrypted session data.
 * Throws on bad credentials or challenge required.
 */
export async function loginInstagram(username: string, password: string): Promise<string> {
  const ig = new IgApiClient();
  ig.state.generateDevice(username);
  await ig.simulate.preLoginFlow();
  await ig.account.login(username, password);
  // Serialise the session (cookies + state)
  const serialized = await ig.state.serialize();
  delete serialized.constants; // trim unused data
  return encrypt(JSON.stringify(serialized));
}

/**
 * Build an IgApiClient from stored (encrypted) session data.
 * Caches the client in memory for 5 minutes to avoid re-deserializing on every poll tick.
 */
async function buildClient(encryptedSession: string): Promise<IgApiClient> {
  const cached = clientCache.get(encryptedSession);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.ig;

  const ig = new IgApiClient();
  const raw = decrypt(encryptedSession);
  await ig.state.deserialize(JSON.parse(raw));
  clientCache.set(encryptedSession, { ig, ts: Date.now() });
  // Clean up old entries
  if (clientCache.size > 50) {
    let oldestKey = '';
    let oldestTs = Infinity;
    clientCache.forEach((v, k) => { if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; } });
    if (oldestKey) clientCache.delete(oldestKey);
  }
  return ig;
}

/**
 * Send a direct message to a user (identified by their numeric userId string).
 */
export async function sendInstagramPrivateDM(
  encryptedSession: string,
  recipientUserId: string,
  text: string
): Promise<void> {
  const ig = await buildClient(encryptedSession);
  // Use entity thread to broadcast a text DM
  const thread = ig.entity.directThread([recipientUserId]);
  await thread.broadcastText(text);
}

/**
 * Fetch new messages from all inbox threads that arrived after `afterTimeMicros`.
 * Returns an array of { threadId, senderId, senderUsername, text, timestampMicros }.
 */
export async function getNewInstagramMessages(
  encryptedSession: string,
  afterTimeMicros: bigint
): Promise<
  {
    threadId: string;
    senderId: string;
    text: string;
    timestampMicros: bigint;
  }[]
> {
  const ig = await buildClient(encryptedSession);
  const inbox = ig.feed.directInbox();
  const threads = await inbox.items();

  const results: {
    threadId: string;
    senderId: string;
    text: string;
    timestampMicros: bigint;
  }[] = [];

  for (const thread of threads) {
    // thread.last_permanent_item has the latest message
    const items = thread.items ?? [];
    for (const item of items) {
      if (!item.timestamp) continue;
      const ts = BigInt(item.timestamp); // µs string from Instagram
      if (ts <= afterTimeMicros) continue;
      if (item.item_type !== 'text') continue;
      if (!item.text) continue;

      // Skip our own messages
      const myId = (ig.state as unknown as { cookieUserId?: string }).cookieUserId;
      if (item.user_id?.toString() === myId) continue;

      results.push({
        threadId: thread.thread_id,
        senderId: item.user_id?.toString() ?? '',
        text: item.text,
        timestampMicros: ts,
      });
    }
  }

  return results;
}

/**
 * Fetch the profile picture URL of a given user (by their numeric ID string).
 * Returns null on failure.
 */
export async function getInstagramProfilePicUrl(
  encryptedSession: string,
  userId: string
): Promise<string | null> {
  try {
    const ig = await buildClient(encryptedSession);
    const info = await ig.user.info(userId);
    return info.profile_pic_url ?? info.hd_profile_pic_url_info?.url ?? null;
  } catch {
    return null;
  }
}
