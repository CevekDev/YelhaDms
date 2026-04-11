import crypto from 'crypto';

// Auto-detect test vs live mode based on API key prefix
function getApiUrl(): string {
  const key = process.env.CHARGILY_API_KEY || '';
  if (key.startsWith('test_')) {
    return 'https://pay.chargily.net/test/api/v2';
  }
  return 'https://pay.chargily.net/api/v2';
}

export interface ChargilyCheckoutResult {
  id: string;
  checkout_url: string;
  status: string;
}

export async function createChargilyCheckout(params: {
  amount: number;
  currency: 'DZD';
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  failureUrl: string;
  description?: string;
  metadata: Record<string, string>;
  locale?: 'ar' | 'fr' | 'en';
}): Promise<ChargilyCheckoutResult> {
  const apiKey = process.env.CHARGILY_API_KEY;
  if (!apiKey) throw new Error('CHARGILY_API_KEY is not set');

  const apiUrl = getApiUrl();

  const body = {
    amount: params.amount,
    currency: params.currency.toLowerCase(), // 'dzd'
    success_url: params.successUrl,
    failure_url: params.failureUrl,
    description: params.description ?? 'YelhaDms — Achat de tokens',
    locale: params.locale ?? 'fr',
    collect_shipping_address: 0,
    metadata: params.metadata,
    customer: {
      name: params.customerName || params.customerEmail,
      email: params.customerEmail,
    },
  };

  console.log('[Chargily] Using API URL:', apiUrl);
  console.log('[Chargily] Creating checkout for amount:', params.amount, 'DZD');

  const res = await fetch(`${apiUrl}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Chargily] checkout creation failed:', res.status, err);
    throw new Error(`Chargily ${res.status}: ${err}`);
  }

  const data = await res.json();
  console.log('[Chargily] checkout created:', data.id, data.checkout_url);

  return {
    id: data.id,
    checkout_url: data.checkout_url,
    status: data.status,
  };
}

/**
 * Verify Chargily webhook signature.
 * Chargily signs webhooks with the API secret key (HMAC-SHA256).
 */
export function verifyChargilySignature(rawBody: Buffer, signature: string): boolean {
  if (!signature) return false;
  // Chargily uses the API secret key (same as CHARGILY_API_KEY) to sign webhooks
  const secret = process.env.CHARGILY_WEBHOOK_SECRET || process.env.CHARGILY_API_KEY!;
  if (!secret) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

export function formatDZD(amount: number): string {
  return amount.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0') + ' DA';
}
