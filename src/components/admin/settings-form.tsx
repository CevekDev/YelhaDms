'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RotateCcw, Terminal } from 'lucide-react';

const ORANGE = '#FF6B2C';

const DEFAULT_PROMPT = `You are {botName}, an intelligent assistant for {businessName}.
{botPersonality}

LANGUAGE RULES (strict):
1. Detect the language of the incoming message automatically
2. Reply ALWAYS in the exact same language and dialect as the user
3. Supported languages include:
   - Arabic MSA (الفصحى)
   - Algerian Darija: wesh, rabi, nta/nti, khoya, sah, walo, mriguel, 3lach, kifah, la3mar, bessah, daba, mix Arabic/French
   - Moroccan Darija: واخا, مزيان, دابا
   - Tunisian, Egyptian, Levantine dialects
   - French, English, Spanish, and all other languages
4. Match the user's register (formal/informal) automatically
5. Never reveal you are an AI unless directly and explicitly asked
6. Adapt tone per platform: casual WhatsApp/Telegram, slightly formal Facebook

PREDEFINED RESPONSES:
{predefinedResponses}

CUSTOM INSTRUCTIONS:
{customInstructions}`;

export default function AdminSettingsForm({ initialPrompt }: { initialPrompt: string }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(initialPrompt || DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'global_system_prompt', value: prompt }),
      });
      if (res.ok) {
        toast({ title: '✅ Prompt système sauvegardé !' });
      } else {
        toast({ title: 'Erreur lors de la sauvegarde', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
          <Terminal className="w-4 h-4" style={{ color: ORANGE }} />
        </div>
        <div>
          <h2 className="font-mono font-semibold text-white text-sm">Prompt système global</h2>
          <p className="text-xs text-white/30 mt-0.5">
            Utilisé pour toutes les conversations IA. Variables disponibles :{' '}
            {['{botName}', '{businessName}', '{botPersonality}', '{predefinedResponses}', '{customInstructions}'].map(v => (
              <code key={v} className="font-mono text-[10px] px-1 py-0.5 rounded bg-white/[0.06] text-white/50 mr-1">{v}</code>
            ))}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <textarea
          className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm min-h-[380px] font-mono text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[#FF6B2C]/30 transition-colors resize-y"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 font-mono text-sm text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: ORANGE }}
          >
            {saving && <Loader2 className="animate-spin w-4 h-4" />}
            Sauvegarder
          </button>
          <button
            onClick={() => setPrompt(DEFAULT_PROMPT)}
            className="flex items-center gap-2 font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] hover:bg-white/[0.04] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}
