'use client';

import { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Bot, Search, User, Send, Plug, RefreshCw, MapPin, FileText, Edit2, Check, X, AlertTriangle, PauseCircle, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ORANGE = '#FF6B2C';

function formatRelative(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'maintenant';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

type Message = {
  id: string;
  direction: string;
  content: string;
  type: string;
  tokensUsed: number;
  createdAt: Date;
};

type Conversation = {
  id: string;
  contactName: string | null;
  contactId: string;
  lastMessage: Date;
  createdAt: Date;
  isNew: boolean;
  isSuspended: boolean;
  needsHelp: boolean;
  spamScore: number;
  messages: Message[];
};

type Connection = {
  id: string;
  name: string;
  platform: string;
  botName: string;
  isActive: boolean;
  conversations: Conversation[];
};

type ContactContext = {
  contactName: string | null;
  wilaya: string | null;
  notes: string | null;
  lastSeenAt: Date;
};

export default function ConversationsClient({ connections }: { connections: Connection[] }) {
  const t = useTranslations('conversations');
  const params = useParams();
  const locale = params.locale as string;
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(
    connections[0] || null
  );
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(
    connections[0]?.conversations[0] || null
  );
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactCtx, setContactCtx] = useState<ContactContext | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [convStates, setConvStates] = useState<Record<string, { isSuspended: boolean; needsHelp: boolean }>>({});
  const [isPending, startTransition] = useTransition();

  // Editable context fields
  const [editNotes, setEditNotes] = useState('');
  const [editWilaya, setEditWilaya] = useState('');
  const [editingContext, setEditingContext] = useState(false);

  const totalConvs = connections.reduce((acc, c) => acc + c.conversations.length, 0);

  const filteredConvs = (selectedConnection?.conversations || []).filter((c) => {
    const name = c.contactName || c.contactId;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Charger les messages d'une conversation
  const loadMessages = async (convId: string, connectionId: string, contactId: string) => {
    setLoadingMessages(true);
    try {
      const [msgRes, ctxRes] = await Promise.all([
        fetch(`/api/conversations/${convId}/messages`),
        fetch(`/api/conversations/context?connectionId=${connectionId}&contactId=${encodeURIComponent(contactId)}`),
      ]);
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(data);
      }
      if (ctxRes.ok) {
        const ctx = await ctxRes.json();
        setContactCtx(ctx);
        setEditNotes(ctx?.notes || '');
        setEditWilaya(ctx?.wilaya || '');
      } else {
        setContactCtx(null);
        setEditNotes('');
        setEditWilaya('');
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedConv && selectedConnection) {
      loadMessages(selectedConv.id, selectedConnection.id, selectedConv.contactId);
    }
  }, [selectedConv?.id]);

  const getConvState = (conv: Conversation) => ({
    isSuspended: convStates[conv.id]?.isSuspended ?? conv.isSuspended,
    needsHelp: convStates[conv.id]?.needsHelp ?? conv.needsHelp,
  });

  const handleToggleConvSuspend = (conv: Conversation) => {
    const current = getConvState(conv);
    startTransition(async () => {
      const res = await fetch(`/api/conversations/${conv.id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !current.isSuspended }),
      });
      if (res.ok) {
        setConvStates(prev => ({ ...prev, [conv.id]: { ...current, isSuspended: !current.isSuspended } }));
      }
    });
  };

  const handleResolveHelp = (conv: Conversation) => {
    startTransition(async () => {
      const res = await fetch(`/api/conversations/${conv.id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ needsHelp: false, isSuspended: false }),
      });
      if (res.ok) {
        const current = getConvState(conv);
        setConvStates(prev => ({ ...prev, [conv.id]: { ...current, needsHelp: false, isSuspended: false } }));
      }
    });
  };

  const handleSaveContext = () => {
    if (!selectedConv || !selectedConnection) return;
    startTransition(async () => {
      const res = await fetch('/api/conversations/context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection.id,
          contactId: selectedConv.contactId,
          wilaya: editWilaya.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setContactCtx(updated);
        setEditingContext(false);
      }
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
        <h3 className="font-mono font-bold text-white text-lg mb-2">{t('noBotTitle')}</h3>
        <p className="font-mono text-sm text-white/40 mb-6">
          {t('noBotDesc')}
        </p>
        <Link
          href={`/${locale}/dashboard/connections`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: ORANGE }}
        >
          <Plug className="w-4 h-4" />
          {t('connectBot')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('stats.activeBots'),    value: connections.length },
          { label: t('stats.conversations'), value: totalConvs },
          {
            label: t('stats.today'),
            value: connections
              .flatMap((c) => c.conversations)
              .filter(
                (c) => new Date(c.lastMessage).toDateString() === new Date().toDateString()
              ).length,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
          >
            <p className="font-mono text-2xl font-bold text-white">{stat.value}</p>
            <p className="font-mono text-xs text-white/30 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-12 gap-4 h-[600px]">
        {/* Bot selector */}
        <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.06]">
            <p className="font-mono text-[10px] font-semibold text-white/30 uppercase tracking-wider">{t('bots')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {connections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => {
                  setSelectedConnection(conn);
                  const first = conn.conversations[0] || null;
                  setSelectedConv(first);
                  setMessages([]);
                }}
                className={`w-full flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all ${
                  selectedConnection?.id === conn.id ? '' : 'hover:bg-white/[0.04]'
                }`}
                style={
                  selectedConnection?.id === conn.id
                    ? { background: `${ORANGE}15` }
                    : {}
                }
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold"
                  style={{
                    background: selectedConnection?.id === conn.id ? `${ORANGE}30` : 'rgba(255,255,255,0.06)',
                    color: selectedConnection?.id === conn.id ? ORANGE : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {conn.platform === 'TELEGRAM' ? 'TG' : 'WA'}
                </div>
                <p
                  className="font-mono text-[10px] font-semibold truncate w-full"
                  style={{ color: selectedConnection?.id === conn.id ? ORANGE : 'rgba(255,255,255,0.4)' }}
                >
                  {conn.name}
                </p>
                <p className="font-mono text-[9px] text-white/20">
                  {conn.conversations.length} conv.
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="font-mono text-xs text-white/20">{t('noConversation')}</p>
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const lastMsg = conv.messages[0];
                const state = getConvState(conv);
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/[0.04] transition-all ${
                      selectedConv?.id === conv.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                    } ${state.isSuspended ? 'opacity-50' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-mono font-bold"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                      >
                        {(conv.contactName || conv.contactId)[0]?.toUpperCase() || '?'}
                      </div>
                      {state.needsHelp && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <AlertTriangle className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-mono text-xs font-semibold text-white truncate">
                          {conv.contactName || conv.contactId}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {state.isSuspended && <PauseCircle className="w-3 h-3 text-yellow-400" />}
                          <span className="font-mono text-[10px] text-white/20">
                            {formatRelative(new Date(conv.lastMessage))}
                          </span>
                        </div>
                      </div>
                      {state.needsHelp && (
                        <p className="font-mono text-[10px] text-red-400 mb-0.5">⚠️ {t('needsHelp')}</p>
                      )}
                      {lastMsg && (
                        <p className="font-mono text-[11px] text-white/30 truncate">
                          {lastMsg.direction === 'outbound' ? '🤖 ' : '👤 '}
                          {lastMsg.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="col-span-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          {selectedConv ? (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-mono font-bold flex-shrink-0"
                  style={{ background: `${ORANGE}20`, color: ORANGE }}
                >
                  {(selectedConv.contactName || selectedConv.contactId)[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-white truncate">
                    {selectedConv.contactName || selectedConv.contactId}
                  </p>
                  <div className="flex items-center gap-3">
                    {contactCtx?.wilaya && (
                      <span className="font-mono text-[10px] text-white/30 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {contactCtx.wilaya}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-white/20">
                      {selectedConnection?.platform === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Resolve needs help */}
                  {selectedConv && getConvState(selectedConv).needsHelp && (
                    <button
                      onClick={() => selectedConv && handleResolveHelp(selectedConv)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-all"
                    >
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      {t('resolve')}
                    </button>
                  )}
                  {/* Suspend conv */}
                  {selectedConv && (
                    <button
                      onClick={() => handleToggleConvSuspend(selectedConv)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg transition-all text-white/30 hover:bg-white/[0.06]"
                      style={getConvState(selectedConv).isSuspended ? { color: '#F59E0B' } : {}}
                    >
                      {getConvState(selectedConv).isSuspended
                        ? <PlayCircle className="w-4 h-4" />
                        : <PauseCircle className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => setShowContextPanel(!showContextPanel)}
                    className={`p-1.5 rounded-lg transition-all ${showContextPanel ? 'text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.06]'}`}
                    style={showContextPanel ? { background: `${ORANGE}20`, color: ORANGE } : {}}
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => selectedConv && selectedConnection && loadMessages(selectedConv.id, selectedConnection.id, selectedConv.contactId)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE }}
                      />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="font-mono text-xs text-white/20">{t('noMessages')}</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                            msg.direction === 'outbound'
                              ? 'rounded-tr-sm'
                              : 'rounded-tl-sm bg-white/[0.06] text-white/80'
                          }`}
                          style={
                            msg.direction === 'outbound'
                              ? { background: `${ORANGE}25` }
                              : {}
                          }
                        >
                          {msg.type === 'voice' && (
                            <p className="font-mono text-[10px] text-white/30 mb-1">🎤 {t('voiceTranscribed')}</p>
                          )}
                          {msg.type === 'image' && (
                            <p className="font-mono text-[10px] text-white/30 mb-1">🖼️ {t('image')}</p>
                          )}
                          <p className="font-mono text-xs leading-relaxed text-white/80">{msg.content}</p>
                          <p className="font-mono text-[9px] text-white/20 mt-1 text-right">
                            {new Date(msg.createdAt).toLocaleTimeString('fr-DZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {msg.tokensUsed > 0 && ` · ${msg.tokensUsed}t`}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Context panel */}
                {showContextPanel && (
                  <div className="w-52 border-l border-white/[0.06] p-3 overflow-y-auto flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                        {t('clientProfile')}
                      </p>
                      {!editingContext ? (
                        <button
                          onClick={() => setEditingContext(true)}
                          className="p-1 rounded text-white/20 hover:text-white/50 transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={handleSaveContext}
                            disabled={isPending}
                            className="p-1 rounded text-green-400 hover:text-green-300 transition-all"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingContext(false)}
                            className="p-1 rounded text-white/20 hover:text-white/50 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="font-mono text-[9px] text-white/20 uppercase mb-1">{t('name')}</p>
                        <p className="font-mono text-xs text-white/60">
                          {contactCtx?.contactName || selectedConv.contactName || selectedConv.contactId}
                        </p>
                      </div>

                      <div>
                        <p className="font-mono text-[9px] text-white/20 uppercase mb-1">{t('wilaya')}</p>
                        {editingContext ? (
                          <input
                            type="text"
                            value={editWilaya}
                            onChange={(e) => setEditWilaya(e.target.value)}
                            placeholder={t('wilaYaPlaceholder')}
                            className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                          />
                        ) : (
                          <p className="font-mono text-xs text-white/60">
                            {contactCtx?.wilaya || '—'}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="font-mono text-[9px] text-white/20 uppercase mb-1">{t('notes')}</p>
                        {editingContext ? (
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder={t('notesPlaceholder')}
                            rows={4}
                            className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                          />
                        ) : (
                          <p className="font-mono text-[11px] text-white/50 leading-relaxed">
                            {contactCtx?.notes || '—'}
                          </p>
                        )}
                      </div>

                      {contactCtx?.lastSeenAt && (
                        <div>
                          <p className="font-mono text-[9px] text-white/20 uppercase mb-1">{t('lastSeen')}</p>
                          <p className="font-mono text-[10px] text-white/30">
                            {formatRelative(new Date(contactCtx.lastSeenAt))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Read-only notice */}
              <div className="p-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-4 py-2.5">
                  <Send className="w-4 h-4 text-white/10" />
                  <span className="font-mono text-xs text-white/20">
                    {t('readOnly', { platform: selectedConnection?.platform === 'TELEGRAM' ? 'Telegram' : 'WhatsApp' })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="font-mono text-sm text-white/20">{t('selectConversation')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
