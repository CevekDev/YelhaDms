import { prisma } from './prisma';

// ── Local Ecotrack data (1 542 communes, tarifs inclus) ─────────────────────
import RAW_DATA from '../data/ecotrack_data.json';

type EcoEntry = {
  wilaya_id: number;
  wilaya_nom: string;
  commune: string;
  code_postal: string;
  has_stop_desk: number;
  tarifs: { livraison: { domicile: string; stop_desk: string } };
};

const DATA = RAW_DATA as EcoEntry[];

export type EcoWilaya = { wilaya_id: number; wilaya_name: string };
export type EcoCommune = { nom: string; wilaya_id: number; code_postal: string; has_stop_desk: number };

export type EcotrackStep =
  | 'awaiting_location_confirm'
  | 'awaiting_delivery_type'
  | 'awaiting_stopdesk_choice'
  | 'awaiting_address_input';

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
  retryCount?: number;
  suggestions?: Array<{ wilayaId: number; wilayaName: string; communeName: string; codePostal: string; hasStopDesk: boolean }>;
  stopDeskAlternatives?: Array<{ nom: string; codePostal: string }>;
  /** Tarifs récupérés depuis l'API Ecotrack pour la wilaya du client */
  tarifDomicile?: number | null;
  tarifStopDesk?: number | null;
  autoShip?: boolean;
}

export interface LocationMatch {
  wilayaId: number;
  wilayaName: string;
  communeName: string;
  codePostal: string;
  hasStopDesk: boolean;
}

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

function transliterateArabic(s: string): string {
  const map: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'dj', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'ch', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'dh', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'k', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'ou', 'ي': 'i', 'ى': 'a', 'ة': 'a', 'ء': '', 'ـ': '',
    'َ': '', 'ِ': '', 'ُ': '', 'ً': '', 'ٍ': '', 'ٌ': '', 'ْ': '', 'ّ': '',
  };
  const result = s.split('').map(c => map[c] ?? c).join('').replace(/\s+/g, ' ').trim();
  return result;
}

function getLocalWilayas(): EcoWilaya[] {
  const seen = new Set<number>();
  const out: EcoWilaya[] = [];
  for (const e of DATA) {
    if (!seen.has(e.wilaya_id)) { seen.add(e.wilaya_id); out.push({ wilaya_id: e.wilaya_id, wilaya_name: e.wilaya_nom }); }
  }
  return out;
}

function getLocalCommunes(wilayaId?: number): EcoCommune[] {
  const entries = wilayaId != null ? DATA.filter(e => e.wilaya_id === wilayaId) : DATA;
  return entries.map(e => ({ nom: e.commune, wilaya_id: e.wilaya_id, code_postal: e.code_postal, has_stop_desk: e.has_stop_desk }));
}

export function getWilayaDeliveryFees(wilayaId: number): { domicile: number; stopDesk: number } {
  const entry = DATA.find(e => e.wilaya_id === wilayaId);
  if (!entry) return { domicile: 0, stopDesk: 0 };
  return {
    domicile: Number(entry.tarifs?.livraison?.domicile) || 0,
    stopDesk: Number(entry.tarifs?.livraison?.stop_desk) || 0,
  };
}

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

// ── Validate wilaya + commune against local data ─────────────────────────────
export async function validateLocation(
  _url: string,
  _token: string,
  inputWilaya: string,
  inputCommune: string,
): Promise<{ found: LocationMatch | null; suggestions: LocationMatch[] }> {
  const wilayas = getLocalWilayas();
  const normW = normalize(inputWilaya);
  const normWLatin = normalize(transliterateArabic(inputWilaya));

  // 1. Resolve wilaya_id — alias table first (handles Arabic/Daridja)
  let wilayaId: number | null = null;
  for (const [alias, id] of Object.entries(WILAYA_ALIASES)) {
    const na = normalize(alias);
    if (normW === na || normW.includes(na) || na.includes(normW)) { wilayaId = id; break; }
  }
  // Also try transliterated Arabic against alias table
  if (!wilayaId && normWLatin !== normW) {
    for (const [alias, id] of Object.entries(WILAYA_ALIASES)) {
      const na = normalize(alias);
      if (normWLatin === na || normWLatin.includes(na) || na.includes(normWLatin)) { wilayaId = id; break; }
    }
  }
  // Fuzzy match on French wilaya names
  if (!wilayaId) {
    let best = Infinity;
    for (const w of wilayas) {
      const n = normalize(w.wilaya_name);
      for (const inp of [normW, normWLatin]) {
        const d = levenshtein(inp, n);
        const ratio = d / Math.max(inp.length, n.length, 1);
        if (ratio < 0.4 && d < best) { best = d; wilayaId = w.wilaya_id; }
      }
    }
  }

  const matchedWilaya = wilayaId ? wilayas.find(w => w.wilaya_id === wilayaId) : null;
  const pool = getLocalCommunes(wilayaId ?? undefined);
  const allCommunes = wilayaId ? pool : getLocalCommunes();

  const normC = normalize(inputCommune);
  const normCLatin = normalize(transliterateArabic(inputCommune));

  // Try exact / substring match on commune name
  let exactC: EcoCommune | null = null;
  let bestDist = Infinity;
  let bestC: EcoCommune | null = null;

  for (const c of pool) {
    const n = normalize(c.nom);
    for (const inp of [normC, normCLatin]) {
      if (n === inp || n.includes(inp) || inp.includes(n)) { exactC = c; break; }
    }
    if (exactC) break;
    const d = Math.min(levenshtein(normC, n), levenshtein(normCLatin, n));
    if (d < bestDist) { bestDist = d; bestC = c; }
  }

  const toMatch = (c: EcoCommune, wId: number): LocationMatch => ({
    wilayaId: wId,
    wilayaName: matchedWilaya?.wilaya_name ?? wilayas.find(w => w.wilaya_id === wId)?.wilaya_name ?? `Wilaya ${wId}`,
    communeName: c.nom,
    codePostal: c.code_postal,
    hasStopDesk: c.has_stop_desk === 1,
  });

  if (exactC && wilayaId) return { found: toMatch(exactC, wilayaId), suggestions: [] };

  // Build suggestions — top 3 from wilaya pool + cross-wilaya search
  const suggestions: LocationMatch[] = [];
  if (bestC && bestDist <= 5 && wilayaId) suggestions.push(toMatch(bestC, wilayaId));

  const global = allCommunes
    .filter(c => c.wilaya_id !== wilayaId)
    .map(c => ({ c, d: Math.min(levenshtein(normC, normalize(c.nom)), levenshtein(normCLatin, normalize(c.nom))) }))
    .filter(x => x.d <= 4)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2);
  for (const { c } of global) {
    const wName = wilayas.find(w => w.wilaya_id === c.wilaya_id)?.wilaya_name ?? `Wilaya ${c.wilaya_id}`;
    suggestions.push({ wilayaId: c.wilaya_id, wilayaName: wName, communeName: c.nom, codePostal: c.code_postal, hasStopDesk: c.has_stop_desk === 1 });
  }

  return { found: null, suggestions: suggestions.slice(0, 3) };
}

export async function getStopDeskAlternatives(_url: string, _token: string, wilayaId: number): Promise<EcoCommune[]> {
  return getLocalCommunes(wilayaId).filter(c => c.has_stop_desk === 1);
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
  autoShip = false,
): Promise<string> {
  const { orderData, orderId, wilayaId, communeName, wilayaName } = state;

  // Priorité : tarif Ecotrack (par wilaya) > tarif manuel configuré dans les réglages
  const ecoTarif = deliveryType === 0
    ? (state.tarifDomicile ?? null)
    : (state.tarifStopDesk ?? state.tarifDomicile ?? null);
  const resolvedFee = ecoTarif ?? deliveryFee;
  const nom = [orderData.prenom, orderData.nom].filter(Boolean).join(' ') || 'Client';
  const phone = (orderData.telephone || '').replace(/\D/g, '').slice(-10);
  const adresse = orderData.adresse || `${orderData.commune || ''} ${orderData.wilaya || ''}`.trim() || communeName;
  const produit = (orderData.produits || []).map((p: any) => `${p.nom} x${p.quantite}`).join(', ');

  // Use the already-persisted order total (correctly computed from product prices in DB)
  // orderData.total is unreliable — the AI JSON may not include it
  const dbOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { totalAmount: true } });
  const productTotal = dbOrder?.totalAmount ?? 0;

  // Total the courier collects from the customer = products + delivery fee (COD amount)
  // resolvedFee = tarif Ecotrack par wilaya (si dispo) sinon tarif manuel
  const totalWithDelivery = productTotal + (resolvedFee || 0);

  const result = await createEcotrackOrder(ecoUrl, ecoToken, {
    nom_client: nom,
    telephone: phone,
    adresse,
    commune: communeName,
    code_wilaya: wilayaId,
    montant: totalWithDelivery,   // COD: customer pays products + delivery
    stop_desk: deliveryType,
    produit: produit || undefined,
    reference: orderId.slice(-8).toUpperCase(),
  });

  if (result.success && result.tracking) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode: result.tracking,
        ecotrackTracking: result.tracking,
        deliveryType,
        codeWilaya: wilayaId,
        deliveryFee: resolvedFee || 0,
        totalAmount: totalWithDelivery,
        notes: `Wilaya: ${wilayaName} — Commune: ${communeName}`,
        // Status stays PENDING — confirmed only when customer replies "oui"
      },
    });

    // Auto-ship if enabled: immediately validate the order on Ecotrack
    if (autoShip) {
      await shipEcotrackOrder(ecoUrl, ecoToken, result.tracking).catch(() => {});
      await prisma.order.update({ where: { id: orderId }, data: { status: 'SHIPPED' } }).catch(() => {});
    }

    const mode = deliveryType === 0 ? 'à domicile' : 'en Stop Desk';
    const deliveryLine = resolvedFee > 0 ? `\n🚚 Livraison : *${resolvedFee.toLocaleString('fr-DZ')} DA*` : '';
    const autoShipLine = autoShip ? `\n🚀 Expédition automatique activée — votre colis est en route !` : '';
    return (
      `✅ *Commande enregistrée !*\n\n` +
      `📍 Livraison ${mode} à *${communeName}*, ${wilayaName}\n` +
      `📦 Tracking : *${result.tracking}*` +
      deliveryLine +
      `\n💰 Total : *${totalWithDelivery.toLocaleString('fr-DZ')} DA*\n\n` +
      `Votre commande est en attente de confirmation. Nous vous contacterons bientôt. 🙏` +
      autoShipLine
    );
  }

  // Ecotrack failed — still save what we have
  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryType,
      codeWilaya: wilayaId,
      deliveryFee: resolvedFee || 0,
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
  autoShip = false,
): Promise<EcoHandlerResult> {
  const lower = text.toLowerCase().trim();
  const effectiveAutoShip = state.autoShip ?? autoShip;

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
      const fees = getWilayaDeliveryFees(s.wilayaId);
      const newState: EcotrackState = { ...state, step: 'awaiting_delivery_type', wilayaId: s.wilayaId, wilayaName: s.wilayaName, communeName: s.communeName, codePostal: s.codePostal, hasStopDesk: s.hasStopDesk, suggestions: undefined, tarifDomicile: fees.domicile, tarifStopDesk: fees.stopDesk };
      return { handled: true, responseText: buildDeliveryTypeMsg(s, fees.domicile, fees.stopDesk), newState };
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
      const msg = await finalizeEcotrackOrder(state, 0, ecoToken, ecoUrl, deliveryFee, effectiveAutoShip);
      return { handled: true, responseText: msg, newState: null };
    }
    if (isStop) {
      if (state.hasStopDesk) {
        const msg = await finalizeEcotrackOrder(state, 1, ecoToken, ecoUrl, deliveryFee, effectiveAutoShip);
        return { handled: true, responseText: msg, newState: null };
      }
      // No stop desk in this commune — find alternatives
      const alts = await getStopDeskAlternatives(ecoUrl, ecoToken, state.wilayaId);
      if (alts.length === 0) {
        const msg = await finalizeEcotrackOrder(state, 0, ecoToken, ecoUrl, deliveryFee, effectiveAutoShip);
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
    return { handled: true, responseText: buildDeliveryTypeMsg(state, state.tarifDomicile, state.tarifStopDesk), newState: state };
  }

  // ── Step: awaiting_address_input ─────────────────────────────────────────
  // Entered when location not found at all after order creation.
  // User types "Wilaya / Commune" and we re-validate.
  if (state.step === 'awaiting_address_input') {
    // Parse "Wilaya / Commune" or "Wilaya, Commune" or plain text
    const parts = text.split(/[\/,|]/).map(s => s.trim()).filter(Boolean);
    const inputWilaya = parts[0] || text.trim();
    const inputCommune = parts[1] || text.trim();

    const { found, suggestions } = await validateLocation(ecoUrl, ecoToken, inputWilaya, inputCommune);

    if (found) {
      const fees = getWilayaDeliveryFees(found.wilayaId);
      const newState: EcotrackState = {
        ...state,
        step: 'awaiting_delivery_type',
        wilayaId: found.wilayaId,
        wilayaName: found.wilayaName,
        communeName: found.communeName,
        codePostal: found.codePostal,
        hasStopDesk: found.hasStopDesk,
        suggestions: undefined,
        retryCount: 0,
        tarifDomicile: fees.domicile,
        tarifStopDesk: fees.stopDesk,
      };
      return { handled: true, responseText: buildDeliveryTypeMsg(found, fees.domicile, fees.stopDesk), newState };
    }

    if (suggestions.length > 0) {
      const newState: EcotrackState = {
        ...state,
        step: 'awaiting_location_confirm',
        wilayaId: suggestions[0].wilayaId,
        wilayaName: suggestions[0].wilayaName,
        communeName: suggestions[0].communeName,
        codePostal: suggestions[0].codePostal,
        hasStopDesk: suggestions[0].hasStopDesk,
        suggestions,
      };
      return { handled: true, responseText: buildLocationSuggestionsMsg(suggestions, inputCommune, inputWilaya), newState };
    }

    // Still not found — allow up to 3 retries
    const retryCount = (state.retryCount || 0) + 1;
    if (retryCount >= 3) {
      return {
        handled: true,
        responseText: `❌ Désolé, votre zone n'est pas desservie par notre transporteur. Contactez-nous directement pour finaliser votre commande.`,
        newState: null,
      };
    }
    return {
      handled: true,
      responseText: `❌ Introuvable. Réessayez avec le format :\n*Wilaya / Commune*\nExemple : *Alger / Bab El Oued*`,
      newState: { ...state, step: 'awaiting_address_input', retryCount },
    };
  }

  // ── Step: awaiting_stopdesk_choice ────────────────────────────────────────
  if (state.step === 'awaiting_stopdesk_choice') {
    const alts = state.stopDeskAlternatives ?? [];
    if (/domicile|maison|chez.?moi/.test(lower)) {
      const msg = await finalizeEcotrackOrder(state, 0, ecoToken, ecoUrl, deliveryFee, effectiveAutoShip);
      return { handled: true, responseText: msg, newState: null };
    }
    const numMatch = lower.match(/^(\d+)$/);
    const idx = numMatch ? parseInt(numMatch[1]) - 1 : -1;
    const chosenByNum = alts[idx];
    const chosenByName = !chosenByNum ? alts.find(a => lower.includes(normalize(a.nom)) || normalize(a.nom).includes(lower)) : null;
    const chosen = chosenByNum ?? chosenByName;
    if (chosen) {
      const newState: EcotrackState = { ...state, communeName: chosen.nom, codePostal: chosen.codePostal };
      const msg = await finalizeEcotrackOrder(newState, 1, ecoToken, ecoUrl, deliveryFee, effectiveAutoShip);
      return { handled: true, responseText: msg, newState: null };
    }
    const list = alts.map((a, i) => `${i + 1}. ${a.nom}`).join('\n');
    return { handled: true, responseText: `Tapez un numéro ou "Domicile" :\n${list}`, newState: state };
  }

  return { handled: false };
}

function buildDeliveryTypeMsg(
  loc: { communeName: string; wilayaName: string; hasStopDesk: boolean },
  tarifDomicile?: number | null,
  tarifStopDesk?: number | null,
): string {
  const domPrix = tarifDomicile != null ? ` — *${tarifDomicile.toLocaleString('fr-DZ')} DA*` : '';
  const stopPrix = tarifStopDesk != null ? ` — *${tarifStopDesk.toLocaleString('fr-DZ')} DA*` : '';
  const stopLine = loc.hasStopDesk
    ? `2️⃣ Retrait en *Stop Desk* (agence)${stopPrix}`
    : '2️⃣ Stop Desk _(non disponible dans votre commune)_';
  return (
    `📍 Livraison à *${loc.communeName}*, ${loc.wilayaName}.\n\n` +
    `Comment souhaitez-vous recevoir votre commande ?\n` +
    `1️⃣ Livraison à *domicile*${domPrix}\n${stopLine}`
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

/** Fetch live order status from Ecotrack API */
export async function getTrackingStatus(
  ecoUrl: string,
  ecoToken: string,
  tracking: string,
): Promise<{ status: string; statusLabel: string } | null> {
  try {
    const res = await fetch(`${ecoUrl}/api/v1/get/order?tracking=${encodeURIComponent(tracking)}`, {
      headers: ecoHeaders(ecoToken),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Ecotrack may return status as number or string
    const raw = data.etat ?? data.status ?? data.statut ?? data.state ?? null;
    if (raw == null) return null;
    const LABELS: Record<string | number, string> = {
      0: '📋 En attente', 1: '✅ Confirmée', 2: '🔄 En traitement', 3: '📦 Prête',
      4: '🚚 En livraison', 5: '✅ Livrée', 6: '↩️ Retournée', 7: '❌ Annulée',
      'pending': '📋 En attente', 'confirmed': '✅ Confirmée', 'processing': '🔄 En traitement',
      'shipped': '🚚 En livraison', 'delivered': '✅ Livrée', 'returned': '↩️ Retournée', 'cancelled': '❌ Annulée',
    };
    return { status: String(raw), statusLabel: LABELS[raw] ?? String(raw) };
  } catch {
    return null;
  }
}
