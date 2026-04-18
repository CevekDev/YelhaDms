import { prisma } from './prisma';

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

export type EcoWilaya = { wilaya_id: number; wilaya_name: string };
export type EcoCommune = { nom: string; wilaya_id: number; code_postal: string; has_stop_desk: number };

export type EcotrackStep =
  | 'awaiting_location_confirm'
  | 'awaiting_delivery_type'
  | 'awaiting_stopdesk_choice';

export interface EcotrackState {
  step: EcotrackStep;
  orderId: string;
  orderData: any;
  wilayaId: number;
  wilayaName: string;
  communeName: string;
  codePostal: string;
  hasStopDesk: boolean;
  deliveryType?: 0 | 1;
  suggestions?: Array<{ wilayaId: number; wilayaName: string; communeName: string; codePostal: string; hasStopDesk: boolean }>;
  stopDeskAlternatives?: Array<{ nom: string; codePostal: string }>;
}

export interface LocationMatch {
  wilayaId: number;
  wilayaName: string;
  communeName: string;
  codePostal: string;
  hasStopDesk: boolean;
}

// ── In-process cache (survives warm serverless invocations) ─────────────────
const _wCache = new Map<string, { data: EcoWilaya[]; ts: number }>();
const _cCache = new Map<string, { data: EcoCommune[]; ts: number }>();

// ── Daridja / Arabic → wilaya_id mapping ────────────────────────────────────
const WILAYA_ALIASES: Record<string, number> = {
  // Alger (16)
  dzayer: 16, dzair: 16, aljer: 16, 'el djazair': 16, 'الجزائر': 16, جزائر: 16, دزاير: 16,
  // Oran (31)
  wahran: 31, waran: 31, وهران: 31,
  // Constantine (25)
  ksantina: 25, qsantina: 25, qsentina: 25, 'قسنطينة': 25, قسنطينه: 25,
  // Annaba (23)
  ennaba: 23, عنابة: 23,
  // Batna (5)
  باتنة: 5,
  // Biskra (7)
  bsekra: 7, بسكرة: 7,
  // Blida (9)
  lbleida: 9, lbelida: 9, 'البليدة': 9,
  // Béjaïa (6)
  bgayet: 6, bgayeth: 6, bgait: 6, bijaia: 6, بجاية: 6,
  // Tizi Ouzou (15)
  tizi: 15, 'tizi wezzu': 15, 'تيزي وزو': 15,
  // Boumerdès (35)
  boumerdes: 35, bumerdes: 35, بومرداس: 35,
  // Tipaza (42)
  tipasa: 42, تيبازة: 42,
  // Médéa (26)
  lmedya: 26, medea: 26, 'المدية': 26,
  // Sétif (19)
  stif: 19, سطيف: 19,
  // Mila (43)
  ميلة: 43,
  // Skikda (21)
  سكيكدة: 21,
  // Guelma (24)
  قالمة: 24,
  // Souk Ahras (41)
  'souk ahras': 41, 'سوق أهراس': 41,
  // Tébessa (12)
  tebessa: 12, tbessa: 12, تبسة: 12,
  // El Tarf (36)
  tarf: 36, الطارف: 36,
  // Khenchela (40)
  خنشلة: 40,
  // Oum El Bouaghi (4)
  oeb: 4, 'أم البواقي': 4,
  // Bordj Bou Arreridj (34)
  bba: 34, borj: 34, 'برج بوعريريج': 34,
  // M'Sila (28)
  msila: 28, mssila: 28, 'المسيلة': 28,
  // Djelfa (17)
  jelfa: 17, 'الجلفة': 17,
  // Laghouat (3)
  laghwat: 3, 'الأغواط': 3,
  // Ouargla (30)
  wargla: 30, ورقلة: 30,
  // Ghardaïa (47)
  ghardaia: 47, غرداية: 47,
  // El Oued (39)
  lwad: 39, 'الوادي': 39,
  // Tamanrasset (11)
  tam: 11, تمنراست: 11,
  // Illizi (33)
  إليزي: 33,
  // Adrar (1)
  أدرار: 1,
  // Tindouf (37)
  تندوف: 37,
  // El Bayadh (32)
  lbyed: 32, البيض: 32,
  // Naâma (45)
  naama: 45, نعامة: 45,
  // Béchar (8)
  bechar: 8, بشار: 8,
  // Tlemcen (13)
  tlemsan: 13, تلمسان: 13,
  // Sidi Bel Abbès (22)
  sba: 22, 'سيدي بلعباس': 22,
  // Aïn Témouchent (46)
  'ain temouchent': 46, 'عين تموشنت': 46,
  // Saïda (20)
  سعيدة: 20,
  // Mascara (29)
  maasker: 29, معسكر: 29,
  // Mostaganem (27)
  مستغانم: 27,
  // Relizane (48)
  ghlizan: 48, غليزان: 48,
  // Tiaret (14)
  تيارت: 14,
  // Tissemsilt (38)
  تيسمسيلت: 38,
  // Aïn Defla (44)
  'ain defla': 44, 'عين الدفلى': 44,
  // Chlef (2)
  lash: 2, 'el asnam': 2, asnam: 2, الشلف: 2,
  // Bouira (10)
  lbwira: 10, البويرة: 10,
  // Jijel (18)
  جيجل: 18,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019\u060c,;:!?.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

function ecoHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function fetchWilayas(url: string, token: string): Promise<EcoWilaya[]> {
  const key = `${url}|${token.slice(-6)}`;
  const c = _wCache.get(key);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  const res = await fetch(`${url}/api/v1/get/wilayas`, { headers: ecoHeaders(token) });
  const data: EcoWilaya[] = await res.json();
  _wCache.set(key, { data, ts: Date.now() });
  return data;
}

async function fetchCommunes(url: string, token: string): Promise<EcoCommune[]> {
  const key = `${url}|${token.slice(-6)}`;
  const c = _cCache.get(key);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  const res = await fetch(`${url}/api/v1/get/communes`, { headers: ecoHeaders(token) });
  const raw = await res.json();
  const data: EcoCommune[] = Object.values(raw);
  _cCache.set(key, { data, ts: Date.now() });
  return data;
}

// ── Validate wilaya + commune against Ecotrack ───────────────────────────────
export async function validateLocation(
  url: string,
  token: string,
  inputWilaya: string,
  inputCommune: string,
): Promise<{ found: LocationMatch | null; suggestions: LocationMatch[] }> {
  const [wilayas, communes] = await Promise.all([fetchWilayas(url, token), fetchCommunes(url, token)]);
  const normW = normalize(inputWilaya);
  const normC = normalize(inputCommune);

  // 1. Match wilaya — check alias table first
  let wilayaId: number | null = null;
  for (const [alias, id] of Object.entries(WILAYA_ALIASES)) {
    const normAlias = normalize(alias);
    if (normW === normAlias || normW.includes(normAlias) || normAlias.includes(normW)) {
      wilayaId = id;
      break;
    }
  }
  // Fuzzy match against official wilaya names
  if (!wilayaId) {
    let best = Infinity;
    for (const w of wilayas) {
      const n = normalize(w.wilaya_name);
      const d = levenshtein(normW, n);
      const ratio = d / Math.max(normW.length, n.length, 1);
      if (ratio < 0.35 && d < best) { best = d; wilayaId = w.wilaya_id; }
    }
  }

  const matchedWilaya = wilayaId ? wilayas.find(w => w.wilaya_id === wilayaId) : null;

  // 2. Find commune
  const pool = wilayaId ? communes.filter(c => c.wilaya_id === wilayaId) : communes;
  let exactC: EcoCommune | null = null;
  let bestDist = Infinity;
  let bestC: EcoCommune | null = null;

  for (const c of pool) {
    const n = normalize(c.nom);
    if (n === normC || n.includes(normC) || normC.includes(n)) { exactC = c; break; }
    const d = levenshtein(normC, n);
    if (d < bestDist) { bestDist = d; bestC = c; }
  }

  const toMatch = (c: EcoCommune, wId: number): LocationMatch => ({
    wilayaId: wId,
    wilayaName: matchedWilaya?.wilaya_name ?? wilayas.find(w => w.wilaya_id === wId)?.wilaya_name ?? `Wilaya ${wId}`,
    communeName: c.nom,
    codePostal: c.code_postal,
    hasStopDesk: c.has_stop_desk === 1,
  });

  if (exactC && wilayaId) {
    return { found: toMatch(exactC, wilayaId), suggestions: [] };
  }

  // Build suggestions (top 3 closest communes)
  const suggestions: LocationMatch[] = [];
  if (bestC && bestDist <= 6 && wilayaId) suggestions.push(toMatch(bestC, wilayaId));
  // Also search across all wilayas for the commune name
  const global = communes
    .filter(c => c.wilaya_id !== wilayaId)
    .map(c => ({ c, d: levenshtein(normC, normalize(c.nom)) }))
    .filter(x => x.d <= 4)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2);
  for (const { c } of global) suggestions.push(toMatch(c, c.wilaya_id));

  return { found: null, suggestions: suggestions.slice(0, 3) };
}

export async function getStopDeskAlternatives(url: string, token: string, wilayaId: number): Promise<EcoCommune[]> {
  const communes = await fetchCommunes(url, token);
  return communes.filter(c => c.wilaya_id === wilayaId && c.has_stop_desk === 1);
}

// ── Create order on Ecotrack ─────────────────────────────────────────────────
export async function createEcotrackOrder(
  url: string,
  token: string,
  data: {
    nom_client: string;
    telephone: string;
    adresse: string;
    commune: string;
    code_wilaya: number;
    montant: number;
    stop_desk: 0 | 1;
    produit?: string;
    reference?: string;
  },
): Promise<{ success: boolean; tracking?: string; error?: string }> {
  const params = new URLSearchParams({
    nom_client: data.nom_client,
    telephone: data.telephone,
    adresse: data.adresse,
    commune: data.commune,
    code_wilaya: String(data.code_wilaya),
    montant: String(data.montant),
    type: '1',
    stop_desk: String(data.stop_desk),
    ...(data.produit ? { produit: data.produit } : {}),
    ...(data.reference ? { reference: data.reference } : {}),
  });
  try {
    const res = await fetch(`${url}/api/v1/create/order?${params.toString()}`, {
      method: 'POST',
      headers: ecoHeaders(token),
    });
    const json = await res.json();
    if (res.ok && json.tracking) return { success: true, tracking: json.tracking };
    return { success: false, error: JSON.stringify(json) };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ── Delete (cancel) an order on Ecotrack ────────────────────────────────────
export async function deleteEcotrackOrder(url: string, token: string, tracking: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/v1/delete/order?tracking=${encodeURIComponent(tracking)}`, {
      method: 'DELETE',
      headers: ecoHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    return data.success === true || res.ok;
  } catch {
    return false;
  }
}

// ── Ship (validate) an existing Ecotrack order ───────────────────────────────
export async function shipEcotrackOrder(url: string, token: string, tracking: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/v1/valid/order?tracking=${encodeURIComponent(tracking)}`, {
      method: 'POST',
      headers: ecoHeaders(token),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ── Validate that a token is valid ──────────────────────────────────────────
export async function validateEcotrackToken(url: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/v1/validate/token?api_token=${encodeURIComponent(token)}`, {
      headers: ecoHeaders(token),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ── Finalize: create order on Ecotrack + update our DB ──────────────────────
export async function finalizeEcotrackOrder(
  state: EcotrackState,
  deliveryType: 0 | 1,
  ecoToken: string,
  ecoUrl: string,
  deliveryFee = 0,
): Promise<string> {
  const { orderData, orderId, wilayaId, communeName, wilayaName } = state;
  const nom = [orderData.prenom, orderData.nom].filter(Boolean).join(' ') || 'Client';
  const phone = (orderData.telephone || '').replace(/\D/g, '').slice(-10);
  const adresse = orderData.adresse || `${orderData.commune || ''} ${orderData.wilaya || ''}`.trim() || communeName;
  const montant = orderData.total || 0;
  const produit = (orderData.produits || []).map((p: any) => `${p.nom} x${p.quantite}`).join(', ');

  const result = await createEcotrackOrder(ecoUrl, ecoToken, {
    nom_client: nom,
    telephone: phone,
    adresse,
    commune: communeName,
    code_wilaya: wilayaId,
    montant,
    stop_desk: deliveryType,
    produit: produit || undefined,
    reference: orderId.slice(-8).toUpperCase(),
  });

  const totalWithDelivery = montant + (deliveryFee || 0);

  if (result.success && result.tracking) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode: result.tracking,
        ecotrackTracking: result.tracking,
        deliveryType,
        codeWilaya: wilayaId,
        deliveryFee: deliveryFee || 0,
        totalAmount: totalWithDelivery,
        notes: `Wilaya: ${wilayaName} — Commune: ${communeName}`,
        // Status stays PENDING — confirmed only when customer replies "oui"
      },
    });
    const mode = deliveryType === 0 ? 'à domicile' : 'en Stop Desk';
    const deliveryLine = deliveryFee > 0 ? `\n📦 Livraison : *${deliveryFee.toLocaleString('fr-DZ')} DA*` : '';
    return (
      `✅ *Commande enregistrée !*\n\n` +
      `🚚 Livraison ${mode} à *${communeName}*, ${wilayaName}\n` +
      `📦 Tracking : *${result.tracking}*` +
      deliveryLine +
      `\n💰 Total : *${totalWithDelivery.toLocaleString('fr-DZ')} DA*\n\n` +
      `Votre commande est en attente de confirmation. Nous vous contacterons bientôt. 🙏`
    );
  }

  // Ecotrack failed — still save what we have
  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryType,
      codeWilaya: wilayaId,
      deliveryFee: deliveryFee || 0,
      totalAmount: totalWithDelivery,
      notes: `Wilaya: ${wilayaName} — Commune: ${communeName}`,
    },
  });
  return `✅ Votre commande a été enregistrée ! Nous vous contacterons pour confirmer les détails de livraison.`;
}

// ── Handle one turn of the Ecotrack state machine ───────────────────────────
export interface EcoHandlerResult {
  handled: boolean;
  responseText?: string;
  newState?: EcotrackState | null;
}

export async function handleEcotrackMessage(
  state: EcotrackState,
  text: string,
  ecoToken: string,
  ecoUrl: string,
  deliveryFee = 0,
): Promise<EcoHandlerResult> {
  const lower = text.toLowerCase().trim();

  // ── Step: awaiting_location_confirm ────────────────────────────────────────
  if (state.step === 'awaiting_location_confirm') {
    const suggestions = state.suggestions ?? [];
    const numMatch = lower.match(/^(\d+)$/);
    const isYes = /^(oui|yes|na3am|نعم|wah|mh|ouai|ouais|ok|d'accord|correct|exactement|c'est.?ca|cest.?ca)/.test(lower);
    const isNo  = /^(non|no|la|لا|nope|nan|pas.?ca|pas.?bon|pas.?moi)/.test(lower);

    if (numMatch || isYes) {
      const idx = numMatch ? parseInt(numMatch[1]) - 1 : 0;
      const s = suggestions[idx] ?? suggestions[0];
      if (!s) {
        return { handled: true, responseText: '📍 Veuillez saisir à nouveau votre wilaya et commune.', newState: null };
      }
      const newState: EcotrackState = { ...state, step: 'awaiting_delivery_type', wilayaId: s.wilayaId, wilayaName: s.wilayaName, communeName: s.communeName, codePostal: s.codePostal, hasStopDesk: s.hasStopDesk, suggestions: undefined };
      return { handled: true, responseText: buildDeliveryTypeMsg(s), newState };
    }
    if (isNo) {
      return { handled: true, responseText: '📍 D\'accord, veuillez saisir à nouveau votre wilaya et commune de livraison.', newState: null };
    }
    const list = suggestions.map((s, i) => `${i + 1}. ${s.communeName} — ${s.wilayaName}`).join('\n');
    return { handled: true, responseText: `Répondez par le numéro de votre choix ou "Non" pour recommencer :\n${list}`, newState: state };
  }

  // ── Step: awaiting_delivery_type ──────────────────────────────────────────
  if (state.step === 'awaiting_delivery_type') {
    const isDomicile = /domicile|maison|chez.?moi|3andi|عندي|dial|livraison|domicile|^1$/.test(lower);
    const isStop    = /stop.?desk|agence|bureau|point.?relais|nqta|أقرب|relais|^2$/.test(lower);

    if (isDomicile) {
      const msg = await finalizeEcotrackOrder(state, 0, ecoToken, ecoUrl, deliveryFee);
      return { handled: true, responseText: msg, newState: null };
    }
    if (isStop) {
      if (state.hasStopDesk) {
        const msg = await finalizeEcotrackOrder(state, 1, ecoToken, ecoUrl, deliveryFee);
        return { handled: true, responseText: msg, newState: null };
      }
      // No stop desk in this commune — find alternatives
      const alts = await getStopDeskAlternatives(ecoUrl, ecoToken, state.wilayaId);
      if (alts.length === 0) {
        const msg = await finalizeEcotrackOrder(state, 0, ecoToken, ecoUrl, deliveryFee);
        return { handled: true, responseText: `❌ Pas de Stop Desk disponible à ${state.wilayaName}. Livraison à domicile automatiquement.\n\n${msg}`, newState: null };
      }
      const list = alts.slice(0, 5).map((a, i) => `${i + 1}. ${a.nom}`).join('\n');
      const newState: EcotrackState = { ...state, step: 'awaiting_stopdesk_choice', stopDeskAlternatives: alts.slice(0, 5).map(a => ({ nom: a.nom, codePostal: a.code_postal })) };
      return {
        handled: true,
        responseText: `❌ Pas de Stop Desk à *${state.communeName}*.\n\nAgences disponibles dans la wilaya de ${state.wilayaName} :\n${list}\n\nChoisissez un numéro ou tapez *Domicile* pour livraison à domicile.`,
        newState,
      };
    }
    return { handled: true, responseText: buildDeliveryTypeMsg(state), newState: state };
  }

  // ── Step: awaiting_stopdesk_choice ────────────────────────────────────────
  if (state.step === 'awaiting_stopdesk_choice') {
    const alts = state.stopDeskAlternatives ?? [];
    if (/domicile|maison|chez.?moi/.test(lower)) {
      const msg = await finalizeEcotrackOrder(state, 0, ecoToken, ecoUrl, deliveryFee);
      return { handled: true, responseText: msg, newState: null };
    }
    const numMatch = lower.match(/^(\d+)$/);
    const idx = numMatch ? parseInt(numMatch[1]) - 1 : -1;
    const chosenByNum = alts[idx];
    const chosenByName = !chosenByNum ? alts.find(a => lower.includes(normalize(a.nom)) || normalize(a.nom).includes(lower)) : null;
    const chosen = chosenByNum ?? chosenByName;
    if (chosen) {
      const newState: EcotrackState = { ...state, communeName: chosen.nom, codePostal: chosen.codePostal };
      const msg = await finalizeEcotrackOrder(newState, 1, ecoToken, ecoUrl, deliveryFee);
      return { handled: true, responseText: msg, newState: null };
    }
    const list = alts.map((a, i) => `${i + 1}. ${a.nom}`).join('\n');
    return { handled: true, responseText: `Tapez un numéro ou "Domicile" :\n${list}`, newState: state };
  }

  return { handled: false };
}

function buildDeliveryTypeMsg(loc: { communeName: string; wilayaName: string; hasStopDesk: boolean }): string {
  const stopLine = loc.hasStopDesk ? '2️⃣ Retrait en *Stop Desk* (agence)' : '2️⃣ Stop Desk _(non disponible dans votre commune)_';
  return (
    `📍 Livraison à *${loc.communeName}*, ${loc.wilayaName}.\n\n` +
    `Comment souhaitez-vous recevoir votre commande ?\n` +
    `1️⃣ Livraison à *domicile*\n${stopLine}`
  );
}

export function buildLocationSuggestionsMsg(suggestions: LocationMatch[], inputCommune: string, inputWilaya: string): string {
  if (suggestions.length === 0) {
    return `❌ La wilaya "${inputWilaya}" ou la commune "${inputCommune}" n'est pas desservie par notre transporteur. Veuillez vérifier et ressaisir votre localisation.`;
  }
  const list = suggestions.map((s, i) => `${i + 1}. *${s.communeName}* — ${s.wilayaName}`).join('\n');
  return (
    `📍 Je n'ai pas trouvé exactement "${inputCommune}" dans "${inputWilaya}".\n\n` +
    `Vouliez-vous dire :\n${list}\n\n` +
    `Tapez le numéro correspondant ou "Non" pour ressaisir.`
  );
}
