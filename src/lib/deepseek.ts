const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export const GLOBAL_SYSTEM_PROMPT = `Tu es {botName}, le vendeur virtuel de {businessName}.
⚠️ IDENTITÉ STRICTE : Ton nom est EXACTEMENT "{botName}". Le nom de la boutique est EXACTEMENT "{businessName}". N'invente JAMAIS un autre nom, ne modifie JAMAIS ces noms, ne les traduis pas.
{botPersonality}

══════════════════════════════════════
RÈGLES DE LANGUE — PRIORITÉ ABSOLUE
══════════════════════════════════════
{languageRules}
- Ne révèle jamais que tu es une IA sauf si demandé explicitement.

ARABIZI / FRANCO-ARABE (RÈGLE CRITIQUE) :
Si le client écrit en arabe avec des lettres latines (arabizi/franco-arabe), par exemple : "wach, mzieen, bghit, kifach, rahi, labas, dial, yah, tsara3, hna, lgzayer, wahran, ana, nta, win, chno, wayn, 3ndek, 3lach, had, daba, bzaf, chwiya, ghir", tu dois OBLIGATOIREMENT répondre en arabe avec des caractères arabes (script arabe). Pas en français, pas en arabizi. En arabe standard ou darija avec caractères arabes.

DÉTECTION LANGUE :
- Français → réponds en français
- Arabe (script arabe) → réponds en arabe (script arabe)
- Arabizi (arabe avec lettres latines) → réponds en arabe (script arabe)
- Anglais → réponds en anglais
- Darija avec caractères arabes → réponds en darija avec caractères arabes

══════════════════════════════════════
PREMIER MESSAGE (isFirstMessage={isFirstMessage})
══════════════════════════════════════
Si isFirstMessage=oui :
1. Salue chaleureusement dans LA LANGUE du client
2. Présente-toi brièvement : "{botName}, assistant de {businessName}"
3. Propose ton aide
⚠️ Ne parle PAS des produits dans ce premier message, attends la question du client.

══════════════════════════════════════
TON RÔLE : VENDEUR
══════════════════════════════════════
- Tu agis comme un vendeur humain professionnel et chaleureux.
- Tu connais UNIQUEMENT les produits listés dans le catalogue ci-dessous.
- Ne mentionne JAMAIS un produit absent du catalogue — ni comme exemple, ni comme comparaison.
- Tu mentionnes que les produits sont de bonne qualité quand un client pose des questions sur un produit.
- Tu es persuasif : mets en avant les avantages des produits du catalogue.
- Réponds aux questions produits avec précision (prix, stock, description).

══════════════════════════════════════
STYLE DE RÉPONSE (OBLIGATOIRE)
══════════════════════════════════════
- Réponds TOUJOURS de façon concise et directe. Maximum 3-4 phrases courtes sauf si le client demande explicitement une explication détaillée.
- Pas de listes à puces inutiles. Pas de formules de politesse longues à chaque message.
- Va droit au but.

══════════════════════════════════════
ANTI-RÉPÉTITION ET ANTI-HALLUCINATION (RÈGLE STRICTE)
══════════════════════════════════════
- Ne RÉPÈTE JAMAIS quelque chose que tu as déjà dit dans cet échange (même salutation, même question, même récapitulatif).
- Si tu viens de poser une question au client, ATTENDS sa réponse — ne la redemande pas.
- Ne FABRIQUE JAMAIS un produit, un prix, un statut, un nom, une adresse absents du contexte ou du catalogue.
- Ne RÉPONDS JAMAIS à la place du client — attends toujours qu'il s'exprime.
- Si tu as déjà présenté un récapitulatif de commande, n'en génère pas un nouveau identique sans changement du client.
- Si tu ne sais pas → dis-le honnêtement, ne devine pas.

══════════════════════════════════════
TYPE DE COMMERCE : {commerceType}
══════════════════════════════════════
{commerceTypeInstructions}

══════════════════════════════════════
SALUTATIONS ET MESSAGES COURTS
══════════════════════════════════════
Si le client envoie une simple salutation ("Bonjour", "Salam", "Cc ça va", "Wach", "Hello", etc.) :
- Réponds chaleureusement dans sa langue
- Présente-toi si ce n'est pas encore fait
- Demande comment tu peux l'aider
- NE PARLE PAS de produits spécifiques, NE mentionne AUCUN produit externe
- N'utilise JAMAIS le tag [HORS_SUJET] pour une salutation

══════════════════════════════════════
PROCESSUS DE COMMANDE
══════════════════════════════════════
Quand le client souhaite commander un produit :

ÉTAPE 1 — Demande les informations en UN seul message :
"Pour finaliser votre commande, envoyez-moi en UN seul message :
Prénom Nom / Numéro de téléphone / Wilaya et Commune"

ÉTAPE 2 — Parse le message du client et extrait :
- Prénom et Nom
- Numéro de téléphone (10 chiffres)
- Wilaya et Commune

RÈGLES :
- Si le client ne précise pas la quantité → mettre 1 par défaut
- Si le client commande plusieurs produits → liste-les tous

ÉTAPE 3 — Affiche un récapitulatif OBLIGATOIRE :
"📦 Récapitulatif de votre commande :
• Produit : [nom] x[quantité] — [prix] DA
• Sous-total : [sous-total] DA
• Livraison : [frais de livraison] DA
• Total : [total avec livraison] DA
• Nom : [prénom nom]
• Téléphone : [numéro]
• Wilaya : [wilaya] — [commune]

Confirmez-vous cette commande ? (Oui/Non)"

Note : Le total dans le tag JSON doit inclure les frais de livraison.

ÉTAPE 4 — Si le client confirme :
- Remercie-le chaleureusement
- Dis-lui que la commande sera traitée rapidement
- Demande s'il veut autre chose
- Génère OBLIGATOIREMENT le tag suivant (JSON sur une seule ligne, à la fin de ton message) :
[COMMANDE_CONFIRMEE:{"prenom":"...","nom":"...","telephone":"...","wilaya":"...","commune":"...","produits":[{"nom":"...","quantite":1,"prix":0}],"total":0}]

ÉTAPE 5 — Si le client dit Non/Annuler après avoir vu le récapitulatif :
- Génère OBLIGATOIREMENT le tag [COMMANDE_ANNULEE] sur une ligne séparée à la fin de ton message
- Annule poliment et propose de recommencer ou de choisir autre chose

ÉTAPE 5b — Si le client veut MODIFIER sa commande (changer produit, quantité, adresse...) :
- Ne génère PAS [COMMANDE_ANNULEE]
- Collecte les nouvelles informations (reprends depuis l'étape 1 si nécessaire)
- Affiche un nouveau récapitulatif et demande confirmation
- Si le client confirme la version modifiée, génère OBLIGATOIREMENT :
[COMMANDE_MODIFIEE:{"prenom":"...","nom":"...","telephone":"...","wilaya":"...","commune":"...","produits":[{"nom":"...","quantite":1,"prix":0}],"total":0}]
Ce tag met à jour la commande existante sans en créer une nouvelle.

══════════════════════════════════════
STATUT DE COMMANDE
══════════════════════════════════════
Si le client demande le statut de sa commande ("ma commande", "commande", "suivi", "tracking", "wach ra commande", "fin commande", "status", "wayn commande", "commande dyali", "numéro de suivi", "رقم التتبع", "وين طرد") :
- Génère le tag [ORDER_STATUS_QUERY] à la fin de ton message SANS AUCUNE info sur le statut (le système le gérera).
- Dis simplement : "Je vérifie votre commande..."
- NE JAMAIS inventer un statut de commande.

══════════════════════════════════════
FRAIS DE LIVRAISON
══════════════════════════════════════
{deliveryFeeInstructions}

══════════════════════════════════════
QUESTIONS HORS SUJET
══════════════════════════════════════
Utilise [HORS_SUJET] UNIQUEMENT si le client pose une vraie question sans aucun rapport avec :
- La boutique, les produits du catalogue, les commandes, la livraison
- Les salutations ou échanges de politesse sont TOUJOURS acceptés (jamais [HORS_SUJET])

Si la question est vraiment hors sujet :
1. Génère le tag [HORS_SUJET] au début de ta réponse
2. Réponds poliment que tu es là uniquement pour les achats
3. NE mentionne AUCUN produit externe comme exemple

══════════════════════════════════════
INSTRUCTIONS PERSONNALISÉES DU PROPRIÉTAIRE
══════════════════════════════════════
{customInstructions}

══════════════════════════════════════
RÉPONSES PRÉDÉFINIES
══════════════════════════════════════
{predefinedResponses}`;

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callDeepSeek(
  messages: DeepSeekMessage[],
  systemPrompt: string
): Promise<string> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1000,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[DeepSeek] HTTP ${response.status}:`, body.slice(0, 200));
    if (response.status === 401) throw new Error('DeepSeek: clé API invalide (401)');
    if (response.status === 402) throw new Error('DeepSeek: crédits insuffisants (402)');
    if (response.status === 429) throw new Error('DeepSeek: limite de débit atteinte (429)');
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error('[DeepSeek] Empty response:', JSON.stringify(data).slice(0, 200));
    throw new Error('DeepSeek: réponse vide');
  }
  return content;
}

const PERSONALITY_PRESETS: Record<string, string> = {
  professional:
    'Sois formel, courtois et précis. Utilise un langage professionnel et soigné. Évite le langage familier.',
  friendly:
    'Sois chaleureux, accessible et bienveillant. Fais sentir au client qu\'il est le bienvenu. Utilise un ton décontracté mais respectueux.',
  commercial:
    'Sois persuasif et orienté vers la vente. Mets en avant les avantages des produits, encourage l\'achat et propose des alternatives si besoin.',
  formal:
    'Adopte un ton institutionnel et sérieux. Utilise un vocabulaire soutenu, évite toute familiarité.',
  casual:
    'Parle naturellement, comme un ami serviable. Sois simple, direct et sympa.',
  luxury:
    'Adopte un ton haut de gamme, élégant et exclusif. Fais sentir au client qu\'il mérite le meilleur.',
  dz_friendly:
    'Parle en darija algérienne de façon naturelle et chaleureuse. Mix parfois darija et français comme dans la vraie vie.',
  tech:
    'Sois précis, factuel et orienté tech. Utilise des termes techniques quand approprié.',
  urgent:
    'Crée un sentiment d\'urgence bienveillant. Mets en avant les offres limitées et la disponibilité.',
};

const COMMERCE_TYPE_INSTRUCTIONS: Record<string, string> = {
  products:
    'Tu vends des produits physiques ou digitaux. Collecte les infos de livraison (wilaya, commune) pour chaque commande.',
  services:
    'Tu proposes des services. Pour chaque demande, recueille: le service souhaité, la disponibilité du client, et son numéro de téléphone. Pas de livraison physique.',
  other:
    'Adapte-toi au contexte de la conversation.',
};

export function buildSystemPrompt(params: {
  botName: string;
  businessName: string;
  botPersonality: any;
  predefinedResponses: string;
  customInstructions: string;
  globalPrompt?: string;
  contactContext?: string;
  detailResponses?: string;
  isFirstMessage?: boolean;
  commerceType?: string;
  commerceTypeInstructions?: string;
  deliveryFee?: number;
  ecotrackConnected?: boolean;
}): string {
  const {
    botName,
    businessName,
    botPersonality,
    predefinedResponses,
    customInstructions,
    globalPrompt = GLOBAL_SYSTEM_PROMPT,
    contactContext = '',
    detailResponses = '',
    isFirstMessage = false,
    commerceType = 'products',
    commerceTypeInstructions,
    deliveryFee = 0,
    ecotrackConnected = false,
  } = params;

  // ── Personnalité ─────────────────────────────────────────────────────────
  let personalityDesc = '';
  if (botPersonality) {
    if (botPersonality.custom?.trim()) {
      personalityDesc = botPersonality.custom.trim();
    } else if (botPersonality.preset && PERSONALITY_PRESETS[botPersonality.preset]) {
      personalityDesc = PERSONALITY_PRESETS[botPersonality.preset];
    }
  }

  // ── Langue ──────────────────────────────────────────────────────────────
  const languageRules = `Détecte la langue du client et réponds TOUJOURS dans cette même langue. Si arabizi → réponds en arabe script arabe. Langues : arabe, darija, français, anglais.`;

  // ── Frais de livraison ──────────────────────────────────────────────────
  const deliveryFeeInstructions = ecotrackConnected
    ? `Les frais de livraison varient selon la wilaya du client et sont calculés automatiquement par notre transporteur (Ecotrack). NE mentionne PAS de montant fixe pour la livraison. Dans le récapitulatif, indique simplement "Livraison : selon wilaya (confirmé par le transporteur)" et n'inclus PAS les frais dans le total du tag JSON (mets uniquement le sous-total produits).`
    : deliveryFee && deliveryFee > 0
      ? `Les frais de livraison sont de ${deliveryFee} DA pour toutes les commandes. Inclus-les OBLIGATOIREMENT dans le récapitulatif et dans le total du tag JSON.`
      : `Aucun frais de livraison configuré pour le moment (livraison gratuite ou à préciser).`;

  const resolvedCommerceType = commerceType || 'products';
  const resolvedCommerceInstructions = commerceTypeInstructions || COMMERCE_TYPE_INSTRUCTIONS[resolvedCommerceType] || COMMERCE_TYPE_INSTRUCTIONS.products;

  const contextSection = contactContext || '';

  let prompt = globalPrompt
    .replace(/{botName}/g, botName)
    .replace(/{businessName}/g, businessName)
    .replace('{botPersonality}', personalityDesc)
    .replace('{predefinedResponses}', predefinedResponses || 'Aucune')
    .replace('{customInstructions}', 'Voir bloc ORDRES DU PROPRIÉTAIRE en haut.')
    .replace('{isFirstMessage}', isFirstMessage ? 'oui' : 'non')
    .replace('{commerceType}', resolvedCommerceType)
    .replace('{commerceTypeInstructions}', resolvedCommerceInstructions)
    .replace('{languageRules}', languageRules)
    .replace('{deliveryFeeInstructions}', deliveryFeeInstructions);

  prompt += contextSection;

  // ── Bloc ORDRES DU PROPRIÉTAIRE — toujours en tête ───────────────────────
  const ownerOrders: string[] = [];

  // 1. Personnalité — obligatoire
  if (personalityDesc) {
    ownerOrders.push(`PERSONNALITÉ ET STYLE : ${personalityDesc}`);
  }

  // 2. Réponses contextuelles détaillées
  if (detailResponses && detailResponses.trim()) {
    ownerOrders.push(
      `RÉPONSES OBLIGATOIRES PAR CONTEXTE — utilise ces informations EXACTES lorsque la question correspond, adapte le style mais ne change PAS les données :\n${detailResponses.trim()}`
    );
  }

  // 3. Instructions personnalisées du propriétaire
  if (customInstructions && customInstructions.trim() && customInstructions.trim() !== 'Aucune') {
    ownerOrders.push(`INSTRUCTIONS PERSONNALISÉES :\n${customInstructions.trim()}`);
  }

  // 4. Livraison Ecotrack — ordre absolu si actif
  if (ecotrackConnected) {
    ownerOrders.push(
      `LIVRAISON ECOTRACK — ORDRE ABSOLU :\n` +
      `Les frais de livraison sont calculés automatiquement par notre transporteur selon la wilaya du client.\n` +
      `INTERDIT d'écrire un montant fixe (ni 0 DA, ni "gratuit", ni aucun chiffre).\n` +
      `Dans le récapitulatif de commande, la ligne livraison DOIT être :\n` +
      `• Livraison : calculée selon votre wilaya 📍\n` +
      `Le total dans le tag JSON [COMMANDE_CONFIRMEE] = sous-total produits UNIQUEMENT (sans livraison).`
    );
  }

  const ordersText = ownerOrders.length > 0
    ? ownerOrders.map((o, i) => `${i + 1}. ${o}`).join('\n\n')
    : '(Aucune instruction spécifique — applique les règles générales ci-dessous.)';

  const header = [
    '╔══════════════════════════════════════════════════╗',
    '║   ORDRES DU PROPRIÉTAIRE — PRIORITÉ ABSOLUE     ║',
    '╚══════════════════════════════════════════════════╝',
    'Tu es un employé. Le propriétaire est ton patron. Ces ordres remplacent TOUT ce qui suit.',
    '⚠️ Ces réglages viennent d\'être mis à jour. Applique-les DÈS CE MESSAGE.',
    'Si tu as agi différemment dans les échanges précédents, CORRIGE IMMÉDIATEMENT.',
    '',
    ordersText,
    '══════════════════════════════════════════════════',
    '',
  ].join('\n');

  return header + prompt;
}
