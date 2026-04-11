'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Send, Settings, Trash2, Loader2, Clock,
  MessageCircle, Instagram, Facebook, HelpCircle,
  CheckCircle, ExternalLink, ChevronDown, ChevronUp,
  Bot, User, Hash,
} from 'lucide-react';
import Link from 'next/link';

const ORANGE = '#FF6B2C';
const SKY = '#0ea5e9';

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
};

const INPUT_CLASS = `w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5
  text-sm font-mono text-white placeholder:text-white/20
  focus:outline-none focus:border-[#FF6B2C]/40 transition-colors`;

const SOON_PLATFORMS = [
  { value: 'WHATSAPP', label: 'WhatsApp Business', icon: MessageCircle, color: '#25d366' },
  { value: 'INSTAGRAM', label: 'Instagram DM', icon: Instagram, color: '#e1306c' },
  { value: 'FACEBOOK', label: 'Facebook Messenger', icon: Facebook, color: '#1877f2' },
];

const STEPS_FR = [
  { icon: '🔍', text: 'Ouvrez Telegram et recherchez @BotFather' },
  { icon: '⌨️', text: 'Envoyez /newbot et suivez les instructions' },
  { icon: '📋', text: 'Copiez le token fourni par BotFather' },
  { icon: '💬', text: 'Collez le token ci-dessus, puis envoyez un message à votre bot — YelhaDms capturera votre Chat ID automatiquement' },
];

export default function ConnectionsPage() {
  const t = useTranslations('connections');
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [waitingId, setWaitingId] = useState(false);
  const [form, setForm] = useState({ name: '', botName: 'Assistant', telegramBotToken: '' });

  useEffect(() => { fetchConnections(); }, []);

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/connections');
      const data = await res.json();
      setConnections(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.telegramBotToken || !form.name) return;
    setAdding(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'TELEGRAM', ...form }),
      });
      const json = await res.json();
      if (res.ok) {
        // Now wait for user to send a message to get their chat ID
        setWaitingId(true);
        toast({ title: '✅ Bot connecté ! Envoyez un message à votre bot pour finaliser.' });
        setForm({ name: '', botName: 'Assistant', telegramBotToken: '' });
        setShowAdd(false);
        fetchConnections();
        // Poll for chatId for 2 minutes
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          const r = await fetch('/api/connections');
          const conns = await r.json();
          const updated = conns.find((c: any) => c.id === json.id);
          if (updated?.telegramChatId || attempts > 24) {
            clearInterval(poll);
            setWaitingId(false);
            if (updated?.telegramChatId) {
              toast({ title: `✅ Chat ID capturé ! (${updated.telegramChatId}) Le bot est prêt.` });
            }
            fetchConnections();
          }
        }, 5000);
      } else {
        toast({ title: 'Erreur', description: json.error, variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette connexion ?')) return;
    await fetch(`/api/connections/${id}`, { method: 'DELETE' });
    fetchConnections();
    toast({ title: 'Connexion supprimée' });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white">{t('title')}</h1>
          <p className="text-white/40 text-sm mt-1">Gérez vos bots Telegram IA</p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setShowHelp(false); }}
          className="flex items-center gap-2 font-mono text-sm text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90"
          style={{ background: ORANGE }}
        >
          <Plus className="w-4 h-4" />
          Ajouter un bot
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...CARD_STYLE, padding: '24px', borderColor: `${ORANGE}30` }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
              <Bot className="w-4 h-4" style={{ color: ORANGE }} />
            </div>
            <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot Telegram</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom de la connexion</label>
              <input
                className={INPUT_CLASS}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Mon Bot Support"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom affiché aux clients</label>
              <input
                className={INPUT_CLASS}
                value={form.botName}
                onChange={e => setForm(f => ({ ...f, botName: e.target.value }))}
                placeholder="Assistant"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 font-mono mb-1.5 block">
                Bot Token{' '}
                <span className="text-white/20">(depuis @BotFather)</span>
              </label>
              <input
                className={INPUT_CLASS}
                type="password"
                value={form.telegramBotToken}
                onChange={e => setForm(f => ({ ...f, telegramBotToken: e.target.value }))}
                placeholder="1234567890:AAAA..."
              />
              <p className="text-xs text-white/25 mt-1.5 font-mono">
                Après connexion, envoyez un message à votre bot — YelhaDms capturera votre Chat ID automatiquement.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={handleAdd}
              disabled={adding || !form.telegramBotToken || !form.name}
              className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: ORANGE }}
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Connecter le bot
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Waiting for chat ID banner */}
      {waitingId && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: `${SKY}10`, border: `1px solid ${SKY}30` }}
        >
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: SKY }} />
          <div>
            <p className="text-sm font-mono font-semibold" style={{ color: SKY }}>
              En attente de votre premier message...
            </p>
            <p className="text-xs text-white/30 font-mono mt-0.5">
              Ouvrez Telegram, trouvez votre bot et envoyez-lui un message pour finaliser la configuration.
            </p>
          </div>
        </div>
      )}

      {/* Active connections */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4" style={{ color: SKY }} />
          <span className="font-mono text-xs text-white/40 uppercase tracking-wider">Telegram — Actif</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white" style={{ background: SKY }}>
            Disponible
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-white/20" />
          </div>
        ) : connections.length === 0 ? (
          <div style={CARD_STYLE} className="py-14 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${SKY}18` }}>
              <Send className="w-7 h-7" style={{ color: SKY }} />
            </div>
            <p className="text-white/50 font-mono font-medium">Aucun bot Telegram connecté</p>
            <p className="text-white/25 text-sm mt-1 font-mono">
              Cliquez sur &quot;Ajouter un bot&quot; pour commencer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((conn: any) => (
              <div key={conn.id} style={CARD_STYLE} className="p-5 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${SKY}18` }}>
                      <Send className="w-5 h-5" style={{ color: SKY }} />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-white text-sm">{conn.name}</p>
                      <p className="text-white/30 text-xs font-mono">{conn.botName || 'Assistant'}</p>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{
                      background: conn.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)',
                      color: conn.isActive ? '#34d399' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {conn.isActive ? t('active') : t('inactive')}
                  </span>
                </div>

                {/* Chat ID status */}
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {conn.telegramChatId ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-xs font-mono text-white/50">
                        Chat ID: <span className="text-white/80">{conn.telegramChatId}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Hash className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                      <span className="text-xs font-mono text-yellow-400/70">
                        En attente d&apos;un message...
                      </span>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link href={`/${locale}/dashboard/connections/${conn.id}`} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1.5 font-mono text-xs text-white/70 hover:text-white border border-white/[0.07] hover:border-white/[0.15] rounded-xl py-2 transition-all">
                      <Settings className="w-3.5 h-3.5" />
                      {t('configure')}
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="px-3 py-2 rounded-xl border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coming soon */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-white/20" />
          <span className="font-mono text-xs text-white/30 uppercase tracking-wider">Bientôt disponibles</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SOON_PLATFORMS.map(p => {
            const Icon = p.icon;
            return (
              <div key={p.value} style={{ ...CARD_STYLE, opacity: 0.5 }} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${p.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: p.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-white/60 truncate">{p.label}</p>
                  <p className="text-xs text-white/25 font-mono">Bientôt disponible</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help section */}
      <div style={CARD_STYLE} className="overflow-hidden">
        <button
          onClick={() => setShowHelp(v => !v)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4" style={{ color: ORANGE }} />
            <span className="font-mono font-semibold text-white text-sm">
              Comment créer et connecter un bot Telegram ?
            </span>
          </div>
          {showHelp ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </button>

        {showHelp && (
          <div className="px-5 pb-5 border-t border-white/[0.05]">
            <div className="pt-5 space-y-4">
              {STEPS_FR.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
                    style={{ background: `${ORANGE}20`, color: ORANGE }}
                  >
                    {i + 1}
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-mono text-white/70 leading-relaxed">
                      <span className="mr-2">{step.icon}</span>
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}

              {/* YouTube placeholder */}
              <div
                className="mt-5 rounded-xl p-4 flex items-center gap-3 border"
                style={{ background: 'rgba(255,0,0,0.05)', borderColor: 'rgba(255,0,0,0.15)' }}
              >
                <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                  <ExternalLink className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-mono text-white/70">Tutoriel vidéo</p>
                  <p className="text-xs text-white/30 font-mono">
                    Lien vidéo à venir — contactez le support pour l&apos;activer
                  </p>
                </div>
              </div>

              <div
                className="rounded-xl p-4 mt-2"
                style={{ background: `${ORANGE}08`, border: `1px solid ${ORANGE}20` }}
              >
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                  <div>
                    <p className="text-sm font-mono font-semibold" style={{ color: ORANGE }}>
                      Capture automatique du Chat ID
                    </p>
                    <p className="text-xs text-white/40 font-mono mt-1 leading-relaxed">
                      Une fois le token entré et le bot connecté, envoyez n&apos;importe quel message à votre bot depuis Telegram.
                      YelhaDms détectera automatiquement votre Chat ID et votre nom — aucune action supplémentaire requise.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
