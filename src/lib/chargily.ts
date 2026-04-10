import crypto from 'crypto';

const CHARGILY_API_URL = 'https://pay.chargily.net/api/v2';

export interface ChargilyCheckoutResult {
  id: string;
  checkout_url: string;
  status: string;
}

/**
 * Create a Chargily ePay v2 checkout session.
 * NOTE: Do NOT send webhook_endpoint per-checkout — configure it once in your
 * Chargily dashboard under Settings → Webhooks → add your URL.
 */
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
  const body = {
    amount: params.amount,
    currency: params.currency.toLowerCase(), // 'dzd'
    success_url: params.successUrl,
    failure_url: params.failureUrl,
    description: params.description ?? 'Yelha — Achat de tokens',
    locale: params.locale ?? 'fr',
    collect_shipping_address: 0,
    metadata: params.metadata,
    customer: {
      name: params.customerName || params.customerEmail,
      email: params.customerEmail,
    },
  };

  const res = await fetch(`${CHARGILY_API_URL}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CHARGILY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Chargily] checkout creation failed:', res.status, err);
    throw new Error(`Chargily error ${res.status}: ${err}`);
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
 * Header: "signature" — HMAC-SHA256 of raw body keyed with CHARGILY_WEBHOOK_SECRET
 */
export function verifyChargilySignature(rawBody: Buffer, signature: string): boolean {
  if (!signature) return false;
  const secret = process.env.CHARGILY_WEBHOOK_SECRET || process.env.CHARGILY_API_KEY!;
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
