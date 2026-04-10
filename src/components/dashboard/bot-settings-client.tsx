'use client';

import { useState, useTransition } from 'react';
import {
  Bot, MessageSquare, Zap, Plus, Trash2, Edit2, X, Check,
  ChevronDown, Sparkles, Instagram, MessagesSquare,
  AlertCircle, Settings2, Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const ORANGE = '#FF6B2C';

const PERSONALITIES = [
  {
    id: 'professional',
    label: 'Professionnel',
    desc: 'Formel, courtois et précis',
    emoji: '💼',
  },
  {
    id: 'friendly',
    label: 'Amical',
    desc: 'Chaleureux, proche et accessible',
    emoji: '😊',
  },
  {
    id: 'commercial',
    label: 'Commercial',
    desc: 'Persuasif et orienté vente',
    emoji: '💰',
  },
  {
    id: 'formal',
    label: 'Formel',
    desc: 'Institutionnel et sérieux',
    emoji: '🏛️',
  },
  {
    id: 'casual',
    label: 'Décontracté',
    desc: 'Naturel, simple et sympa',
    emoji: '✌️',
  },
];

const PLATFORMS = [
  { id: 'TELEGRAM', label: 'Telegram', emoji: '✈️', available: true },
  { id: 'WHATSAPP', label: 'WhatsApp', emoji: '💬', available: false },
  { id: 'INSTAGRAM', label: 'Instagram', emoji: '📸', available: false },
  { id: 'MESSENGER', label: 'Messenger', emoji: '💙', available: false },
];

type PredefinedMessage = {
  id: string;
  keywords: string[];
  response: string;
  isActive: boolean;
  priority: number;
};

type DetailResponse = {
  id: string;
  questionType: string;
  response: string;
  isActive: boolean;
};

type Connection = {
  id: string;
  name: string;
  platform: string;
  botName: string;
  businessName: string | null;
  customInstructions: string | null;
  botPersonality: any;
  predefinedMessages: PredefinedMessage[];
  detailResponses: DetailResponse[];
};

type Tab = 'general' | 'personality' | 'predefined' | 'details';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Général', icon: Settings2 },
  { id: 'personality', label: 'Personnalité', icon: Sparkles },
  { id: 'predefined', label: 'Q&R Prédéfinies', icon: MessageSquare },
  { id: 'details', label: 'Réponses détaillées', icon: Layers },
];

export default function BotSettingsClient({ connections }: { connections: Connection[] }) {
  const router = useRouter();
  const [selectedConn, setSelectedConn] = useState<Connection | null>(connections[0] || null);
  const [tab, setTab] = useState<Tab>('general');
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // General form state
  const [botName, setBotName] = useState(selectedConn?.botName || '');
  const [businessName, setBusinessName] = useState(selectedConn?.businessName || '');
  const [customInstructions, setCustomInstructions] = useState(selectedConn?.customInstructions || '');

  // Personality
  const [personality, setPersonality] = useState<string>(
    (selectedConn?.botPersonality as any)?.preset || 'professional'
  );
  const [customPersonality, setCustomPersonality] = useState<string>(
    (selectedConn?.botPersonality as any)?.custom || ''
  );

  // Predefined messages
  const [messages, setMessages] = useState<PredefinedMessage[]>(
    selectedConn?.predefinedMessages || []
  );
  const [showMsgForm, setShowMsgForm] = useState(false);
  const [editMsg, setEditMsg] = useState<PredefinedMessage | null>(null);
  const [msgForm, setMsgForm] = useState({ keywords: '', response: '' });

  // Detail responses
  const [details, setDetails] = useState<DetailResponse[]>(
    selectedConn?.detailResponses || []
  );
  const [showDetailForm, setShowDetailForm] = useState(false);
  const [editDetail, setEditDetail] = useState<DetailResponse | null>(null);
  const [detailForm, setDetailForm] = useState({ questionType: '', response: '' });

  const switchConnection = (conn: Connection) => {
    setSelectedConn(conn);
    setBotName(conn.botName || '');
    setBusinessName(conn.businessName || '');
    setCustomInstructions(conn.customInstructions || '');
    setPersonality((conn.botPersonality as any)?.preset || 'professional');
    setCustomPersonality((conn.botPersonality as any)?.custom || '');
    setMessages(conn.predefinedMessages);
    setDetails(conn.detailResponses);
    setError('');
    setSaveSuccess(false);
  };

  const handleSaveGeneral = () => {
    if (!selectedConn) return;
    setError('');
    startTransition(async () => {
      const res = await fetch(`/api/connections/${selectedConn.id}/bot-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName: botName.trim() || 'Assistant',
          businessName: businessName.trim() || null,
          customInstructions: customInstructions.trim() || null,
          botPersonality: { preset: personality, custom: customPersonality.trim() || null },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de la sauvegarde');
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    });
  };

  // Predefined message handlers
  const openMsgForm = (msg?: PredefinedMessage) => {
    if (msg) {
      setEditMsg(msg);
      setMsgForm({ keywords: msg.keywords.join(', '), response: msg.response });
    } else {
      setEditMsg(null);
      setMsgForm({ keywords: '', response: '' });
    }
    setShowMsgForm(true);
  };

  const handleSaveMsg = () => {
    if (!selectedConn) return;
    if (!msgForm.keywords.trim() || !msgForm.response.trim()) return;

    startTransition(async () => {
      const keywords = msgForm.keywords.split(',').map((k) => k.trim()).filter(Boolean);
      const body = {
        connectionId: selectedConn.id,
        keywords,
        response: msgForm.response.trim(),
        ...(editMsg ? { id: editMsg.id } : {}),
      };
      const res = await fetch('/api/predefined-messages', {
        method: editMsg ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const saved = await res.json();
      if (editMsg) {
        setMessages((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      } else {
        setMessages((prev) => [...prev, saved]);
      }
      setShowMsgForm(false);
    });
  };

  const handleDeleteMsg = (id: string) => {
    if (!confirm('Supprimer cette réponse ?')) return;
    startTransition(async () => {
      await fetch(`/api/predefined-messages?id=${id}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });
  };

  // Detail response handlers
  const openDetailForm = (d?: DetailResponse) => {
    if (d) {
      setEditDetail(d);
      setDetailForm({ questionType: d.questionType, response: d.response });
    } else {
      setEditDetail(null);
      setDetailForm({ questionType: '', response: '' });
    }
    setShowDetailForm(true);
  };

  const handleSaveDetail = () => {
    if (!selectedConn) return;
    if (!detailForm.questionType.trim() || !detailForm.response.trim()) return;

    startTransition(async () => {
      const body = {
        connectionId: selectedConn.id,
        questionType: detailForm.questionType.trim(),
        response: detailForm.response.trim(),
        ...(editDetail ? { id: editDetail.id } : {}),
      };
      const res = await fetch('/api/detail-responses', {
        method: editDetail ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const saved = await res.json();
      if (editDetail) {
        setDetails((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      } else {
        setDetails((prev) => [...prev, saved]);
      }
      setShowDetailForm(false);
    });
  };

  const handleDeleteDetail = (id: string) => {
    if (!confirm('Supprimer cette réponse ?')) return;
    startTransition(async () => {
      await fetch(`/api/detail-responses?id=${id}`, { method: 'DELETE' });
      setDetails((prev) => prev.filter((d) => d.id !== id));
    });
  };

  if (connections.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: `${ORANGE}15` }}
        >
          <Bot className="w-8 h-8" style={{ color: ORANGE }} />
        </div>
        <h3 className="font-mono font-bold text-white text-lg mb-2">Aucun bot connecté</h3>
        <p className="font-mono text-sm text-white/40 mb-6">
          Connectez d&apos;abord un bot Telegram pour accéder aux réglages
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Platform selector */}
      <div>
        <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">Plateforme</p>
        <div className="flex gap-3 flex-wrap">
          {PLATFORMS.map((p) => (
            <div key={p.id} className="relative group">
              <div
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border font-mono text-sm transition-all ${
                  p.available
                    ? selectedConn?.platform === p.id
                      ? 'border-orange-500/60 text-white'
                      : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70 cursor-pointer'
                    : 'border-white/[0.05] text-white/20 cursor-not-allowed'
                }`}
                style={
                  p.available && selectedConn?.platform === p.id
                    ? { background: `${ORANGE}15`, borderColor: `${ORANGE}60` }
                    : {}
                }
              >
                <span className="text-lg">{p.emoji}</span>
                <span className="font-semibold">{p.label}</span>
                {!p.available && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/20 border border-white/[0.06]">
                    BIENTÔT
                  </span>
                )}
                {p.available && selectedConn?.platform === p.id && (
                  <Check className="w-3.5 h-3.5 ml-1" style={{ color: ORANGE }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bot selector (if multiple bots) */}
      {connections.length > 1 && (
        <div>
          <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">Bot actif</p>
          <div className="flex gap-2 flex-wrap">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => switchConnection(c)}
                className={`px-4 py-2 rounded-xl font-mono text-sm transition-all border ${
                  selectedConn?.id === c.id
                    ? 'text-white'
                    : 'text-white/40 border-white/[0.06] hover:border-white/20 hover:text-white/60'
                }`}
                style={
                  selectedConn?.id === c.id
                    ? { background: `${ORANGE}20`, borderColor: `${ORANGE}40`, color: ORANGE }
                    : {}
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                tab === t.id ? 'text-white' : 'text-white/30 hover:text-white/60'
              }`}
              style={tab === t.id ? { background: ORANGE } : {}}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* --- Tab: General --- */}
      {tab === 'general' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">
                Nom du bot <span className="text-white/20">(vu par vos clients)</span>
              </label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="Assistant, Yelha Bot..."
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">Nom de l'entreprise</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ma Boutique DZ"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-white/50 mb-1.5">
              Instructions personnalisées{' '}
              <span className="text-white/20">(contexte supplémentaire pour le bot)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Ex: Nous livrons uniquement en Algérie. Notre délai de livraison est de 48-72h. En cas de problème, le client doit contacter le 0550 XX XX XX..."
              rows={5}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none leading-relaxed"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-mono text-xs">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveGeneral}
              disabled={isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: ORANGE }}
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Enregistrer
            </button>
            {saveSuccess && (
              <span className="font-mono text-sm text-green-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Sauvegardé !
              </span>
            )}
          </div>
        </div>
      )}

      {/* --- Tab: Personality --- */}
      {tab === 'personality' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
          <div>
            <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-4">
              Personnalité prédéfinie
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    personality === p.id
                      ? 'border-orange-500/50'
                      : 'border-white/[0.06] hover:border-white/20'
                  }`}
                  style={
                    personality === p.id
                      ? { background: `${ORANGE}10` }
                      : { background: 'rgba(255,255,255,0.02)' }
                  }
                >
                  <span className="text-xl flex-shrink-0">{p.emoji}</span>
                  <div>
                    <p
                      className="font-mono text-sm font-semibold"
                      style={personality === p.id ? { color: ORANGE } : { color: 'rgba(255,255,255,0.8)' }}
                    >
                      {p.label}
                    </p>
                    <p className="font-mono text-xs text-white/30 mt-0.5">{p.desc}</p>
                  </div>
                  {personality === p.id && (
                    <Check className="w-4 h-4 ml-auto flex-shrink-0 mt-0.5" style={{ color: ORANGE }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-white/50 mb-1.5">
              Personnalité personnalisée{' '}
              <span className="text-white/20">(optionnel — remplace la sélection ci-dessus)</span>
            </label>
            <textarea
              value={customPersonality}
              onChange={(e) => setCustomPersonality(e.target.value)}
              placeholder="Ex: Le bot parle toujours en Darija algérienne, utilise des expressions familières, reste très sympa et peut faire des blagues légères..."
              rows={4}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveGeneral}
              disabled={isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: ORANGE }}
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Enregistrer
            </button>
            {saveSuccess && (
              <span className="font-mono text-sm text-green-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Sauvegardé !
              </span>
            )}
          </div>
        </div>
      )}

      {/* --- Tab: Predefined Q&A --- */}
      {tab === 'predefined' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-start gap-3">
            <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
            <div>
              <p className="font-mono text-sm text-white font-semibold mb-0.5">
                Questions–Réponses prédéfinies
              </p>
              <p className="font-mono text-xs text-white/40 leading-relaxed">
                Définissez des mots-clés et une réponse exacte. Quand un client envoie un message
                contenant ces mots-clés, le bot répond directement <strong className="text-white/60">sans utiliser de tokens</strong>.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => openMsgForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: ORANGE }}
            >
              <Plus className="w-4 h-4" />
              Ajouter une Q&R
            </button>
          </div>

          {messages.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
              <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="font-mono text-sm text-white/30">Aucune réponse prédéfinie</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs font-mono px-2 py-0.5 rounded-full border"
                          style={{
                            color: ORANGE,
                            borderColor: `${ORANGE}40`,
                            background: `${ORANGE}10`,
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                    <p className="font-mono text-sm text-white/70 leading-relaxed">{msg.response}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openMsgForm(msg)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMsg(msg.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Tab: Detail Responses --- */}
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-start gap-3">
            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
            <div>
              <p className="font-mono text-sm text-white font-semibold mb-0.5">
                Réponses détaillées contextuelles
              </p>
              <p className="font-mono text-xs text-white/40 leading-relaxed">
                Définissez un type de question et une réponse type. Le bot adapte toujours cette
                réponse au contexte et à la personnalité configurée, mais reste fidèle à votre
                contenu. Idéal pour : prix de livraison, politique de retour, horaires, etc.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => openDetailForm()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: ORANGE }}
            >
              <Plus className="w-4 h-4" />
              Ajouter une réponse
            </button>
          </div>

          {details.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
              <Layers className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="font-mono text-sm text-white/30">Aucune réponse détaillée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {details.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-semibold mb-1.5" style={{ color: ORANGE }}>
                      Type : {d.questionType}
                    </p>
                    <p className="font-mono text-sm text-white/70 leading-relaxed">{d.response}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openDetailForm(d)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDetail(d.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Predefined message form */}
      {showMsgForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMsgForm(false)}
          />
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono font-bold text-white text-lg">
                {editMsg ? 'Modifier la Q&R' : 'Nouvelle Q&R prédéfinie'}
              </h2>
              <button
                onClick={() => setShowMsgForm(false)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  Mots-clés <span className="text-white/20">(séparés par des virgules)</span>
                </label>
                <input
                  type="text"
                  value={msgForm.keywords}
                  onChange={(e) => setMsgForm({ ...msgForm, keywords: e.target.value })}
                  placeholder="livraison, délai, combien de temps"
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
                <p className="font-mono text-xs text-white/20 mt-1.5">
                  Le bot déclenchera cette réponse quand le message contient l'un de ces mots
                </p>
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  Réponse exacte
                </label>
                <textarea
                  value={msgForm.response}
                  onChange={(e) => setMsgForm({ ...msgForm, response: e.target.value })}
                  placeholder="Notre délai de livraison est de 48-72h sur Alger et 3-5 jours pour les autres wilayas."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMsgForm(false)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveMsg}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: ORANGE }}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editMsg ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detail response form */}
      {showDetailForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDetailForm(false)}
          />
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono font-bold text-white text-lg">
                {editDetail ? 'Modifier la réponse' : 'Nouvelle réponse détaillée'}
              </h2>
              <button
                onClick={() => setShowDetailForm(false)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  Type de question
                </label>
                <input
                  type="text"
                  value={detailForm.questionType}
                  onChange={(e) => setDetailForm({ ...detailForm, questionType: e.target.value })}
                  placeholder="Ex: Prix de livraison, Politique de retour, Horaires d'ouverture..."
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
                <p className="font-mono text-xs text-white/20 mt-1.5">
                  L&apos;IA détectera ce type de question et répondra toujours avec votre contenu
                </p>
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  Votre réponse type
                </label>
                <textarea
                  value={detailForm.response}
                  onChange={(e) => setDetailForm({ ...detailForm, response: e.target.value })}
                  placeholder="Ex: La livraison est gratuite à partir de 5000 DA d'achat. En dessous, nous facturons 400 DA pour Alger et 600 DA pour les autres wilayas."
                  rows={5}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                />
                <p className="font-mono text-xs text-white/20 mt-1.5">
                  Le bot reformulera ce contenu selon la personnalité configurée, mais gardera toujours les mêmes informations
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDetailForm(false)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveDetail}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: ORANGE }}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editDetail ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
