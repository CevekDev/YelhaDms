'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Send, Trash2, Loader2, Clock,
  MessageCircle, Instagram, Facebook, HelpCircle,
  CheckCircle, ChevronDown, ChevronUp, Copy, Check,
  Bot, Hash, ExternalLink, AlertTriangle, X, ArrowRight,
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

function ConnectionsPageInner() {
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
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Telegram form
  const [tgForm, setTgForm] = useState({ name: '', botName: 'Assistant', telegramBotToken: '' });

  // Instagram form (just name/botName — token via OAuth)
  const [igForm, setIgForm] = useState({ name: '', botName: 'Assistant', businessName: '' });

  // Instagram OAuth result (from URL params after callback)
  const [igOAuthResult, setIgOAuthResult] = useState<{
    verifyToken: string;
    username: string;
  } | null>(null);
  const [igNoAccountError, setIgNoAccountError] = useState(false);

  useEffect(() => { fetchConnections(); }, []);

  // Handle OAuth callback result from URL params (read directly from window to avoid useSearchParams/Suspense issue)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const igSuccess = sp.get('ig_success');
    const igError = sp.get('ig_error');
    const igVerifyToken = sp.get('ig_verify_token');
    const igUsername = sp.get('ig_username');

    if (igSuccess === '1' && igVerifyToken) {
      setIgOAuthResult({ verifyToken: igVerifyToken, username: igUsername ?? '' });
      setPlatformTab('INSTAGRAM');
      fetchConnections();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (igError) {
      if (igError === 'no_instagram_account') {
        setIgNoAccountError(true);
        setPlatformTab('INSTAGRAM');
        setShowAdd(true);
      } else {
        const errorMessages: Record<string, string> = {
          denied: 'Connexion Instagram annulée.',
          token_exchange: 'Échec de récupération du token Instagram.',
          limit_reached: 'Limite de bots Instagram atteinte pour votre plan.',
          server_error: 'Erreur serveur lors de la connexion Instagram.',
          missing_params: 'Paramètres manquants dans le callback Instagram.',
        };
        toast({ title: 'Erreur Instagram', description: errorMessages[igError] ?? igError, variant: 'destructive' });
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleConnectInstagram = () => {
    if (!igForm.name) return;
    // Redirect to OAuth flow — Instagram login page opens
    const params = new URLSearchParams({
      name: igForm.name,
      botName: igForm.botName,
      businessName: igForm.businessName,
    });
    window.location.href = `/api/instagram/auth?${params.toString()}`;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
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
                  onClick={() => { setPlatformTab(p.key); }}
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
          {platformTab === 'INSTAGRAM' && (
            <>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${IG_COLOR}20` }}>
                  <Instagram className="w-4 h-4" style={{ color: IG_COLOR }} />
                </div>
                <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot Instagram DM</h2>
              </div>

              <div className="space-y-3 mb-5">
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
              </div>

              {/* OAuth connect button */}
              <button
                onClick={handleConnectInstagram}
                disabled={!igForm.name}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-mono font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  boxShadow: '0 4px 24px rgba(220,39,67,0.3)',
                }}
              >
                <Instagram className="w-5 h-5" />
                Se connecter avec Instagram
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </button>
              <p className="text-center text-[11px] font-mono text-white/25 mt-2">
                Vous serez redirigé vers la page officielle Instagram
              </p>

              <div className="flex justify-center mt-3">
                <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 transition-colors">Annuler</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── No Instagram Business Account error banner ── */}
      {igNoAccountError && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(225,48,108,0.3)', background: 'rgba(225,48,108,0.06)' }}>
          <div className="flex items-start gap-4 p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(225,48,108,0.15)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: IG_COLOR }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-mono font-semibold text-white text-sm">Compte Instagram Pro requis</p>
                <button onClick={() => setIgNoAccountError(false)} className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-mono text-white/50 mb-4 leading-relaxed">
                Aucun compte Instagram <span className="text-white/80">Pro</span> ou <span className="text-white/80">Business</span> n&apos;est lié à vos pages Facebook. Le compte personnel Instagram ne supporte pas l&apos;API de messagerie.
              </p>
              <p className="text-[11px] font-mono text-white/40 mb-3 uppercase tracking-wider">Comment passer en compte Pro :</p>
              <div className="space-y-2.5">
                {[
                  { n: '1', text: 'Ouvrez Instagram → Profil → ☰ Menu → Paramètres' },
                  { n: '2', text: 'Compte → Passer à un compte professionnel' },
                  { n: '3', text: 'Choisissez "Créateur" ou "Entreprise"' },
                  { n: '4', text: 'Liez votre page Facebook à ce compte Instagram' },
                  { n: '5', text: 'Revenez ici et reconnectez votre compte' },
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: 'rgba(225,48,108,0.2)', color: IG_COLOR }}>
                      {step.n}
                    </div>
                    <p className="text-xs font-mono text-white/60 pt-0.5 leading-relaxed">{step.text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setIgNoAccountError(false); }}
                className="mt-4 flex items-center gap-2 font-mono text-xs px-4 py-2 rounded-xl transition-all hover:opacity-90"
                style={{ background: 'rgba(225,48,108,0.15)', color: IG_COLOR, border: '1px solid rgba(225,48,108,0.25)' }}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Réessayer la connexion
              </button>
            </div>
          </div>
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

      {/* ── Instagram OAuth result banner ── */}
      {igOAuthResult && (
        <div className="rounded-2xl p-5" style={{ background: `${IG_COLOR}08`, border: `1px solid ${IG_COLOR}30` }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="font-mono font-semibold text-white text-sm">
              @{igOAuthResult.username} connecté avec succès !
            </span>
          </div>
          <p className="text-xs font-mono text-white/40 mb-3">
            Dernière étape — configurez le webhook dans votre app Meta pour recevoir les DMs :
          </p>
          <div className="space-y-2 mb-3">
            <div>
              <p className="text-[10px] font-mono text-white/30 mb-1">Webhook URL</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-xs font-mono text-white/70 truncate">
                  {`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dms.yelha.net'}/api/webhooks/instagram`}
                </code>
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/instagram`, 'wh_url')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/[0.08] font-mono text-xs transition-all hover:border-white/20"
                  style={copiedField === 'wh_url' ? { color: '#10b981' } : { color: 'rgba(255,255,255,0.4)' }}
                >
                  {copiedField === 'wh_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono text-white/30 mb-1">Verify Token</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-xs font-mono text-white/70 truncate">
                  {igOAuthResult.verifyToken}
                </code>
                <button
                  onClick={() => copyToClipboard(igOAuthResult.verifyToken, 'wh_token')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/[0.08] font-mono text-xs transition-all hover:border-white/20"
                  style={copiedField === 'wh_token' ? { color: '#10b981' } : { color: 'rgba(255,255,255,0.4)' }}
                >
                  {copiedField === 'wh_token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <button onClick={() => setIgOAuthResult(null)} className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors">
            Fermer
          </button>
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
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
            Disponible
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
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-white/50">
                    @{conn.instagramUsername || 'instagram'} — Webhook actif
                  </span>
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

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/10 border-t-[#FF6B2C] rounded-full animate-spin" /></div>}>
      <ConnectionsPageInner />
    </Suspense>
  );
}
