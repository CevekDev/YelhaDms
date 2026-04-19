'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageSquare, Bot, Search, Send, Plug, RefreshCw,
  AlertTriangle, PauseCircle, PlayCircle, Trash2, ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ORANGE = '#FF6B2C';

function formatContactDisplay(contactName: string | null, contactId: string): string {
  if (contactName) return contactName;
  // Strip WhatsApp suffixes from raw JIDs
  return contactId.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'maintenant';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

function ContactAvatar({
  name,
  photoUrl,
  size = 'md',
  style: extraStyle,
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';
  const fallbackStyle = extraStyle ?? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' };

  if (photoUrl) {
    return (
      <div className={`${dim} rounded-full flex-shrink-0 relative overflow-hidden`} style={fallbackStyle}>
        {/* Initials shown underneath as fallback */}
        <span className="absolute inset-0 flex items-center justify-center font-mono font-bold">
          {name[0]?.toUpperCase() || '?'}
        </span>
        <img
          src={photoUrl}
          alt={name}
          className={`${dim} rounded-full object-cover absolute inset-0`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-mono font-bold flex-shrink-0`}
      style={fallbackStyle}
    >
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
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
  lastMessagePreview?: string | null;
};

type Connection = {
  id: string;
  name: string;
  platform: string;
  botName: string;
  isActive: boolean;
  conversations: Conversation[];
  contactContexts?: { contactId: string; metadata: any }[];
};

type ContactContext = {
  contactName: string | null;
  wilaya: string | null;
  notes: string | null;
  lastSeenAt: Date;
  metadata?: { telegramUsername?: string; profilePhotoUrl?: string; lastPhotoFetch?: number } | null;
};

type ContactPhotoMap = Record<string, string | undefined>; // contactId → profilePhotoUrl

function buildPhotoMap(connection: Connection | null): ContactPhotoMap {
  if (!connection?.contactContexts) return {};
  const map: ContactPhotoMap = {};
  for (const ctx of connection.contactContexts) {
    const url = (ctx.metadata as any)?.profilePhotoUrl;
    if (url) map[ctx.contactId] = url;
  }
  return map;
}

export default function ConversationsClient({ connections }: { connections: Connection[] }) {
  const t = useTranslations('conversations');
  const params = useParams();
  const locale = params.locale as string;
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(connections[0] || null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(connections[0]?.conversations[0] || null);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactCtx, setContactCtx] = useState<ContactContext | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [convStates, setConvStates] = useState<Record<string, { isSuspended: boolean; needsHelp: boolean }>>({});
  const [isPending, startTransition] = useTransition();
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build a contactId → profilePhotoUrl map from the pre-loaded contactContexts
  const photoMap = useMemo(() => buildPhotoMap(selectedConnection), [selectedConnection]);

  const totalConvs = connections.reduce((acc, c) => acc + c.conversations.length, 0);

  const filteredConvs = (selectedConnection?.conversations || []).filter((c) => {
    const name = c.contactName || c.contactId;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const loadMessages = async (convId: string, connectionId: string, contactId: string) => {
    setLoadingMessages(true);
    try {
      const [msgRes, ctxRes] = await Promise.all([
        fetch(`/api/conversations/${convId}/messages`),
        fetch(`/api/conversations/context?connectionId=${connectionId}&contactId=${encodeURIComponent(contactId)}`),
      ]);
      if (msgRes.ok) setMessages(await msgRes.json());
      if (ctxRes.ok) setContactCtx(await ctxRes.json());
      else setContactCtx(null);
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

  // Auto-refresh messages every 5s while a conversation is open
  useEffect(() => {
    if (!selectedConv || !selectedConnection) return;
    const interval = setInterval(() => {
      fetch(`/api/conversations/${selectedConv.id}/messages`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setMessages(data); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConv?.id, selectedConnection?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      if (res.ok) setConvStates(prev => ({ ...prev, [conv.id]: { ...current, isSuspended: !current.isSuspended } }));
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

  const handleDeleteConv = async (convId: string) => {
    setDeletingId(convId);
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      if (selectedConnection) {
        const updated = { ...selectedConnection, conversations: selectedConnection.conversations.filter(c => c.id !== convId) };
        setSelectedConnection(updated as any);
        if (selectedConv?.id === convId) { setSelectedConv(null); setMessages([]); setMobileView('list'); }
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedConvIds.size} conversation(s) ?`)) return;
    for (const id of Array.from(selectedConvIds)) await handleDeleteConv(id);
    setSelectedConvIds(new Set());
    setBulkMode(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || !selectedConnection || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selectedConv.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim(), connectionId: selectedConnection.id }),
      });
      if (res.ok) {
        setReplyText('');
        await loadMessages(selectedConv.id, selectedConnection.id, selectedConv.contactId);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erreur lors de l\'envoi');
      }
    } finally {
      setSending(false);
    }
  };

  if (connections.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${ORANGE}15` }}>
          <Bot className="w-8 h-8" style={{ color: ORANGE }} />
        </div>
        <h3 className="font-mono font-bold text-white text-lg mb-2">{t('noBotTitle')}</h3>
        <p className="font-mono text-sm text-white/40 mb-6">{t('noBotDesc')}</p>
        <Link href={`/${locale}/dashboard/connections`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: ORANGE }}>
          <Plug className="w-4 h-4" />
          {t('connectBot')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Compact stats + bulk bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[
            { label: 'Bots', value: connections.length },
            { label: 'Conversations', value: totalConvs },
            { label: "Aujourd'hui", value: connections.flatMap(c => c.conversations).filter(c => new Date(c.lastMessage).toDateString() === new Date().toDateString()).length },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center min-w-[60px]">
              <p className="font-mono text-base font-bold text-white">{stat.value}</p>
              <p className="font-mono text-[9px] text-white/30">{stat.label}</p>
            </div>
          ))}
        </div>
        {bulkMode && selectedConvIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="font-mono text-xs text-red-400">{selectedConvIds.size} sél.</span>
            <button onClick={handleBulkDelete} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 text-red-400 font-mono text-xs hover:bg-red-500/30 transition-all">
              <Trash2 className="w-3 h-3" /> Supprimer
            </button>
            <button onClick={() => { setBulkMode(false); setSelectedConvIds(new Set()); }} className="font-mono text-xs text-white/30 hover:text-white/60">✕</button>
          </div>
        )}
      </div>

      {/* Mobile bot selector tabs */}
      {connections.length > 1 && mobileView === 'list' && (
        <div className="lg:hidden overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-2 min-w-max pb-1">
            {connections.map((conn) => (
              <button key={conn.id} onClick={() => { setSelectedConnection(conn); setSelectedConv(conn.conversations[0] || null); setMessages([]); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs border transition-all flex-shrink-0"
                style={selectedConnection?.id === conn.id
                  ? { background: `${ORANGE}20`, borderColor: `${ORANGE}40`, color: ORANGE }
                  : { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                <span>{conn.platform === 'TELEGRAM' ? '✈️' : '💬'}</span>
                <span>{conn.name}</span>
                <span className="text-[10px] px-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>{conn.conversations.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main panel */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-3" style={{ height: undefined }}>
        {/* Bot selector — desktop only */}
        <div className="hidden lg:flex flex-col lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" style={{ maxHeight: '72vh' }}>
          <div className="p-2.5 border-b border-white/[0.06]">
            <p className="font-mono text-[9px] font-semibold text-white/30 uppercase tracking-wider">{t('bots')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {connections.map((conn) => (
              <button key={conn.id} onClick={() => { setSelectedConnection(conn); setSelectedConv(conn.conversations[0] || null); setMessages([]); }}
                className={`w-full flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all ${selectedConnection?.id === conn.id ? '' : 'hover:bg-white/[0.04]'}`}
                style={selectedConnection?.id === conn.id ? { background: `${ORANGE}15` } : {}}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-bold"
                  style={{ background: selectedConnection?.id === conn.id ? `${ORANGE}30` : 'rgba(255,255,255,0.06)', color: selectedConnection?.id === conn.id ? ORANGE : 'rgba(255,255,255,0.4)' }}>
                  {conn.platform === 'TELEGRAM' ? 'TG' : 'WA'}
                </div>
                <p className="font-mono text-[9px] font-semibold truncate w-full"
                  style={{ color: selectedConnection?.id === conn.id ? ORANGE : 'rgba(255,255,255,0.4)' }}>{conn.name}</p>
                <p className="font-mono text-[8px] text-white/20">{conn.conversations.length} conv.</p>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden lg:col-span-3 ${mobileView === 'thread' ? 'hidden lg:flex' : 'flex'}`}
          style={{ maxHeight: mobileView === 'list' ? '65vh' : undefined, minHeight: '50vh' }}>
          <div className="p-2.5 border-b border-white/[0.06] space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')}
                className="w-full pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40" />
            </div>
            <button onClick={() => { setBulkMode(!bulkMode); setSelectedConvIds(new Set()); }}
              className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg font-mono text-[10px] transition-all"
              style={bulkMode ? { background: '#EF444415', color: '#EF4444' } : { color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Trash2 className="w-3 h-3" />
              {bulkMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="font-mono text-xs text-white/20">{t('noConversation')}</p>
              </div>
            ) : filteredConvs.map((conv) => {
              const state = getConvState(conv);
              const preview = conv.lastMessagePreview ?? (conv.messages[0] ? `${conv.messages[0].direction === 'outbound' ? '🤖 ' : ''}${conv.messages[0].content}` : null);
              const isSelected = selectedConvIds.has(conv.id);
              return (
                <div key={conv.id}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-b border-white/[0.04] transition-all ${selectedConv?.id === conv.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'} ${state.isSuspended ? 'opacity-50' : ''}`}>
                  {bulkMode && (
                    <input type="checkbox" checked={isSelected} onChange={() => { const s = new Set(selectedConvIds); isSelected ? s.delete(conv.id) : s.add(conv.id); setSelectedConvIds(s); }}
                      className="mt-2 flex-shrink-0 accent-orange-500" />
                  )}
                  <button className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
                    onClick={() => { setSelectedConv(conv); setMobileView('thread'); loadMessages(conv.id, selectedConnection!.id, conv.contactId); }}>
                    <div className="relative flex-shrink-0">
                      <ContactAvatar
                        name={formatContactDisplay(conv.contactName, conv.contactId)}
                        photoUrl={selectedConnection?.platform === 'TELEGRAM' ? photoMap[conv.contactId] : undefined}
                      />
                      {state.needsHelp && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center">
                          <AlertTriangle className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-mono text-xs font-semibold text-white truncate">{formatContactDisplay(conv.contactName, conv.contactId)}</p>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          {state.isSuspended && <PauseCircle className="w-3 h-3 text-yellow-400" />}
                          <span className="font-mono text-[9px] text-white/20">{formatRelative(new Date(conv.lastMessage))}</span>
                        </div>
                      </div>
                      {state.needsHelp && <p className="font-mono text-[9px] text-red-400 mb-0.5">⚠️ {t('needsHelp')}</p>}
                      <p className="font-mono text-[10px] text-white/30 truncate">{preview ?? '...'}</p>
                    </div>
                  </button>
                  {!bulkMode && (
                    <button onClick={() => { if (confirm('Supprimer ?')) handleDeleteConv(conv.id); }} disabled={deletingId === conv.id}
                      className="p-1 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0 mt-1.5">
                      {deletingId === conv.id
                        ? <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin block" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Message thread */}
        <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden lg:col-span-7 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}`}
          style={mobileView === 'thread' ? { height: 'calc(100dvh - 180px)' } : { maxHeight: '72vh' }}>
          {selectedConv ? (
            <>
              {/* Thread header */}
              <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2.5">
                <button onClick={() => setMobileView('list')} className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <ContactAvatar
                  name={formatContactDisplay(selectedConv.contactName, selectedConv.contactId)}
                  photoUrl={selectedConnection?.platform === 'TELEGRAM' ? (contactCtx?.metadata?.profilePhotoUrl ?? photoMap[selectedConv.contactId]) : undefined}
                  style={{ background: `${ORANGE}20`, color: ORANGE }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-white truncate">
                    {formatContactDisplay(selectedConv.contactName, selectedConv.contactId)}
                  </p>
                  <p className="font-mono text-[9px] text-white/30">
                    {contactCtx?.metadata?.telegramUsername ? `@${contactCtx.metadata.telegramUsername} · ` : ''}
                    {selectedConnection?.platform === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}
                    {contactCtx?.wilaya ? ` · ${contactCtx.wilaya}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {selectedConv && getConvState(selectedConv).needsHelp && (
                    <button onClick={() => selectedConv && handleResolveHelp(selectedConv)} disabled={isPending}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-all">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="hidden sm:inline">{t('resolve')}</span>
                    </button>
                  )}
                  {selectedConv && (
                    <button onClick={() => handleToggleConvSuspend(selectedConv)} disabled={isPending}
                      className="p-1.5 rounded-lg transition-all text-white/30 hover:bg-white/[0.06]"
                      style={getConvState(selectedConv).isSuspended ? { color: '#F59E0B' } : {}}>
                      {getConvState(selectedConv).isSuspended ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => selectedConv && selectedConnection && loadMessages(selectedConv.id, selectedConnection.id, selectedConv.contactId)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
                    <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="font-mono text-xs text-white/20">{t('noMessages')}</p>
                  </div>
                ) : messages.filter(m => m.direction !== 'system').map((msg, idx, arr) => {
                  const isInbound = msg.direction === 'inbound';
                  const prevMsg = idx > 0 ? arr[idx - 1] : null;
                  const isFirstInGroup = !prevMsg || prevMsg.direction !== msg.direction;
                  // WhatsApp profile photos are auth-gated temp URLs that can't be loaded in browser
                  const contactPhotoUrl = selectedConnection?.platform === 'TELEGRAM'
                    ? (contactCtx?.metadata?.profilePhotoUrl ?? photoMap[selectedConv!.contactId])
                    : undefined;
                  return (
                    <div key={msg.id} className={`flex items-end gap-1.5 ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      {/* Avatar on the left for inbound messages — only on first in group */}
                      {isInbound && (
                        <div className="flex-shrink-0 self-end mb-0.5">
                          {isFirstInGroup ? (
                            <ContactAvatar
                              name={formatContactDisplay(selectedConv!.contactName, selectedConv!.contactId)}
                              photoUrl={contactPhotoUrl}
                              size="sm"
                            />
                          ) : (
                            <div className="w-7 h-7" />
                          )}
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isInbound ? 'rounded-tl-sm bg-white/[0.06] text-white/80' : 'rounded-tr-sm'}`}
                        style={!isInbound ? { background: `${ORANGE}25` } : {}}>
                        {msg.type === 'voice' && <p className="font-mono text-[9px] text-white/30 mb-0.5">🎤 {t('voiceTranscribed')}</p>}
                        {msg.type === 'image' && <p className="font-mono text-[9px] text-white/30 mb-0.5">🖼️ {t('image')}</p>}
                        {msg.type === 'manual' && <p className="font-mono text-[9px] mb-0.5" style={{ color: `${ORANGE}90` }}>✏️ Vous</p>}
                        <p className="font-mono text-xs leading-relaxed text-white/80 whitespace-pre-wrap">{msg.content}</p>
                        <p className="font-mono text-[9px] text-white/20 mt-0.5 text-right">
                          {new Date(msg.createdAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                          {msg.tokensUsed > 0 && ` · ${msg.tokensUsed}t`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-2.5 border-t border-white/[0.06]">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    placeholder="Répondre au client..."
                    rows={1}
                    className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                    style={{ minHeight: '36px', maxHeight: '96px' }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-40"
                    style={{ background: ORANGE }}
                  >
                    {sending
                      ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4 text-white" />}
                  </button>
                </div>
                <p className="font-mono text-[9px] text-white/15 mt-1 px-1">Entrée pour envoyer · Shift+Entrée pour nouvelle ligne</p>
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
