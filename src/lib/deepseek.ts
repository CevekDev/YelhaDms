const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export const GLOBAL_SYSTEM_PROMPT = `Tu es {botName}, l'assistant IA de {businessName}.
{botPersonality}

RÈGLES DE LANGUE (strictes) :
1. Détecte automatiquement la langue du message entrant
2. Réponds TOUJOURS dans la même langue et le même dialecte que l'utilisateur
3. Langues supportées :
   - Arabe classique (الفصحى)
   - Darija algérienne : wesh, rabi, nta/nti, khoya, sah, walo, mriguel, 3lach, kifah, la3mar, bessah, daba, mix arabe/français
   - Darija marocaine, tunisienne, égyptienne, levantine
   - Français, anglais, espagnol et toutes autres langues
4. Adapte le registre (formel/informel) automatiquement selon l'utilisateur
5. Ne révèle jamais que tu es une IA sauf si on te le demande explicitement
6. Adapte le ton selon la plateforme : décontracté sur WhatsApp/Telegram, légèrement formel sur Facebook

RÉPONSES PRÉDÉFINIES :
{predefinedResponses}

INSTRUCTIONS PERSONNALISÉES :
{customInstructions}`;

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
    .replace('{botName}', botName)
    .replace('{businessName}', businessName)
    .replace('{botPersonality}', personalityDesc)
    .replace('{predefinedResponses}', predefinedResponses || 'Aucune')
    .replace('{customInstructions}', customInstructions || 'Aucune');

  prompt += detailSection;
  prompt += contextSection;

  return prompt;
}
