const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export const GLOBAL_SYSTEM_PROMPT = `Tu es {botName}, le vendeur virtuel de {businessName}.
{botPersonality}

══════════════════════════════════════
RÈGLES DE LANGUE (ABSOLUES)
══════════════════════════════════════
- Détecte la langue/dialecte du client et réponds TOUJOURS dans cette même langue.
- Langues supportées : arabe classique (فصحى), darija algérienne, darija marocaine, tous dialectes arabes, français, anglais, et toute autre langue.
- Ne mélange JAMAIS les langues dans un même message.
- Adapte le registre (formel/informel) automatiquement.
- Ne révèle jamais que tu es une IA sauf si demandé explicitement.

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
• Total : [total] DA
• Nom : [prénom nom]
• Téléphone : [numéro]
• Wilaya : [wilaya] — [commune]

Confirmez-vous cette commande ? (Oui/Non)"

ÉTAPE 4 — Si le client confirme :
- Remercie-le chaleureusement
- Dis-lui que la commande sera traitée rapidement
- Demande s'il veut autre chose
- Génère OBLIGATOIREMENT le tag suivant (JSON sur une seule ligne, à la fin de ton message) :
[COMMANDE_CONFIRMEE:{"prenom":"...","nom":"...","telephone":"...","wilaya":"...","commune":"...","produits":[{"nom":"...","quantite":1,"prix":0}],"total":0}]

ÉTAPE 5 — Si le client dit Non/Annuler → annule poliment et propose d'autres produits.

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
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
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
  } = params;

  let personalityDesc = '';

  if (botPersonality) {
    // Nouveau format : { preset: string, custom: string }
    if (typeof botPersonality.preset === 'string' || typeof botPersonality.custom === 'string') {
      if (botPersonality.custom?.trim()) {
        personalityDesc = botPersonality.custom.trim();
      } else if (botPersonality.preset && PERSONALITY_PRESETS[botPersonality.preset]) {
        personalityDesc = PERSONALITY_PRESETS[botPersonality.preset];
      }
    } else {
      // Ancien format : { formality, friendliness, responseLength, emojiUsage }
      const { formality, friendliness, responseLength, emojiUsage } = botPersonality;
      if (formality <= 3) personalityDesc += 'Be casual and relaxed in your tone. ';
      else if (formality >= 8) personalityDesc += 'Be formal and professional. ';
      if (friendliness >= 8) personalityDesc += 'Be very warm, friendly and empathetic. ';
      if (responseLength <= 3) personalityDesc += 'Keep responses very brief and concise. ';
      else if (responseLength >= 8) personalityDesc += 'Give detailed and comprehensive responses. ';
      if (emojiUsage >= 7) personalityDesc += 'Use emojis frequently to make responses engaging. ';
      else if (emojiUsage <= 2) personalityDesc += 'Avoid using emojis. ';
    }
  }

  // Construire les sections optionnelles
  const detailSection = detailResponses
    ? `\n\nRÉPONSES DÉTAILLÉES CONTEXTUELLES (adapte le style mais garde toujours ces informations exactes) :\n${detailResponses}`
    : '';

  const contextSection = contactContext || '';

  let prompt = globalPrompt
    .replace(/{botName}/g, botName)
    .replace(/{businessName}/g, businessName)
    .replace('{botPersonality}', personalityDesc)
    .replace('{predefinedResponses}', predefinedResponses || 'Aucune')
    .replace('{customInstructions}', customInstructions || 'Aucune')
    .replace('{isFirstMessage}', isFirstMessage ? 'oui' : 'non');

  prompt += detailSection;
  prompt += contextSection;

  return prompt;
}
