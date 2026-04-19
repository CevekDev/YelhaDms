'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Bot, Plus, Trash2, Edit2, X, Check,
  Sparkles, AlertCircle, Settings2, Layers, PauseCircle, PlayCircle,
  MessageSquare, Truck, Lock, CheckCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ORANGE = '#FF6B2C';
const SKY = '#0ea5e9';
const WA_COLOR = '#25d366';

const PERSONALITY_IDS = [
  { id: 'professional', emoji: '💼', label: 'Professionnel',   desc: 'Formel, courtois et précis' },
  { id: 'friendly',     emoji: '😊', label: 'Amical',          desc: 'Chaleureux, proche et accessible' },
  { id: 'commercial',   emoji: '💰', label: 'Commercial',      desc: 'Persuasif et orienté vente' },
  { id: 'formal',       emoji: '🏛️', label: 'Formel',          desc: 'Institutionnel et sérieux' },
  { id: 'casual',       emoji: '✌️', label: 'Décontracté',     desc: 'Naturel, simple et sympa' },
  { id: 'luxury',       emoji: '💎', label: 'Luxe',            desc: 'Élégant, raffiné, haut de gamme' },
  { id: 'dz_friendly',  emoji: '🤝', label: 'Darija DZ',       desc: 'Parle en darija algérienne naturelle' },
  { id: 'tech',         emoji: '💻', label: 'Tech',            desc: 'Précis, technique et efficace' },
  { id: 'urgent',       emoji: '⚡', label: 'Urgence',         desc: 'Réactif, direct, sans délai' },
];

const COMMERCE_TYPES = [
  { id: 'products', emoji: '📦', label: 'Produits',  desc: 'Vente de produits physiques ou numériques' },
  { id: 'services', emoji: '🛠️', label: 'Services',  desc: 'Prestations, consultations, formations' },
  { id: 'other',    emoji: '🔄', label: 'Autre',     desc: 'Restaurant, agence, professionnel libéral...' },
];

type PredefinedMessage = { id: string; keywords: string[]; response: string; isActive: boolean; priority: number };
type DetailResponse    = { id: string; questionType: string; response: string; isActive: boolean };

type Connection = {
  id: string;
  name: string;
  platform: string;
  botName: string;
  businessName: string | null;
  customInstructions: string | null;
  botPersonality: any;
  commerceType: string | null;
  isSuspended: boolean;
  welcomeMessage: string | null;
  awayMessage: string | null;
  deliveryFee: number | null;
  deliveryPricingText: string | null;
  autoConfirmDelay: number | null;
  predefinedMessages: PredefinedMessage[];
  detailResponses: DetailResponse[];
};

type Tab = 'general' | 'personality' | 'messages' | 'delivery' | 'details';

const INPUT = 'w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40';
const TEXTAREA = `${INPUT} resize-none leading-relaxed`;

export default function BotSettingsClient({ connections }: { connections: Connection[] }) {
  const t = useTranslations('botConfig');
  const router = useRouter();
  const [selectedConn, setSelectedConn] = useState<Connection | null>(connections[0] || null);
  const [tab, setTab] = useState<Tab>('general');
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSuspended, setIsSuspended] = useState(selectedConn?.isSuspended ?? false);

  // General
  const [botName, setBotName] = useState(selectedConn?.botName || '');
  const [businessName, setBusinessName] = useState(selectedConn?.businessName || '');
  const [customInstructions, setCustomInstructions] = useState(selectedConn?.customInstructions || '');
  const [commerceType, setCommerceType] = useState(selectedConn?.commerceType || 'products');

  // Personality
  const [personality, setPersonality] = useState<string>((selectedConn?.botPersonality as any)?.preset || 'professional');
  const [customPersonality, setCustomPersonality] = useState<string>((selectedConn?.botPersonality as any)?.custom || '');

  // Messages
  const [welcomeMessage, setWelcomeMessage] = useState(selectedConn?.welcomeMessage || '');
  const [awayMessage, setAwayMessage] = useState(selectedConn?.awayMessage || '');
  const [predefined, setPredefined] = useState<PredefinedMessage[]>(selectedConn?.predefinedMessages || []);
  const [newKeywords, setNewKeywords] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [addingMsg, setAddingMsg] = useState(false);

  // Delivery
  const [deliveryFee, setDeliveryFee] = useState(selectedConn?.deliveryFee ?? 0);
  const [deliveryPricingText, setDeliveryPricingText] = useState(selectedConn?.deliveryPricingText || '');
  const [autoConfirmDelay, setAutoConfirmDelay] = useState(selectedConn?.autoConfirmDelay ?? 0);

  // Ecotrack
  const [ecoUrl, setEcoUrl] = useState('');
  const [ecoToken, setEcoToken] = useState('');
  const [ecoAutoShip, setEcoAutoShip] = useState(false);
  const [ecoConfigured, setEcoConfigured] = useState(false);
  const [ecoSaving, setEcoSaving] = useState(false);

  // Details
  const [details, setDetails] = useState<DetailResponse[]>(selectedConn?.detailResponses || []);
  const [showDetailForm, setShowDetailForm] = useState(false);
  const [editDetail, setEditDetail] = useState<DetailResponse | null>(null);
  const [detailForm, setDetailForm] = useState({ questionType: '', response: '' });

  // Load Ecotrack config when connection changes
  useEffect(() => {
    if (!selectedConn) return;
    fetch(`/api/connections/${selectedConn.id}/ecotrack`)
      .then(r => r.json())
      .then(data => {
        setEcoUrl(data.ecotrackUrl || '');
        setEcoConfigured(!!data.ecotrackConfigured);
        setEcoAutoShip(!!data.ecotrackAutoShip);
      })
      .catch(() => {});
  }, [selectedConn?.id]);

  const switchConnection = (conn: Connection) => {
    setSelectedConn(conn);
    setBotName(conn.botName || '');
    setBusinessName(conn.businessName || '');
    setCustomInstructions(conn.customInstructions || '');
    setCommerceType(conn.commerceType || 'products');
    setPersonality((conn.botPersonality as any)?.preset || 'professional');
    setCustomPersonality((conn.botPersonality as any)?.custom || '');
    setWelcomeMessage(conn.welcomeMessage || '');
    setAwayMessage(conn.awayMessage || '');
    setPredefined(conn.predefinedMessages || []);
    setDeliveryFee(conn.deliveryFee ?? 0);
    setDeliveryPricingText(conn.deliveryPricingText || '');
    setAutoConfirmDelay(conn.autoConfirmDelay ?? 0);
    setDetails(conn.detailResponses || []);
    setIsSuspended(conn.isSuspended);
    setError('');
    setSaveSuccess(false);
    setEcoUrl('');
    setEcoToken('');
    setEcoConfigured(false);
    setEcoAutoShip(false);
  };

  const flash = () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); };

  const handleToggleSuspend = () => {
    if (!selectedConn) return;
    startTransition(async () => {
      const res = await fetch(`/api/connections/${selectedConn.id}/suspend`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !isSuspended }),
      });
      if (res.ok) setIsSuspended(v => !v);
    });
  };

  const handleSaveGeneral = () => {
    if (!selectedConn) return;
    setError('');
    if (!botName.trim()) { setError('Le nom du bot est obligatoire'); return; }
    if (!businessName.trim()) { setError("Le nom de l'entreprise est obligatoire"); return; }
    startTransition(async () => {
      const res = await fetch(`/api/connections/${selectedConn.id}/bot-settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botName: botName.trim(), businessName: businessName.trim(), customInstructions: customInstructions.trim() || null, commerceType, botPersonality: { preset: personality, custom: customPersonality.trim() || null } }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as any).error || 'Erreur'); return; }
      flash(); router.refresh();
    });
  };

  const handleSaveMessages = () => {
    if (!selectedConn) return;
    startTransition(async () => {
      await fetch(`/api/connections/${selectedConn.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcomeMessage: welcomeMessage || null, awayMessage: awayMessage || null }),
      });
      flash();
    });
  };

  const handleAddPredefined = async () => {
    if (!selectedConn || !newKeywords || !newResponse) return;
    setAddingMsg(true);
    const res = await fetch(`/api/connections/${selectedConn.id}/predefined-messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: newKeywords.split(',').map((k: string) => k.trim()).filter(Boolean), response: newResponse, isActive: true, priority: predefined.length }),
    });
    if (res.ok) { setNewKeywords(''); setNewResponse(''); const d = await res.json(); setPredefined(prev => [...prev, d]); }
    setAddingMsg(false);
  };

  const handleDeletePredefined = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    await fetch(`/api/connections/${selectedConn!.id}/predefined-messages/${id}`, { method: 'DELETE' });
    setPredefined(prev => prev.filter(m => m.id !== id));
  };

  const handleSaveDelivery = () => {
    if (!selectedConn) return;
    startTransition(async () => {
      await fetch(`/api/connections/${selectedConn.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryFee, deliveryPricingText: deliveryPricingText || null, autoConfirmDelay }),
      });
      flash();
    });
  };

  const handleSaveEcotrack = async (remove = false) => {
    if (!selectedConn) return;
    setEcoSaving(true);
    const res = await fetch(`/api/connections/${selectedConn.id}/ecotrack`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(remove ? { remove: true } : { url: ecoUrl, token: ecoToken, autoShip: ecoAutoShip }),
    });
    if (res.ok) {
      setEcoConfigured(!remove);
      if (remove) { setEcoUrl(''); setEcoToken(''); setEcoAutoShip(false); }
      else setEcoToken('');
    }
    setEcoSaving(false);
  };

  // Details
  const openDetailForm = (d?: DetailResponse) => {
    setEditDetail(d || null);
    setDetailForm(d ? { questionType: d.questionType, response: d.response } : { questionType: '', response: '' });
    setShowDetailForm(true);
  };

  const handleSaveDetail = () => {
    if (!selectedConn || !detailForm.questionType.trim() || !detailForm.response.trim()) return;
    startTransition(async () => {
      const body = { connectionId: selectedConn.id, questionType: detailForm.questionType.trim(), response: detailForm.response.trim(), ...(editDetail ? { id: editDetail.id } : {}) };
      const res = await fetch('/api/detail-responses', { method: editDetail ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) return;
      const saved = await res.json();
      if (editDetail) setDetails(prev => prev.map(d => d.id === saved.id ? saved : d));
      else setDetails(prev => [...prev, saved]);
      setShowDetailForm(false);
    });
  };

  const handleDeleteDetail = (id: string) => {
    if (!confirm(t('detailDelete'))) return;
    startTransition(async () => {
      await fetch(`/api/detail-responses?id=${id}`, { method: 'DELETE' });
      setDetails(prev => prev.filter(d => d.id !== id));
    });
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general',     label: 'Général',      icon: Settings2 },
    { id: 'personality', label: 'Personnalité',  icon: Sparkles },
    { id: 'messages',    label: 'Messages',      icon: MessageSquare },
    { id: 'delivery',    label: 'Livraison',     icon: Truck },
    { id: 'details',     label: 'Détails',       icon: Layers },
  ];

  const telegramConns = connections.filter(c => c.platform === 'TELEGRAM');
  const whatsappConns = connections.filter(c => c.platform === 'WHATSAPP');

  if (connections.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${ORANGE}15` }}>
          <Bot className="w-8 h-8" style={{ color: ORANGE }} />
        </div>
        <h3 className="font-mono font-bold text-white text-lg mb-2">{t('noBotConnected')}</h3>
        <p className="font-mono text-sm text-white/40">{t('noBotConnectedDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bot selector grouped by platform */}
      <div className="space-y-3">
        {telegramConns.length > 0 && (
          <div>
            <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: SKY }} />
              Telegram
            </p>
            <div className="flex gap-2 flex-wrap">
              {telegramConns.map(c => (
                <button key={c.id} onClick={() => switchConnection(c)}
                  className="px-4 py-2 rounded-xl font-mono text-sm border transition-all"
                  style={selectedConn?.id === c.id
                    ? { background: `${SKY}20`, borderColor: `${SKY}50`, color: SKY }
                    : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {whatsappConns.length > 0 && (
          <div>
            <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: WA_COLOR }} />
              WhatsApp
            </p>
            <div className="flex gap-2 flex-wrap">
              {whatsappConns.map(c => (
                <button key={c.id} onClick={() => switchConnection(c)}
                  className="px-4 py-2 rounded-xl font-mono text-sm border transition-all"
                  style={selectedConn?.id === c.id
                    ? { background: `${WA_COLOR}20`, borderColor: `${WA_COLOR}50`, color: WA_COLOR }
                    : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suspend toggle */}
      {selectedConn && (
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${isSuspended ? 'border-yellow-500/30 bg-yellow-500/[0.05]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
          <div className="flex items-center gap-3">
            {isSuspended ? <PauseCircle className="w-5 h-5 text-yellow-400" /> : <PlayCircle className="w-5 h-5 text-green-400" />}
            <div>
              <p className="font-mono text-sm font-semibold text-white">{isSuspended ? t('botSuspended') : t('botActive')}</p>
              <p className="font-mono text-xs text-white/40">{isSuspended ? t('botSuspendedDesc') : t('botActiveDesc')}</p>
            </div>
          </div>
          <button onClick={handleToggleSuspend} disabled={isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSuspended ? 'bg-yellow-500' : 'bg-green-500'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSuspended ? 'translate-x-1' : 'translate-x-6'}`} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] flex-wrap">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${tab === tb.id ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
              style={tab === tb.id ? { background: ORANGE } : {}}>
              <Icon className="w-4 h-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Général ── */}
      {tab === 'general' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">{t('botNameLabel')} <span className="text-white/20">{t('botNameHint')}</span></label>
              <input type="text" value={botName} onChange={e => setBotName(e.target.value)} placeholder="Assistant, MonBot..." className={INPUT} />
            </div>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">{t('businessNameLabel')}</label>
              <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ma Boutique DZ" className={INPUT} />
            </div>
          </div>

          <div>
            <p className="font-mono text-xs text-white/50 mb-3">Type de commerce</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COMMERCE_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setCommerceType(ct.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${commerceType === ct.id ? 'border-orange-500/50' : 'border-white/[0.06] hover:border-white/20'}`}
                  style={commerceType === ct.id ? { background: `${ORANGE}10` } : { background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-xl">{ct.emoji}</span>
                  <div>
                    <p className="font-mono text-sm font-semibold" style={commerceType === ct.id ? { color: ORANGE } : { color: 'rgba(255,255,255,0.8)' }}>{ct.label}</p>
                    <p className="font-mono text-xs text-white/30 mt-0.5">{ct.desc}</p>
                  </div>
                  {commerceType === ct.id && <Check className="w-4 h-4 ml-auto flex-shrink-0 mt-0.5" style={{ color: ORANGE }} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-white/50 mb-1.5">{t('customInstructionsLabel')} <span className="text-white/20">{t('customInstructionsHint')}</span></label>
            <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} placeholder={t('customInstructionsPlaceholder')} rows={5} className={TEXTAREA} />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-mono text-xs">{error}</span>
            </div>
          )}
          <SaveRow isPending={isPending} saveSuccess={saveSuccess} onSave={handleSaveGeneral} t={t} />
        </div>
      )}

      {/* ── Tab: Personnalité ── */}
      {tab === 'personality' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
          <p className="font-mono text-xs text-white/30 uppercase tracking-wider">{t('personalityPreset')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERSONALITY_IDS.map(p => (
              <button key={p.id} onClick={() => setPersonality(p.id)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${personality === p.id ? 'border-orange-500/50' : 'border-white/[0.06] hover:border-white/20'}`}
                style={personality === p.id ? { background: `${ORANGE}10` } : { background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-xl">{p.emoji}</span>
                <div>
                  <p className="font-mono text-sm font-semibold" style={personality === p.id ? { color: ORANGE } : { color: 'rgba(255,255,255,0.8)' }}>{p.label}</p>
                  <p className="font-mono text-xs text-white/30 mt-0.5">{p.desc}</p>
                </div>
                {personality === p.id && <Check className="w-4 h-4 ml-auto flex-shrink-0 mt-0.5" style={{ color: ORANGE }} />}
              </button>
            ))}
          </div>
          <div>
            <label className="block font-mono text-xs text-white/50 mb-1.5">{t('personalityCustom')} <span className="text-white/20">{t('personalityCustomHint')}</span></label>
            <textarea value={customPersonality} onChange={e => setCustomPersonality(e.target.value)} placeholder={t('personalityCustomPlaceholder')} rows={4} className={TEXTAREA} />
          </div>
          <SaveRow isPending={isPending} saveSuccess={saveSuccess} onSave={handleSaveGeneral} t={t} />
        </div>
      )}

      {/* ── Tab: Messages ── */}
      {tab === 'messages' && (
        <div className="space-y-5">
          {/* Welcome / away */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
            <p className="font-mono text-xs text-white/30 uppercase tracking-wider">Messages automatiques</p>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">{t('welcomeMessage')}</label>
              <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="Bienvenue ! Comment puis-je vous aider ?" rows={3} className={TEXTAREA} />
            </div>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">{t('awayMessage')}</label>
              <textarea value={awayMessage} onChange={e => setAwayMessage(e.target.value)} placeholder="Nous sommes actuellement fermés." rows={3} className={TEXTAREA} />
            </div>
            <SaveRow isPending={isPending} saveSuccess={saveSuccess} onSave={handleSaveMessages} t={t} />
          </div>

          {/* Predefined messages */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
            <p className="font-mono text-xs text-white/30 uppercase tracking-wider">Messages prédéfinis <span className="text-white/20 normal-case">(0 token)</span></p>
            {predefined.map(msg => (
              <div key={msg.id} className="rounded-xl border border-white/[0.06] p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] text-white/30 mb-1">Mots-clés : {msg.keywords.join(', ')}</p>
                  <p className="font-mono text-sm text-white/70 leading-relaxed">{msg.response}</p>
                </div>
                <button onClick={() => handleDeletePredefined(msg.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="border border-dashed border-white/10 rounded-xl p-4 space-y-3">
              <p className="font-mono text-xs text-white/40">Ajouter un message prédéfini</p>
              <div>
                <label className="font-mono text-[10px] text-white/30 mb-1 block">Mots-clés (séparés par des virgules)</label>
                <input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="prix, tarif, كم الثمن" className={INPUT} />
              </div>
              <div>
                <label className="font-mono text-[10px] text-white/30 mb-1 block">Réponse</label>
                <textarea value={newResponse} onChange={e => setNewResponse(e.target.value)} placeholder="Nos prix commencent à..." rows={3} className={TEXTAREA} />
              </div>
              <button onClick={handleAddPredefined} disabled={addingMsg || !newKeywords || !newResponse}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm text-white hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ background: ORANGE }}>
                {addingMsg ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Livraison ── */}
      {tab === 'delivery' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
            <p className="font-mono text-xs text-white/30 uppercase tracking-wider">Tarification</p>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">
                Frais de livraison par défaut (DA) <span className="text-white/20">— utilisé si la wilaya n'est pas dans le tableau</span>
              </label>
              <input type="number" min={0} value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value))} placeholder="0" className={`${INPUT} max-w-[160px]`} />
            </div>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">
                Tarification par wilaya <span className="text-white/20">— une wilaya par ligne : <code>Wilaya: prix</code></span>
              </label>
              <textarea
                value={deliveryPricingText}
                onChange={e => setDeliveryPricingText(e.target.value)}
                placeholder={'Alger: 400\nOran: 500\nAnnaba: 550\nAutres: 700'}
                rows={6}
                className={`${TEXTAREA} font-mono`}
              />
              <p className="font-mono text-xs text-white/25 mt-1.5">
                Si Ecotrack est connecté, le prix est fourni par leur API — ce tableau est ignoré.
              </p>
            </div>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">
                Confirmation automatique <span className="text-white/20">— 0 = désactivé</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={8760} value={autoConfirmDelay} onChange={e => setAutoConfirmDelay(Number(e.target.value))} className={`${INPUT} max-w-[120px]`} />
                <span className="font-mono text-sm text-white/40">heures</span>
              </div>
              {autoConfirmDelay > 0 && (
                <p className="font-mono text-xs text-white/25 mt-1">Le bot envoie un message de confirmation {autoConfirmDelay}h après chaque commande.</p>
              )}
            </div>
            <SaveRow isPending={isPending} saveSuccess={saveSuccess} onSave={handleSaveDelivery} t={t} />
          </div>

          {/* Ecotrack */}
          <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: ecoConfigured ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-400" />
                <p className="font-mono text-sm font-semibold text-white">Intégration Ecotrack</p>
                {ecoConfigured && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 bg-green-500/15 text-green-400 border border-green-500/30">
                    <CheckCircle className="w-3 h-3" /> Connecté
                  </span>
                )}
              </div>
              {ecoConfigured && (
                <button onClick={() => handleSaveEcotrack(true)} disabled={ecoSaving}
                  className="text-xs font-mono text-red-400 hover:text-red-300 flex items-center gap-1">
                  <X className="w-3 h-3" /> Déconnecter
                </button>
              )}
            </div>
            <p className="font-mono text-xs text-white/30">Le bot validera automatiquement les wilayas/communes, proposera domicile ou Stop Desk, et créera les expéditions.</p>
            <div className="space-y-3">
              <div>
                <label className="font-mono text-xs text-white/40 mb-1 block">URL Ecotrack</label>
                <input value={ecoUrl} onChange={e => setEcoUrl(e.target.value)} placeholder="https://ecotrack.app" className={INPUT} />
              </div>
              <div>
                <label className="font-mono text-xs text-white/40 mb-1 block">
                  Token API {ecoConfigured && <span className="text-green-400 ml-2">● Token enregistré</span>}
                </label>
                <input type="password" value={ecoToken} onChange={e => setEcoToken(e.target.value)} placeholder={ecoConfigured ? '••••••••••••••••' : 'Votre token API'} className={INPUT} />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]">
                <button
                  onClick={() => setEcoAutoShip(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${ecoAutoShip ? 'bg-orange-500' : 'bg-white/20'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${ecoAutoShip ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="font-mono text-sm text-white">Expédition automatique</p>
                  <p className="font-mono text-xs text-white/30">Expédie sur Ecotrack quand le client confirme.</p>
                </div>
              </div>
              <button onClick={() => handleSaveEcotrack(false)} disabled={ecoSaving || !ecoUrl || (!ecoToken && !ecoConfigured)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm text-white hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ background: ORANGE }}>
                {ecoSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Truck className="w-4 h-4" />}
                {ecoConfigured ? 'Mettre à jour' : 'Connecter Ecotrack'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Détails ── */}
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-start gap-3">
            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
            <div>
              <p className="font-mono text-sm text-white font-semibold mb-0.5">{t('detailsTitle')}</p>
              <p className="font-mono text-xs text-white/40 leading-relaxed">{t('detailsDesc')}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => openDetailForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: ORANGE }}>
              <Plus className="w-4 h-4" />{t('detailAdd')}
            </button>
          </div>
          {details.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
              <Layers className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="font-mono text-sm text-white/30">{t('detailsTitle')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {details.map(d => (
                <div key={d.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-semibold mb-1.5" style={{ color: ORANGE }}>{t('detailQuestionType')} : {d.questionType}</p>
                    <p className="font-mono text-sm text-white/70 leading-relaxed">{d.response}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openDetailForm(d)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteDetail(d.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Detail form */}
      {showDetailForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDetailForm(false)} />
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono font-bold text-white text-lg">{editDetail ? t('detailEdit') : t('detailAdd')}</h2>
              <button onClick={() => setShowDetailForm(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">{t('detailQuestionType')}</label>
                <input type="text" value={detailForm.questionType} onChange={e => setDetailForm({ ...detailForm, questionType: e.target.value })} placeholder={t('detailQuestionPlaceholder')} className={INPUT} />
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">{t('detailResponse')}</label>
                <textarea value={detailForm.response} onChange={e => setDetailForm({ ...detailForm, response: e.target.value })} placeholder={t('detailResponsePlaceholder')} rows={5} className={TEXTAREA} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDetailForm(false)} className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all">{t('detailCancel')}</button>
              <button onClick={handleSaveDetail} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                style={{ background: ORANGE }}>
                {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {t('detailSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveRow({ isPending, saveSuccess, onSave, t }: { isPending: boolean; saveSuccess: boolean; onSave: () => void; t: any }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onSave} disabled={isPending}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: ORANGE }}>
        {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
        {t('save')}
      </button>
      {saveSuccess && <span className="font-mono text-sm text-green-400 flex items-center gap-1.5"><Check className="w-4 h-4" />{t('saved')}</span>}
    </div>
  );
}
