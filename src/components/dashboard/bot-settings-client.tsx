'use client';

import { useState, useTransition } from 'react';
import {
  Bot, Plus, Trash2, Edit2, X, Check,
  Sparkles, AlertCircle, Settings2, Layers, PauseCircle, PlayCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ORANGE = '#FF6B2C';

const PERSONALITY_IDS = [
  { id: 'professional', emoji: '💼' },
  { id: 'friendly', emoji: '😊' },
  { id: 'commercial', emoji: '💰' },
  { id: 'formal', emoji: '🏛️' },
  { id: 'casual', emoji: '✌️' },
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
  isSuspended: boolean;
  predefinedMessages: PredefinedMessage[];
  detailResponses: DetailResponse[];
};

type Tab = 'general' | 'personality' | 'details';

export default function BotSettingsClient({ connections }: { connections: Connection[] }) {
  const t = useTranslations('botConfig');
  const router = useRouter();
  const [selectedConn, setSelectedConn] = useState<Connection | null>(connections[0] || null);
  const [tab, setTab] = useState<Tab>('general');
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSuspended, setIsSuspended] = useState(selectedConn?.isSuspended ?? false);

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
    setDetails(conn.detailResponses);
    setIsSuspended(conn.isSuspended);
    setError('');
    setSaveSuccess(false);
  };

  const handleToggleSuspend = () => {
    if (!selectedConn) return;
    startTransition(async () => {
      const res = await fetch(`/api/connections/${selectedConn.id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !isSuspended }),
      });
      if (res.ok) {
        setIsSuspended(!isSuspended);
      }
    });
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
    if (!confirm(t('detailDelete'))) return;
    startTransition(async () => {
      await fetch(`/api/detail-responses?id=${id}`, { method: 'DELETE' });
      setDetails((prev) => prev.filter((d) => d.id !== id));
    });
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: t('tabs.general'), icon: Settings2 },
    { id: 'personality', label: t('tabs.personality'), icon: Sparkles },
    { id: 'details', label: t('tabs.details'), icon: Layers },
  ];

  if (connections.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: `${ORANGE}15` }}
        >
          <Bot className="w-8 h-8" style={{ color: ORANGE }} />
        </div>
        <h3 className="font-mono font-bold text-white text-lg mb-2">{t('noBotConnected')}</h3>
        <p className="font-mono text-sm text-white/40 mb-6">{t('noBotConnectedDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Platform selector */}
      <div>
        <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">{t('platform')}</p>
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
                    {t('soonLabel')}
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
          <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">{t('activePlatform')}</p>
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

      {/* Suspend bot toggle */}
      {selectedConn && (
        <div
          className={`rounded-2xl border p-4 flex items-center justify-between ${
            isSuspended
              ? 'border-yellow-500/30 bg-yellow-500/[0.05]'
              : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-3">
            {isSuspended
              ? <PauseCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              : <PlayCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
            <div>
              <p className="font-mono text-sm font-semibold text-white">
                {isSuspended ? t('botSuspended') : t('botActive')}
              </p>
              <p className="font-mono text-xs text-white/40">
                {isSuspended ? t('botSuspendedDesc') : t('botActiveDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleSuspend}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              isSuspended ? 'bg-yellow-500' : 'bg-green-500'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSuspended ? 'translate-x-1' : 'translate-x-6'
              }`}
            />
          </button>
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
                {t('botNameLabel')} <span className="text-white/20">{t('botNameHint')}</span>
              </label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="Assistant, MonBot..."
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-white/50 mb-1.5">{t('businessNameLabel')}</label>
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
              {t('customInstructionsLabel')}{' '}
              <span className="text-white/20">{t('customInstructionsHint')}</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t('customInstructionsPlaceholder')}
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
              {t('save')}
            </button>
            {saveSuccess && (
              <span className="font-mono text-sm text-green-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {t('saved')}
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
              {t('personalityPreset')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PERSONALITY_IDS.map((p) => (
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
                      {t(`personality${p.id.charAt(0).toUpperCase()}${p.id.slice(1)}` as any)}
                    </p>
                    <p className="font-mono text-xs text-white/30 mt-0.5">
                      {t(`personality${p.id.charAt(0).toUpperCase()}${p.id.slice(1)}Desc` as any)}
                    </p>
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
              {t('personalityCustom')}{' '}
              <span className="text-white/20">{t('personalityCustomHint')}</span>
            </label>
            <textarea
              value={customPersonality}
              onChange={(e) => setCustomPersonality(e.target.value)}
              placeholder={t('personalityCustomPlaceholder')}
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
              {t('save')}
            </button>
            {saveSuccess && (
              <span className="font-mono text-sm text-green-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {t('saved')}
              </span>
            )}
          </div>
        </div>
      )}


      {/* --- Tab: Detail Responses --- */}
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-start gap-3">
            <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
            <div>
              <p className="font-mono text-sm text-white font-semibold mb-0.5">
                {t('detailsTitle')}
              </p>
              <p className="font-mono text-xs text-white/40 leading-relaxed">
                {t('detailsDesc')}
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
              {t('detailAdd')}
            </button>
          </div>

          {details.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
              <Layers className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="font-mono text-sm text-white/30">{t('detailsTitle')}</p>
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
                      {t('detailQuestionType')} : {d.questionType}
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
                {editDetail ? t('detailEdit') : t('detailAdd')}
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
                  {t('detailQuestionType')}
                </label>
                <input
                  type="text"
                  value={detailForm.questionType}
                  onChange={(e) => setDetailForm({ ...detailForm, questionType: e.target.value })}
                  placeholder={t('detailQuestionPlaceholder')}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  {t('detailResponse')}
                </label>
                <textarea
                  value={detailForm.response}
                  onChange={(e) => setDetailForm({ ...detailForm, response: e.target.value })}
                  placeholder={t('detailResponsePlaceholder')}
                  rows={5}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDetailForm(false)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                {t('detailCancel')}
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
                {t('detailSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
