'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Send, Trash2, Loader2, Clock,
  HelpCircle,
  ChevronDown, ChevronUp,
  Bot, Hash, CheckCircle, Settings,
} from 'lucide-react';
import Link from 'next/link';

const ORANGE = '#FF6B2C';
const SKY = '#0ea5e9';
const IG_COLOR = '#e1306c';
const WA_COLOR = '#25d366';
const FB_COLOR = '#1877f2';

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
};

const INPUT_CLASS = `w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5
  text-sm font-mono text-white placeholder:text-white/20
  focus:outline-none focus:border-[#FF6B2C]/40 transition-colors`;


function ConnectionsPageInner() {
  const t = useTranslations('connections');
  const params = useParams();
  const { toast } = useToast();

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [waitingId, setWaitingId] = useState(false);

  const [tgForm, setTgForm] = useState({ name: '', botName: 'Assistant', telegramBotToken: '' });

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

  const handleAddTelegram = async () => {
    if (!tgForm.telegramBotToken || !tgForm.name) return;
    setAdding(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'TELEGRAM', ...tgForm }),
      });
      const json = await res.json();
      if (res.ok) {
        setWaitingId(true);
        toast({ title: '✅ Bot connecté ! Envoyez un message à votre bot pour finaliser.' });
        setTgForm({ name: '', botName: 'Assistant', telegramBotToken: '' });
        setShowAdd(false);
        fetchConnections();
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          const r = await fetch('/api/connections');
          const conns = await r.json();
          const updated = conns.find((c: any) => c.id === json.id);
          if (updated?.telegramChatId || attempts > 24) {
            clearInterval(poll);
            setWaitingId(false);
            if (updated?.telegramChatId) toast({ title: `✅ Chat ID capturé ! Le bot est prêt.` });
            fetchConnections();
          }
        }, 5000);
      } else {
        toast({ title: 'Erreur', description: json.error, variant: 'destructive' });
      }
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette connexion ?')) return;
    await fetch(`/api/connections/${id}`, { method: 'DELETE' });
    fetchConnections();
    toast({ title: 'Connexion supprimée' });
  };

  const telegramConns = connections.filter(c => c.platform === 'TELEGRAM');

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white">{t('title')}</h1>
          <p className="text-white/40 text-sm mt-1 font-mono">Gérez vos bots IA — Telegram</p>
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

      {/* ── Add form ── */}
      {showAdd && (
        <div style={{ ...CARD_STYLE, padding: '24px', borderColor: `${ORANGE}30` }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${SKY}20` }}>
              <Send className="w-4 h-4" style={{ color: SKY }} />
            </div>
            <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot Telegram</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom de la connexion</label>
              <input className={INPUT_CLASS} value={tgForm.name} onChange={e => setTgForm(f => ({ ...f, name: e.target.value }))} placeholder="Mon Bot Support" />
            </div>
            <div>
              <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom affiché aux clients</label>
              <input className={INPUT_CLASS} value={tgForm.botName} onChange={e => setTgForm(f => ({ ...f, botName: e.target.value }))} placeholder="Assistant" />
            </div>
            <div>
              <label className="text-xs text-white/40 font-mono mb-1.5 block">Bot Token <span className="text-white/20">(depuis @BotFather)</span></label>
              <input className={INPUT_CLASS} type="password" value={tgForm.telegramBotToken} onChange={e => setTgForm(f => ({ ...f, telegramBotToken: e.target.value }))} placeholder="1234567890:AAAA..." />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleAddTelegram} disabled={adding || !tgForm.telegramBotToken || !tgForm.name} className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40" style={{ background: ORANGE }}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Connecter le bot
            </button>
            <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all">Annuler</button>
          </div>
        </div>
      )}

      {/* Waiting for Telegram chat ID */}
      {waitingId && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${SKY}10`, border: `1px solid ${SKY}30` }}>
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: SKY }} />
          <div>
            <p className="text-sm font-mono font-semibold" style={{ color: SKY }}>En attente de votre premier message...</p>
            <p className="text-xs text-white/30 font-mono mt-0.5">Ouvrez Telegram, trouvez votre bot et envoyez-lui un message pour finaliser.</p>
          </div>
        </div>
      )}

      {/* ── Telegram connections ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4" style={{ color: SKY }} />
          <span className="font-mono text-xs text-white/40 uppercase tracking-wider">Telegram</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white" style={{ background: SKY }}>Disponible</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-white/20" /></div>
        ) : telegramConns.length === 0 ? (
          <div style={CARD_STYLE} className="py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${SKY}18` }}>
              <Send className="w-6 h-6" style={{ color: SKY }} />
            </div>
            <p className="text-white/40 font-mono text-sm">Aucun bot Telegram connecté</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {telegramConns.map((conn: any) => (
              <div key={conn.id} style={CARD_STYLE} className="p-5 hover:bg-white/[0.03] transition-colors">
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
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: conn.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)', color: conn.isActive ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                    {conn.isActive ? t('active') : t('inactive')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {conn.telegramChatId ? (
                    <><CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /><span className="text-xs font-mono text-white/50">Chat ID: <span className="text-white/80">{conn.telegramChatId}</span></span></>
                  ) : (
                    <><Hash className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" /><span className="text-xs font-mono text-yellow-400/70">En attente d&apos;un message...</span></>
                  )}
                </div>
                <div className="flex justify-between">
                  <Link href={`/${params.locale}/dashboard/connections/${conn.id}`}>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.04] text-white/40 hover:text-white font-mono text-xs transition-all">
                      <Settings className="w-3.5 h-3.5" /> Réglages
                    </button>
                  </Link>
                  <button onClick={() => handleDelete(conn.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-white/25 hover:text-red-400 font-mono text-xs transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Coming soon ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-white/20" />
          <span className="font-mono text-xs text-white/30 uppercase tracking-wider">Bientôt disponibles</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'WhatsApp', color: WA_COLOR },
            { label: 'Instagram DM', color: IG_COLOR },
            { label: 'Facebook Messenger', color: FB_COLOR },
          ].map(p => (
            <div key={p.label} style={{ ...CARD_STYLE, opacity: 0.4 }} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white/60">{p.label}</p>
                <p className="text-xs text-white/25 font-mono">Bientôt disponible</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white/40 border border-white/10">BIENTÔT</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Telegram help ── */}
      <div style={CARD_STYLE} className="overflow-hidden">
        <button onClick={() => setShowHelp(v => !v)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4" style={{ color: ORANGE }} />
            <span className="font-mono font-semibold text-white text-sm">Comment créer et connecter un bot Telegram ?</span>
          </div>
          {showHelp ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </button>
        {showHelp && (
          <div className="px-5 pb-5 border-t border-white/[0.05]">
            <div className="pt-5 space-y-3">
              {[
                { icon: '🔍', text: 'Ouvrez Telegram et recherchez @BotFather' },
                { icon: '⌨️', text: 'Envoyez /newbot et suivez les instructions' },
                { icon: '📋', text: 'Copiez le token fourni par BotFather' },
                { icon: '💬', text: 'Collez le token ci-dessus, puis envoyez un message à votre bot — YelhaDms capturera votre Chat ID automatiquement' },
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0" style={{ background: `${ORANGE}20`, color: ORANGE }}>{i + 1}</div>
                  <p className="pt-1.5 text-sm font-mono text-white/60 leading-relaxed"><span className="mr-2">{step.icon}</span>{step.text}</p>
                </div>
              ))}
              <div className="rounded-xl p-4 mt-2" style={{ background: `${ORANGE}08`, border: `1px solid ${ORANGE}20` }}>
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                  <p className="text-xs text-white/40 font-mono leading-relaxed">Une fois le token entré, envoyez n&apos;importe quel message à votre bot depuis Telegram. YelhaDms détectera automatiquement votre Chat ID.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/10 border-t-[#FF6B2C] rounded-full animate-spin" /></div>}>
      <ConnectionsPageInner />
    </Suspense>
  );
}
