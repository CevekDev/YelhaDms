'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Send, Trash2, Loader2, Clock,
  MessageCircle, Instagram, Facebook, HelpCircle,
  CheckCircle, ChevronDown, ChevronUp, Copy, Check,
  Bot, Hash, AlertTriangle, X, ArrowRight, Lock, ExternalLink,
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

type PlatformTab = 'TELEGRAM' | 'INSTAGRAM' | 'WHATSAPP' | 'FACEBOOK';

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

function WebhookBanner({
  color, title, webhookUrl, verifyToken, copiedField, onCopy, onClose,
}: {
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
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs font-mono text-white/40 mb-3">
        Configurez le webhook dans votre App Meta avec ces informations :
      </p>
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
  const locale = params.locale as string;
  const { toast } = useToast();

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPartner, setIsPartner] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [platformTab, setPlatformTab] = useState<PlatformTab>('TELEGRAM');
  const [showHelp, setShowHelp] = useState(false);
  const [showMetaHelp, setShowMetaHelp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [waitingId, setWaitingId] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Telegram form
  const [tgForm, setTgForm] = useState({ name: '', botName: 'Assistant', telegramBotToken: '' });

  // Instagram form
  const [igForm, setIgForm] = useState({ name: '', botName: 'Assistant', instagramBusinessAccountId: '', instagramAccessToken: '', instagramVerifyToken: '' });
  const [igResult, setIgResult] = useState<{ id: string; webhookUrl: string; verifyToken: string; username?: string } | null>(null);

  // WhatsApp form
  const [waForm, setWaForm] = useState({ name: '', botName: 'Assistant', whatsappPhoneNumberId: '', whatsappAccessToken: '', whatsappVerifyToken: '' });
  const [waResult, setWaResult] = useState<{ id: string; webhookUrl: string; verifyToken: string } | null>(null);

  // Messenger form
  const [fbForm, setFbForm] = useState({ name: '', botName: 'Assistant', messengerPageId: '', messengerAccessToken: '', messengerVerifyToken: '' });
  const [fbResult, setFbResult] = useState<{ id: string; webhookUrl: string; verifyToken: string } | null>(null);

  // Instagram OAuth result (from URL params after callback)
  const [igOAuthResult, setIgOAuthResult] = useState<{ verifyToken: string; username: string } | null>(null);
  const [igNoAccountError, setIgNoAccountError] = useState(false);

  useEffect(() => {
    fetchConnections();
    fetch('/api/user/me').then(r => r.json()).then(d => setIsPartner(!!d?.isPartner));
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const igSuccess = sp.get('ig_success');
    const igError = sp.get('ig_error');
    const igVerifyToken = sp.get('ig_verify_token');
    const igUsername = sp.get('ig_username');

    if (igSuccess === '1' && igVerifyToken) {
      setIgOAuthResult({ verifyToken: igVerifyToken, username: igUsername ?? '' });
      fetchConnections();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (igError) {
      if (igError === 'no_instagram_account') {
        setIgNoAccountError(true);
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
        const baseUrl = window.location.origin;
        setIgResult({
          id: json.id,
          webhookUrl: `${baseUrl}/api/webhooks/instagram/${json.id}`,
          verifyToken: igForm.instagramVerifyToken,
          username: json.username,
        });
        setIgForm({ name: '', botName: 'Assistant', instagramBusinessAccountId: '', instagramAccessToken: '', instagramVerifyToken: '' });
        setShowAdd(false);
        fetchConnections();
      } else {
        toast({ title: 'Erreur Instagram', description: json.error, variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  };

  const handleAddWhatsApp = async () => {
    if (!waForm.name || !waForm.whatsappPhoneNumberId || !waForm.whatsappAccessToken || !waForm.whatsappVerifyToken) return;
    setAdding(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'WHATSAPP', ...waForm }),
      });
      const json = await res.json();
      if (res.ok) {
        const baseUrl = window.location.origin;
        setWaResult({
          id: json.id,
          webhookUrl: `${baseUrl}/api/webhooks/whatsapp/${json.id}`,
          verifyToken: waForm.whatsappVerifyToken,
        });
        setWaForm({ name: '', botName: 'Assistant', whatsappPhoneNumberId: '', whatsappAccessToken: '', whatsappVerifyToken: '' });
        setShowAdd(false);
        fetchConnections();
      } else {
        toast({ title: 'Erreur WhatsApp', description: json.error, variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  };

  const handleAddMessenger = async () => {
    if (!fbForm.name || !fbForm.messengerPageId || !fbForm.messengerAccessToken || !fbForm.messengerVerifyToken) return;
    setAdding(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'FACEBOOK', ...fbForm }),
      });
      const json = await res.json();
      if (res.ok) {
        const baseUrl = window.location.origin;
        setFbResult({
          id: json.id,
          webhookUrl: `${baseUrl}/api/webhooks/messenger/${json.id}`,
          verifyToken: fbForm.messengerVerifyToken,
        });
        setFbForm({ name: '', botName: 'Assistant', messengerPageId: '', messengerAccessToken: '', messengerVerifyToken: '' });
        setShowAdd(false);
        fetchConnections();
      } else {
        toast({ title: 'Erreur Messenger', description: json.error, variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
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
  const whatsappConns = connections.filter(c => c.platform === 'WHATSAPP');
  const messengerConns = connections.filter(c => c.platform === 'FACEBOOK');

  const TABS: { id: PlatformTab; label: string; color: string }[] = [
    { id: 'TELEGRAM', label: 'Telegram', color: SKY },
    { id: 'WHATSAPP', label: 'WhatsApp', color: WA_COLOR },
    { id: 'FACEBOOK', label: 'Messenger', color: FB_COLOR },
    { id: 'INSTAGRAM', label: 'Instagram', color: IG_COLOR },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white">{t('title')}</h1>
          <p className="text-white/40 text-sm mt-1 font-mono">Gérez vos bots IA — Telegram, WhatsApp, Messenger &amp; Instagram</p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setShowHelp(false); setShowMetaHelp(false); }}
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
          <div className="flex gap-2 flex-wrap mb-6">
            {TABS.map(tab => {
              const locked = tab.id === 'INSTAGRAM' && !isPartner;
              const active = platformTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => !locked && setPlatformTab(tab.id)}
                  disabled={locked}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs transition-all"
                  style={active
                    ? { background: `${tab.color}20`, color: tab.color, border: `1px solid ${tab.color}40` }
                    : locked
                      ? { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed' }
                      : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {locked && <Lock className="w-3 h-3" />}
                  {tab.label}
                  {locked && <span className="text-[9px] opacity-60 ml-0.5">Partenaire</span>}
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
          {platformTab === 'INSTAGRAM' && isPartner && (
            <>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${IG_COLOR}20` }}>
                  <Instagram className="w-4 h-4" style={{ color: IG_COLOR }} />
                </div>
                <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot Instagram DM</h2>
              </div>

              {/* Tutorial */}
              <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setShowMetaHelp(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                    <span className="font-mono text-xs text-white/60">Comment obtenir le Instagram Business Account ID et le token ?</span>
                  </div>
                  {showMetaHelp ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                </button>
                {showMetaHelp && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="pt-4 space-y-2.5">
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1">Prérequis</p>
                      {[
                        { n: '→', text: 'Votre compte Instagram doit être de type "Professionnel" ou "Entreprise"' },
                        { n: '→', text: 'Il doit être lié à une Page Facebook' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 1 — Créer l&apos;app Meta</p>
                      {[
                        { n: '1', text: 'Allez sur developers.facebook.com → "Mes applications" → "Créer une application"' },
                        { n: '2', text: 'Choisissez "Entreprise" → donnez un nom → créez l\'app' },
                        { n: '3', text: 'Tableau de bord → "Ajouter un produit" → Instagram → "Configurer"' },
                        { n: '4', text: 'Dans Instagram → Paramètres API, liez votre Page Facebook → récupérez le "Instagram Business Account ID"' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 2 — Token permanent</p>
                      {[
                        { n: '5', text: 'business.facebook.com → Paramètres → Utilisateurs → Utilisateurs système → Ajouter (Admin)' },
                        { n: '6', text: '"Générer un nouveau token" → sélectionnez votre app → activez instagram_basic + instagram_manage_messages + pages_messaging' },
                        { n: '7', text: 'Copiez le token — il ne s\'affiche qu\'une seule fois' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 3 — Webhook (après connexion)</p>
                      {[
                        { n: '8', text: 'Instagram → Webhooks → collez Webhook URL + Verify Token affichés après connexion ici' },
                        { n: '9', text: 'Abonnez-vous à l\'événement "messages"' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${IG_COLOR}18`, color: IG_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <a href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-mono mt-2 transition-colors hover:opacity-80" style={{ color: IG_COLOR }}>
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

          {/* ── WhatsApp form ── */}
          {platformTab === 'WHATSAPP' && (
            <>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${WA_COLOR}20` }}>
                  <MessageCircle className="w-4 h-4" style={{ color: WA_COLOR }} />
                </div>
                <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot WhatsApp Business</h2>
              </div>

              {/* Meta app tutorial */}
              <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setShowMetaHelp(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                    <span className="font-mono text-xs text-white/60">Comment obtenir le Phone Number ID et le token permanent ?</span>
                  </div>
                  {showMetaHelp ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                </button>
                {showMetaHelp && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="pt-4 space-y-2.5">
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1">Étape 1 — Créer l&apos;app Meta</p>
                      {[
                        { n: '1', text: 'Allez sur developers.facebook.com → "Mes applications" → "Créer une application"' },
                        { n: '2', text: 'Choisissez le type "Entreprise" — donnez un nom (ex: MonShopBot)' },
                        { n: '3', text: 'Tableau de bord → "Ajouter un produit" → WhatsApp → "Configurer"' },
                        { n: '4', text: 'Dans WhatsApp → Configuration API : copiez le "Phone Number ID"' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${WA_COLOR}18`, color: WA_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 2 — Générer un token permanent</p>
                      {[
                        { n: '5', text: 'Allez sur business.facebook.com → Paramètres → Utilisateurs → Utilisateurs système' },
                        { n: '6', text: 'Cliquez "Ajouter" → nommez l\'utilisateur (ex: YelhaBot) → rôle Admin → "Créer utilisateur système"' },
                        { n: '7', text: 'Cliquez "Générer un nouveau token" → sélectionnez votre app → activez whatsapp_business_messaging + whatsapp_business_management → "Générer le token"' },
                        { n: '8', text: 'Copiez le token affiché — il ne sera plus visible après. Collez-le dans le champ "Access Token" ci-dessous' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${WA_COLOR}18`, color: WA_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mt-3 mb-1">Étape 3 — Configurer le webhook (après connexion ici)</p>
                      {[
                        { n: '9', text: 'Dans WhatsApp → Configuration → section Webhook : collez le Webhook URL + Verify Token affichés après connexion' },
                        { n: '10', text: 'Abonnez-vous à l\'événement "messages"' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${WA_COLOR}18`, color: WA_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <div className="rounded-lg p-3 mt-3 flex items-start gap-2" style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.15)' }}>
                        <span className="text-yellow-400 text-xs mt-0.5">⚠️</span>
                        <p className="text-xs font-mono text-white/40 leading-relaxed">Le token temporaire affiché dans le dashboard expire en <span className="text-white/70">24h</span>. Utilisez obligatoirement le token d&apos;utilisateur système (étapes 5-8) pour un fonctionnement permanent.</p>
                      </div>
                      <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-mono mt-2 transition-colors hover:opacity-80" style={{ color: WA_COLOR }}>
                        <ExternalLink className="w-3 h-3" /> Documentation officielle Meta WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom de la connexion</label>
                  <input className={INPUT_CLASS} value={waForm.name} onChange={e => setWaForm(f => ({ ...f, name: e.target.value }))} placeholder="Mon Bot WhatsApp" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom affiché aux clients</label>
                  <input className={INPUT_CLASS} value={waForm.botName} onChange={e => setWaForm(f => ({ ...f, botName: e.target.value }))} placeholder="Assistant" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Phone Number ID <span className="text-white/20">(WhatsApp → Configuration API)</span></label>
                  <input className={INPUT_CLASS} value={waForm.whatsappPhoneNumberId} onChange={e => setWaForm(f => ({ ...f, whatsappPhoneNumberId: e.target.value }))} placeholder="123456789012345" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">
                    Access Token permanent <span className="text-white/20">(Business Manager → Utilisateurs système)</span>
                  </label>
                  <input className={INPUT_CLASS} type="password" value={waForm.whatsappAccessToken} onChange={e => setWaForm(f => ({ ...f, whatsappAccessToken: e.target.value }))} placeholder="EAAxxxxx..." />
                  <p className="text-xs text-white/20 mt-1.5 font-mono">⚠️ N&apos;utilisez pas le token temporaire du dashboard — il expire en 24h.</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Verify Token <span className="text-white/20">(inventez un mot de passe)</span></label>
                  <input className={INPUT_CLASS} value={waForm.whatsappVerifyToken} onChange={e => setWaForm(f => ({ ...f, whatsappVerifyToken: e.target.value }))} placeholder="mon_token_secret_123" />
                  <p className="text-xs text-white/20 mt-1.5 font-mono">Vous le réutiliserez dans Meta pour valider le webhook.</p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleAddWhatsApp} disabled={adding || !waForm.name || !waForm.whatsappPhoneNumberId || !waForm.whatsappAccessToken || !waForm.whatsappVerifyToken} className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40" style={{ background: ORANGE }}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  Connecter WhatsApp
                </button>
                <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all">Annuler</button>
              </div>
            </>
          )}

          {/* ── Messenger form ── */}
          {platformTab === 'FACEBOOK' && (
            <>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${FB_COLOR}20` }}>
                  <Facebook className="w-4 h-4" style={{ color: FB_COLOR }} />
                </div>
                <h2 className="font-mono font-semibold text-white text-sm">Nouveau bot Facebook Messenger</h2>
              </div>

              {/* Meta app tutorial */}
              <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setShowMetaHelp(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                    <span className="font-mono text-xs text-white/60">Comment créer une App Meta Messenger ?</span>
                  </div>
                  {showMetaHelp ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                </button>
                {showMetaHelp && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="pt-4 space-y-2.5">
                      {[
                        { n: '1', text: 'Allez sur developers.facebook.com → "Mes applications" → "Créer une application"' },
                        { n: '2', text: 'Choisissez le type "Entreprise" — donnez un nom à votre app' },
                        { n: '3', text: 'Dans le tableau de bord, ajoutez le produit "Messenger"' },
                        { n: '4', text: 'Dans Messenger → Paramètres, liez votre Page Facebook à l\'app' },
                        { n: '5', text: 'Générez un Access Token de Page — copiez-le ici' },
                        { n: '6', text: 'Dans Messenger → Webhooks, collez le Webhook URL + Verify Token après connexion ici' },
                        { n: '7', text: 'Abonnez-vous aux événements "messages" et "messaging_postbacks"' },
                      ].map(step => (
                        <div key={step.n} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold" style={{ background: `${FB_COLOR}18`, color: FB_COLOR }}>{step.n}</div>
                          <p className="text-xs font-mono text-white/50 pt-0.5 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                      <a href="https://developers.facebook.com/docs/messenger-platform/getting-started" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-mono mt-2 transition-colors hover:opacity-80" style={{ color: FB_COLOR }}>
                        <ExternalLink className="w-3 h-3" /> Documentation officielle Meta Messenger
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom de la connexion</label>
                  <input className={INPUT_CLASS} value={fbForm.name} onChange={e => setFbForm(f => ({ ...f, name: e.target.value }))} placeholder="Mon Bot Messenger" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom affiché aux clients</label>
                  <input className={INPUT_CLASS} value={fbForm.botName} onChange={e => setFbForm(f => ({ ...f, botName: e.target.value }))} placeholder="Assistant" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Page ID <span className="text-white/20">(Meta → Page About → Page ID)</span></label>
                  <input className={INPUT_CLASS} value={fbForm.messengerPageId} onChange={e => setFbForm(f => ({ ...f, messengerPageId: e.target.value }))} placeholder="123456789012345" />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Access Token de Page <span className="text-white/20">(Messenger → Paramètres)</span></label>
                  <input className={INPUT_CLASS} type="password" value={fbForm.messengerAccessToken} onChange={e => setFbForm(f => ({ ...f, messengerAccessToken: e.target.value }))} placeholder="EAAxxxxx..." />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-mono mb-1.5 block">Verify Token <span className="text-white/20">(choisissez un mot de passe quelconque)</span></label>
                  <input className={INPUT_CLASS} value={fbForm.messengerVerifyToken} onChange={e => setFbForm(f => ({ ...f, messengerVerifyToken: e.target.value }))} placeholder="mon_token_secret_123" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleAddMessenger} disabled={adding || !fbForm.name || !fbForm.messengerPageId || !fbForm.messengerAccessToken || !fbForm.messengerVerifyToken} className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40" style={{ background: ORANGE }}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
                  Connecter Messenger
                </button>
                <button onClick={() => setShowAdd(false)} className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2.5 rounded-xl border border-white/[0.07] transition-all">Annuler</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WhatsApp webhook banner ── */}
      {waResult && (
        <WebhookBanner
          color={WA_COLOR}
          title="WhatsApp connecté ! Configurez le webhook Meta :"
          webhookUrl={waResult.webhookUrl}
          verifyToken={waResult.verifyToken}
          copiedField={copiedField}
          onCopy={copyToClipboard}
          onClose={() => setWaResult(null)}
        />
      )}

      {/* ── Messenger webhook banner ── */}
      {fbResult && (
        <WebhookBanner
          color={FB_COLOR}
          title="Messenger connecté ! Configurez le webhook Meta :"
          webhookUrl={fbResult.webhookUrl}
          verifyToken={fbResult.verifyToken}
          copiedField={copiedField}
          onCopy={copyToClipboard}
          onClose={() => setFbResult(null)}
        />
      )}

      {/* ── Instagram webhook banner ── */}
      {igResult && (
        <WebhookBanner
          color={IG_COLOR}
          title={`Instagram${igResult.username ? ` @${igResult.username}` : ''} connecté ! Configurez le webhook Meta :`}
          webhookUrl={igResult.webhookUrl}
          verifyToken={igResult.verifyToken}
          copiedField={copiedField}
          onCopy={copyToClipboard}
          onClose={() => setIgResult(null)}
        />
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
                Aucun compte Instagram <span className="text-white/80">Pro</span> ou <span className="text-white/80">Business</span> n&apos;est lié à vos pages Facebook.
              </p>
              <button onClick={() => setIgNoAccountError(false)} className="flex items-center gap-2 font-mono text-xs px-4 py-2 rounded-xl transition-all hover:opacity-90" style={{ background: 'rgba(225,48,108,0.15)', color: IG_COLOR, border: '1px solid rgba(225,48,108,0.25)' }}>
                <ArrowRight className="w-3.5 h-3.5" /> Fermer
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
            <span className="font-mono font-semibold text-white text-sm">@{igOAuthResult.username} connecté avec succès !</span>
          </div>
          <button onClick={() => setIgOAuthResult(null)} className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors">Fermer</button>
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

      {/* ── WhatsApp connections ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4" style={{ color: WA_COLOR }} />
          <span className="font-mono text-xs text-white/40 uppercase tracking-wider">WhatsApp Business</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white" style={{ background: WA_COLOR }}>Disponible</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
        ) : whatsappConns.length === 0 ? (
          <div style={CARD_STYLE} className="py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${WA_COLOR}18` }}>
              <MessageCircle className="w-6 h-6" style={{ color: WA_COLOR }} />
            </div>
            <p className="text-white/40 font-mono text-sm">Aucun bot WhatsApp connecté</p>
            <p className="text-white/20 font-mono text-xs mt-1">Cliquez sur &quot;Ajouter un bot&quot; → WhatsApp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whatsappConns.map((conn: any) => (
              <div key={conn.id} style={CARD_STYLE} className="p-5 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${WA_COLOR}18` }}>
                      <MessageCircle className="w-5 h-5" style={{ color: WA_COLOR }} />
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
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-white/50">Phone ID: {conn.whatsappPhoneNumberId}</span>
                </div>
                <div className="text-[10px] font-mono text-white/25 mb-3 px-1">
                  Webhook: /api/webhooks/whatsapp/{conn.id}
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

      {/* ── Messenger connections ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Facebook className="w-4 h-4" style={{ color: FB_COLOR }} />
          <span className="font-mono text-xs text-white/40 uppercase tracking-wider">Facebook Messenger</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white" style={{ background: FB_COLOR }}>Disponible</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
        ) : messengerConns.length === 0 ? (
          <div style={CARD_STYLE} className="py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${FB_COLOR}18` }}>
              <Facebook className="w-6 h-6" style={{ color: FB_COLOR }} />
            </div>
            <p className="text-white/40 font-mono text-sm">Aucun bot Messenger connecté</p>
            <p className="text-white/20 font-mono text-xs mt-1">Cliquez sur &quot;Ajouter un bot&quot; → Messenger</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messengerConns.map((conn: any) => (
              <div key={conn.id} style={CARD_STYLE} className="p-5 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${FB_COLOR}18` }}>
                      <Facebook className="w-5 h-5" style={{ color: FB_COLOR }} />
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
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-white/50">Page ID: {conn.messengerPageId}</span>
                </div>
                <div className="text-[10px] font-mono text-white/25 mb-3 px-1">
                  Webhook: /api/webhooks/messenger/{conn.id}
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
          {isPartner ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Partenaire</span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 text-white/30 border border-white/10"><Lock className="w-2.5 h-2.5" /> Partenaire requis</span>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
        ) : !isPartner ? (
          <div style={{ ...CARD_STYLE, opacity: 0.5 }} className="py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${IG_COLOR}18` }}>
              <Lock className="w-6 h-6" style={{ color: IG_COLOR }} />
            </div>
            <p className="text-white/40 font-mono text-sm">Accès réservé aux partenaires YelhaDms</p>
            <p className="text-white/20 font-mono text-xs mt-1">Contactez-nous pour devenir partenaire</p>
          </div>
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
                  <span className="text-xs font-mono text-white/50">@{conn.instagramUsername || 'instagram'} — Actif</span>
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
