'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Send, Trash2, Loader2, Clock,
  MessageCircle, Instagram, Facebook, HelpCircle,
  CheckCircle, ExternalLink, ChevronDown, ChevronUp,
  Bot, Hash, Copy, Check, FlaskConical,
} from 'lucide-react';

const ORANGE = '#FF6B2C';
const SKY = '#0ea5e9';
const IG_COLOR = '#e1306c';

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
};

const INPUT_CLASS = `w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5
  text-sm font-mono text-white placeholder:text-white/20
  focus:outline-none focus:border-[#FF6B2C]/40 transition-colors`;

type PlatformTab = 'TELEGRAM' | 'INSTAGRAM';

export default function ConnectionsPage() {
  const t = useTranslations('connections');
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [platformTab, setPlatformTab] = useState<PlatformTab>('TELEGRAM');
  const [showHelp, setShowHelp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [waitingId, setWaitingId] = useState(false);

  // Telegram form
  const [tgForm, setTgForm] = useState({ name: '', botName: 'Assistant', telegramBotToken: '' });

  // Instagram form + result
  const [igForm, setIgForm] = useState({ name: '', botName: 'Assistant', businessName: '', instagramUserId: '', instagramAccessToken: '' });
  const [igResult, setIgResult] = useState<{ webhookUrl: string; verifyToken: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
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

  const handleAddInstagram = async () => {
    if (!igForm.instagramAccessToken || !igForm.name || !igForm.instagramUserId) return;
    setAdding(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'INSTAGRAM', ...igForm }),
      });
      const json = await res.json();
      if (res.ok) {
        setIgResult({ webhookUrl: json.webhookUrl, verifyToken: json.verifyToken });
        toast({ title: '✅ Bot Instagram créé ! Configurez le webhook dans Meta.' });
        setIgForm({ name: '', botName: 'Assistant', businessName: '', instagramUserId: '', instagramAccessToken: '' });
        fetchConnections();
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

  const telegramConns = connections.filter(c => c.platform === 'TELEGRAM');
  const instagramConns = connections.filter(c => c.platform === 'INSTAGRAM');

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white">{t('title')}</h1>
          <p className="text-white/40 text-sm mt-1 font-mono">Gérez vos bots IA — Telegram & Instagram</p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setShowHelp(false); setIgResult(null); }}
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
          {/* Platform tab switcher */}
          <div className="flex gap-2 mb-6 p-1 bg-white/[0.03] rounded-xl w-fit">
            {([
              { key: 'TELEGRAM', label: 'Telegram', icon: Send, color: SKY },
              { key: 'INSTAGRAM', label: 'Instagram', icon: Instagram, color: IG_COLOR },
            ] as const).map(p => {
              const Icon = p.icon;
              const active = platformTab === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => { setPlatformTab(p.key); setIgResult(null); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all"
                  style={active ? { background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}30` } : { color: 'rgba(255,255,255,0.3)' }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* ── Telegram form ── */}
          {platformTab === 'TELEGRAM' && (
            <>
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
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">
                    Bot Token <span className="text-white/20">(depuis @BotFather)</span>
                  </label>
                  <input className={INPUT_CLASS} type="password" value={tgForm.telegramBotToken} onChange={e => setTgForm(f => ({ ...f, telegramBotToken: e.target.value }))} placeholder="1234567890:AAAA..." />
                  <p className="text-xs text-white/25 mt-1.5 font-mono">Après connexion, envoyez un message à votre bot — YelhaDms capturera votre Chat ID automatiquement.</p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleAddTelegram} disabled={adding || !tgForm.telegramBotToken || !tgForm.name} className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40" style={{ background: ORANGE }}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Connecter le bot
                </button>
                <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all">Annuler</button>
              </div>
            </>
          )}

          {/* ── Instagram form ── */}
          {platformTab === 'INSTAGRAM' && !igResult && (
            <>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${IG_COLOR}20` }}>
                  <Instagram className="w-4 h-4" style={{ color: IG_COLOR }} />
                </div>
                <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot Instagram DM</h2>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)' }}>
                  <FlaskConical className="w-3 h-3" />
                  Mode Test
                </span>
              </div>

              {/* Test mode notice */}
              <div className="rounded-xl p-3 mb-4 text-xs font-mono text-yellow-400/70" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                {t('instagramHelp.testMode')}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom de la connexion</label>
                  <input className={INPUT_CLASS} value={igForm.name} onChange={e => setIgForm(f => ({ ...f, name: e.target.value }))} placeholder="Mon Instagram Shop" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom du bot</label>
                    <input className={INPUT_CLASS} value={igForm.botName} onChange={e => setIgForm(f => ({ ...f, botName: e.target.value }))} placeholder="Assistant" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom boutique <span className="text-white/20">(optionnel)</span></label>
                    <input className={INPUT_CLASS} value={igForm.businessName} onChange={e => setIgForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Ma Boutique" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">{t('instagramUserId')}</label>
                  <input className={INPUT_CLASS} value={igForm.instagramUserId} onChange={e => setIgForm(f => ({ ...f, instagramUserId: e.target.value }))} placeholder={t('instagramUserIdPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">{t('accessToken')}</label>
                  <input className={INPUT_CLASS} type="password" value={igForm.instagramAccessToken} onChange={e => setIgForm(f => ({ ...f, instagramAccessToken: e.target.value }))} placeholder={t('accessTokenPlaceholder')} />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={handleAddInstagram} disabled={adding || !igForm.instagramAccessToken || !igForm.name || !igForm.instagramUserId} className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40" style={{ background: IG_COLOR }}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                  Connecter Instagram
                </button>
                <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all">Annuler</button>
              </div>

              {/* Instagram help */}
              <div className="mt-4 border-t border-white/[0.05] pt-4">
                <button onClick={() => setShowHelp(v => !v)} className="flex items-center gap-2 text-xs font-mono text-white/30 hover:text-white/60 transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" />
                  {t('instagramHelp.title')}
                  {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showHelp && (
                  <div className="mt-3 space-y-2">
                    {[t('instagramHelp.step1'), t('instagramHelp.step2'), t('instagramHelp.step3'), t('instagramHelp.step4'), t('instagramHelp.step5')].map((step, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${IG_COLOR}20`, color: IG_COLOR }}>{i + 1}</span>
                        <p className="text-xs font-mono text-white/50 leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Instagram webhook info after creation ── */}
          {platformTab === 'INSTAGRAM' && igResult && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h2 className="font-mono font-semibold text-white text-sm">Bot Instagram créé avec succès !</h2>
              </div>
              <p className="text-xs font-mono text-white/40 mb-4">{t('webhookInfo')}</p>
              <div className="space-y-3">
                {[
                  { label: t('webhookUrl'), value: igResult.webhookUrl, field: 'url' },
                  { label: t('verifyToken'), value: igResult.verifyToken, field: 'token' },
                ].map(item => (
                  <div key={item.field}>
                    <label className="text-xs text-white/40 font-mono mb-1.5 block">{item.label}</label>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-xs font-mono text-white/80 truncate">{item.value}</code>
                      <button
                        onClick={() => copyToClipboard(item.value, item.field)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] font-mono text-xs transition-all hover:border-white/20"
                        style={copiedField === item.field ? { color: '#10b981', borderColor: '#10b98130' } : { color: 'rgba(255,255,255,0.4)' }}
                      >
                        {copiedField === item.field ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedField === item.field ? t('copied') : 'Copier'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl p-3 text-xs font-mono" style={{ background: `${IG_COLOR}08`, border: `1px solid ${IG_COLOR}20` }}>
                <p className="text-white/50 leading-relaxed">
                  Dans Meta → votre app → Instagram → Webhooks :<br />
                  1. Collez l'URL webhook et le Verify Token<br />
                  2. Abonnez-vous au champ <code className="text-white/70">messages</code><br />
                  3. Cliquez &quot;Vérifier et enregistrer&quot;
                </p>
              </div>
              <button onClick={() => { setIgResult(null); setShowAdd(false); }} className="mt-4 font-mono text-sm text-white/50 hover:text-white/80 transition-colors">
                Fermer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Waiting for Telegram chat ID */}
      {waitingId && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${SKY}10`, border: `1px solid ${SKY}30` }}>
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: SKY }} />
          <div>
            <p className="text-sm font-mono font-semibold" style={{ color: SKY }}>En attente de votre premier message...</p>
            <p className="text-xs text-white/30 font-mono mt-0.5">Ouvrez Telegram, trouvez votre bot et envoyez-lui un message pour finaliser la configuration.</p>
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
                <div className="flex justify-end">
                  <button onClick={() => handleDelete(conn.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-white/25 hover:text-red-400 font-mono text-xs transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Instagram connections ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Instagram className="w-4 h-4" style={{ color: IG_COLOR }} />
          <span className="font-mono text-xs text-white/40 uppercase tracking-wider">Instagram DM</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
            <FlaskConical className="w-2.5 h-2.5" /> Mode Test
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
        ) : instagramConns.length === 0 ? (
          <div style={CARD_STYLE} className="py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${IG_COLOR}18` }}>
              <Instagram className="w-6 h-6" style={{ color: IG_COLOR }} />
            </div>
            <p className="text-white/40 font-mono text-sm">Aucun bot Instagram connecté</p>
            <p className="text-white/20 font-mono text-xs mt-1">Cliquez sur &quot;Ajouter un bot&quot; → Instagram</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instagramConns.map((conn: any) => (
              <div key={conn.id} style={CARD_STYLE} className="p-5 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${IG_COLOR}18` }}>
                      <Instagram className="w-5 h-5" style={{ color: IG_COLOR }} />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-white text-sm">{conn.name}</p>
                      <p className="text-white/30 text-xs font-mono">@{conn.instagramUsername || conn.instagramUserId}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: conn.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)', color: conn.isActive ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                    {conn.isActive ? t('active') : t('inactive')}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-lg mb-3 text-xs font-mono text-white/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  Webhook: <code className="text-white/60">/api/webhooks/instagram</code>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => handleDelete(conn.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-white/25 hover:text-red-400 font-mono text-xs transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { value: 'WHATSAPP', label: 'WhatsApp Business', icon: MessageCircle, color: '#25d366' },
            { value: 'FACEBOOK', label: 'Facebook Messenger', icon: Facebook, color: '#1877f2' },
          ].map(p => {
            const Icon = p.icon;
            return (
              <div key={p.value} style={{ ...CARD_STYLE, opacity: 0.45 }} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${p.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: p.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-white/60 truncate">{p.label}</p>
                  <p className="text-xs text-white/25 font-mono">Bientôt disponible</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white/50 border border-white/10">BIENTÔT</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Telegram help */}
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
                  <div>
                    <p className="text-sm font-mono font-semibold" style={{ color: ORANGE }}>Capture automatique du Chat ID</p>
                    <p className="text-xs text-white/40 font-mono mt-1 leading-relaxed">Une fois le token entré et le bot connecté, envoyez n&apos;importe quel message à votre bot depuis Telegram. YelhaDms détectera automatiquement votre Chat ID et votre nom.</p>
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
