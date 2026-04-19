'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Send, Trash2, Loader2, Clock,
  Instagram, HelpCircle, CheckCircle,
  ChevronDown, ChevronUp, Copy, Check,
  Bot, Hash, X, ExternalLink,
} from 'lucide-react';

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

type PlatformTab = 'TELEGRAM' | 'INSTAGRAM';

function CopyBtn({ text, field, copiedField, onCopy }: { text: string; field: string; copiedField: string | null; onCopy: (t: string, f: string) => void }) {
  return (
    <button
      onClick={() => onCopy(text, field)}
      className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/[0.08] font-mono text-xs transition-all hover:border-white/20 flex-shrink-0"
      style={copiedField === field ? { color: '#10b981' } : { color: 'rgba(255,255,255,0.4)' }}
    >
      {copiedField === field ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function WebhookBanner({ color, title, webhookUrl, verifyToken, copiedField, onCopy, onClose }: {
  color: string; title: string; webhookUrl: string; verifyToken: string;
  copiedField: string | null; onCopy: (t: string, f: string) => void; onClose: () => void;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: `${color}08`, border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="font-mono font-semibold text-white text-sm">{title}</span>
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs font-mono text-white/40 mb-3">Configurez le webhook dans votre App Meta :</p>
      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-mono text-white/30 mb-1">Webhook URL</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-xs font-mono text-white/70 truncate">{webhookUrl}</code>
            <CopyBtn text={webhookUrl} field="wh_url" copiedField={copiedField} onCopy={onCopy} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-mono text-white/30 mb-1">Verify Token</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-xs font-mono text-white/70 truncate">{verifyToken}</code>
            <CopyBtn text={verifyToken} field="wh_token" copiedField={copiedField} onCopy={onCopy} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionsPageInner() {
  const t = useTranslations('connections');
  const params = useParams();
  const { toast } = useToast();

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [platformTab, setPlatformTab] = useState<PlatformTab>('TELEGRAM');
  const [showHelp, setShowHelp] = useState(false);
  const [showIgHelp, setShowIgHelp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [waitingId, setWaitingId] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [tgForm, setTgForm] = useState({ name: '', botName: 'Assistant', telegramBotToken: '' });
  const [igForm, setIgForm] = useState({ name: '', botName: 'Assistant', instagramBusinessAccountId: '', instagramAccessToken: '', instagramVerifyToken: '' });
  const [igResult, setIgResult] = useState<{ webhookUrl: string; verifyToken: string; username?: string } | null>(null);

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

  const handleAddInstagram = async () => {
    if (!igForm.name || !igForm.instagramBusinessAccountId || !igForm.instagramAccessToken || !igForm.instagramVerifyToken) return;
    setAdding(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'INSTAGRAM', ...igForm }),
      });
      const json = await res.json();
      if (res.ok) {
        setIgResult({
          webhookUrl: `${window.location.origin}/api/webhooks/instagram/${json.id}`,
          verifyToken: igForm.instagramVerifyToken,
          username: json.username,
        });
        setIgForm({ name: '', botName: 'Assistant', instagramBusinessAccountId: '', instagramAccessToken: '', instagramVerifyToken: '' });
        setShowAdd(false);
        fetchConnections();
      } else {
        toast({ title: 'Erreur Instagram', description: json.error, variant: 'destructive' });
      }
    } finally { setAdding(false); }
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

  const TABS: { id: PlatformTab; label: string; color: string }[] = [
    { id: 'TELEGRAM', label: 'Telegram', color: SKY },
    { id: 'INSTAGRAM', label: 'Instagram', color: IG_COLOR },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white">{t('title')}</h1>
          <p className="text-white/40 text-sm mt-1 font-mono">Gérez vos bots IA — Telegram &amp; Instagram</p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setShowHelp(false); setShowIgHelp(false); }}
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
          {/* Platform tabs */}
          <div className="flex gap-2 mb-6">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setPlatformTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs transition-all"
                style={platformTab === tab.id
                  ? { background: `${tab.color}20`, color: tab.color, border: `1px solid ${tab.color}40` }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {tab.label}
              </button>
            ))}
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

              {/* Tutorial */}
              <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setShowIgHelp(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                    <span className="font-mono text-xs text-white/60">Comment obtenir les identifiants Instagram ?</span>
                  </div>
                  {showIgHelp ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                </button>
                {showIgHelp && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="pt-4 space-y-2.5">
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1">Prérequis</p>
                      {[
                        { n: '→', text: 'Compte Instagram Professionnel ou Entreprise' },
                        { n: '→', text: 'Compte lié à une Page Facebook' },
                      ].map(s => (
                        <div key={s.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{s.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5">{s.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 1 — Créer l&apos;app Meta</p>
                      {[
                        { n: '1', text: 'developers.facebook.com → Mes applications → Créer une application → Entreprise' },
                        { n: '2', text: 'Tableau de bord → Ajouter un produit → Instagram → Configurer' },
                        { n: '3', text: 'Instagram → Paramètres API → liez votre Page Facebook → copiez le "Instagram Business Account ID"' },
                      ].map(s => (
                        <div key={s.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{s.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{s.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 2 — Token permanent</p>
                      {[
                        { n: '4', text: 'business.facebook.com → Paramètres → Utilisateurs → Utilisateurs système → Ajouter (Admin)' },
                        { n: '5', text: '"Générer un nouveau token" → votre app → permissions : instagram_basic + instagram_manage_messages + pages_messaging' },
                        { n: '6', text: 'Copiez le token — il ne s\'affiche qu\'une seule fois' },
                      ].map(s => (
                        <div key={s.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{s.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{s.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 3 — Webhook (après connexion ici)</p>
                      {[
                        { n: '7', text: 'Instagram → Webhooks → collez le Webhook URL + Verify Token affichés après connexion' },
                        { n: '8', text: 'Abonnez-vous à l\'événement "messages"' },
                      ].map(s => (
                        <div key={s.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{s.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{s.text}</p>
                        </div>
                      ))}
                      <a href="https://developers.facebook.com/docs/instagram-platform" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-mono mt-2 hover:opacity-80 transition-colors" style={{ color: IG_COLOR }}>
                        <ExternalLink className="w-3 h-3" /> Documentation officielle Meta Instagram
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom de la connexion</label>
                  <input className={INPUT_CLASS} value={igForm.name} onChange={e => setIgForm(f => ({ ...f, name: e.target.value }))} placeholder="Ma boutique Instagram" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom affiché aux clients</label>
                  <input className={INPUT_CLASS} value={igForm.botName} onChange={e => setIgForm(f => ({ ...f, botName: e.target.value }))} placeholder="Assistant" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Instagram Business Account ID <span className="text-white/20">(Instagram → Paramètres API)</span></label>
                  <input className={INPUT_CLASS} value={igForm.instagramBusinessAccountId} onChange={e => setIgForm(f => ({ ...f, instagramBusinessAccountId: e.target.value }))} placeholder="123456789012345" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Access Token permanent <span className="text-white/20">(Business Manager → Utilisateurs système)</span></label>
                  <input className={INPUT_CLASS} type="password" value={igForm.instagramAccessToken} onChange={e => setIgForm(f => ({ ...f, instagramAccessToken: e.target.value }))} placeholder="EAAxxxxx..." />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Verify Token <span className="text-white/20">(inventez un mot de passe)</span></label>
                  <input className={INPUT_CLASS} value={igForm.instagramVerifyToken} onChange={e => setIgForm(f => ({ ...f, instagramVerifyToken: e.target.value }))} placeholder="mon_token_secret_123" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleAddInstagram} disabled={adding || !igForm.name || !igForm.instagramBusinessAccountId || !igForm.instagramAccessToken || !igForm.instagramVerifyToken} className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40" style={{ background: ORANGE }}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                  Connecter Instagram
                </button>
                <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all">Annuler</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Instagram webhook banner ── */}
      {igResult && (
        <WebhookBanner
          color={IG_COLOR}
          title={`Instagram${igResult.username ? ` @${igResult.username}` : ''} connecté !`}
          webhookUrl={igResult.webhookUrl}
          verifyToken={igResult.verifyToken}
          copiedField={copiedField}
          onCopy={copyToClipboard}
          onClose={() => setIgResult(null)}
        />
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
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Disponible</span>
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
                      <p className="text-white/30 text-xs font-mono">{conn.instagramUsername ? `@${conn.instagramUsername}` : conn.instagramBusinessAccountId || 'Instagram'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: conn.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)', color: conn.isActive ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                    {conn.isActive ? t('active') : t('inactive')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-white/50">Webhook actif</span>
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

      {/* ── Coming soon ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-white/20" />
          <span className="font-mono text-xs text-white/30 uppercase tracking-wider">Bientôt disponibles</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'WhatsApp Business', color: WA_COLOR },
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
