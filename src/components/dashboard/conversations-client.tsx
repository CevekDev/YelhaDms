'use client';

import { useState, useEffect, useTransition, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageSquare, Bot, Search, Send, Plug, RefreshCw,
  AlertTriangle, PauseCircle, PlayCircle, Trash2, ChevronLeft,
  Wifi, WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ORANGE = '#FF6B2C';

function formatContactDisplay(contactName: string | null, contactId: string): string {
  if (contactName) return contactName;
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
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const fallbackStyle = extraStyle ?? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' };

  if (photoUrl) {
    return (
      <div className={`${dim} rounded-full flex-shrink-0 relative overflow-hidden`} style={fallbackStyle}>
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

type ContactPhotoMap = Record<string, string | undefined>;

function buildPhotoMap(connection: Connection | null): ContactPhotoMap {
  if (!connection?.contactContexts) return {};
  const map: ContactPhotoMap = {};
  for (const ctx of connection.contactContexts) {
    const url = (ctx.metadata as any)?.profilePhotoUrl;
    if (url) map[ctx.contactId] = url;
  }
  return map;
}

export default function ConversationsClient({ connections: initialConnections }: { connections: Connection[] }) {
  const t = useTranslations('conversations');
  const params = useParams();
  const locale = params.locale as string;

  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(initialConnections[0] || null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(initialConnections[0]?.conversations[0] || null);
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isLive, setIsLive] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const photoMap = useMemo(() => buildPhotoMap(selectedConnection), [selectedConnection]);

  const totalConvs = connections.reduce((acc, c) => acc + c.conversations.length, 0);

  const filteredConvs = (selectedConnection?.conversations || []).filter((c) => {
    const name = c.contactName || c.contactId;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const loadMessages = useCallback(async (convId: string, connectionId: string, contactId: string) => {
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
  }, []);

  useEffect(() => {
    if (selectedConv && selectedConnection) {
      loadMessages(selectedConv.id, selectedConnection.id, selectedConv.contactId);
    }
  }, [selectedConv?.id]);

  // ── Auto-refresh messages every 4s ────────────────────────────────────────
  useEffect(() => {
    if (!selectedConv || !selectedConnection) return;
    const interval = setInterval(() => {
      fetch(`/api/conversations/${selectedConv.id}/messages`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setMessages(data); })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedConv?.id, selectedConnection?.id]);

  // ── Auto-refresh conversation list every 8s ────────────────────────────────
  useEffect(() => {
    if (!selectedConnection) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations?connectionId=${selectedConnection.id}`);
        if (!res.ok) { setIsLive(false); return; }
        const freshConvs: Conversation[] = await res.json();
        setIsLive(true);
        setConnections(prev => prev.map(c =>
          c.id === selectedConnection.id ? { ...c, conversations: freshConvs } : c
        ));
        setSelectedConnection(prev => prev?.id === selectedConnection.id
          ? { ...prev, conversations: freshConvs } : prev
        );
      } catch {
        setIsLive(false);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedConnection?.id]);

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
        setConnections(prev => prev.map(c => c.id === selectedConnection.id ? updated as Connection : c));
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
        showToast(err.error || "Erreur lors de l'envoi", false);
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
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-mono text-sm font-semibold shadow-xl border transition-all ${toast.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[
            { label: 'Bots', value: connections.length, color: ORANGE },
            { label: 'Conversations', value: totalConvs, color: '#fff' },
            { label: "Aujourd'hui", value: connections.flatMap(c => c.conversations).filter(c => new Date(c.lastMessage).toDateString() === new Date().toDateString()).length, color: '#10B981' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center min-w-[64px]">
              <p className="font-mono text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="font-mono text-[9px] text-white/30 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Live indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] ml-auto ${isLive ? 'border-green-500/20 bg-green-500/5 text-green-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
          {isLive
            ? <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live</>
            : <><WifiOff className="w-3 h-3" />Hors ligne</>}
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
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{conn.conversations.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main panel */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-3">
        {/* Bot selector — desktop */}
        <div className="hidden lg:flex flex-col lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" style={{ maxHeight: '72vh' }}>
          <div className="p-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <p className="font-mono text-[9px] font-semibold text-white/30 uppercase tracking-wider">{t('bots')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {connections.map((conn) => {
              const isActive = selectedConnection?.id === conn.id;
              return (
                <button key={conn.id}
                  onClick={() => { setSelectedConnection(conn); setSelectedConv(conn.conversations[0] || null); setMessages([]); }}
                  className={`w-full flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all ${isActive ? '' : 'hover:bg-white/[0.04]'}`}
                  style={isActive ? { background: `${ORANGE}18` } : {}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold"
                    style={{ background: isActive ? `${ORANGE}35` : 'rgba(255,255,255,0.06)', color: isActive ? ORANGE : 'rgba(255,255,255,0.4)' }}>
                    {conn.platform === 'TELEGRAM' ? 'TG' : 'WA'}
                  </div>
                  <p className="font-mono text-[9px] font-semibold truncate w-full"
                    style={{ color: isActive ? ORANGE : 'rgba(255,255,255,0.4)' }}>{conn.name}</p>
                  <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full"
                    style={{ background: isActive ? `${ORANGE}20` : 'rgba(255,255,255,0.06)', color: isActive ? ORANGE : 'rgba(255,255,255,0.3)' }}>
                    {conn.conversations.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation list */}
        <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden lg:col-span-3 ${mobileView === 'thread' ? 'hidden lg:flex' : 'flex'}`}
          style={{ maxHeight: mobileView === 'list' ? '65vh' : undefined, minHeight: '50vh' }}>
          <div className="p-2.5 border-b border-white/[0.06] space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')}
                className="w-full pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 transition-colors" />
            </div>
            <button onClick={() => { setBulkMode(!bulkMode); setSelectedConvIds(new Set()); }}
              className="w-full flex items-center justify-center gap-1.5 py-1 rounded-lg font-mono text-[10px] transition-all"
              style={bulkMode ? { background: '#EF444415', color: '#EF4444' } : { color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Trash2 className="w-3 h-3" />
              {bulkMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
            {filteredConvs.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="font-mono text-xs text-white/20">{t('noConversation')}</p>
              </div>
            ) : filteredConvs.map((conv) => {
              const state = getConvState(conv);
              const preview = conv.lastMessagePreview ?? (conv.messages[0] ? `${conv.messages[0].direction === 'outbound' ? '🤖 ' : '👤 '}${conv.messages[0].content}` : null);
              const isSelected = selectedConvIds.has(conv.id);
              const isOpen = selectedConv?.id === conv.id;
              return (
                <div key={conv.id}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all ${isOpen ? '' : 'hover:bg-white/[0.02]'} ${state.isSuspended ? 'opacity-40' : ''}`}
                  style={isOpen ? { background: `${ORANGE}08` } : {}}>
                  {bulkMode && (
                    <input type="checkbox" checked={isSelected} onChange={() => { const s = new Set(selectedConvIds); isSelected ? s.delete(conv.id) : s.add(conv.id); setSelectedConvIds(s); }}
                      className="mt-2.5 flex-shrink-0 accent-orange-500" />
                  )}
                  <button className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
                    onClick={() => { setSelectedConv(conv); setMobileView('thread'); loadMessages(conv.id, selectedConnection!.id, conv.contactId); }}>
                    <div className="relative flex-shrink-0 mt-0.5">
                      <ContactAvatar
                        name={formatContactDisplay(conv.contactName, conv.contactId)}
                        photoUrl={selectedConnection?.platform === 'TELEGRAM' ? photoMap[conv.contactId] : undefined}
                        style={isOpen ? { background: `${ORANGE}30`, color: ORANGE } : undefined}
                      />
                      {state.needsHelp && (
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center border border-black">
                          <AlertTriangle className="w-1.5 h-1.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-mono text-xs font-semibold truncate" style={{ color: isOpen ? ORANGE : 'rgba(255,255,255,0.85)' }}>
                          {formatContactDisplay(conv.contactName, conv.contactId)}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          {state.isSuspended && <PauseCircle className="w-3 h-3 text-yellow-400" />}
                          <span className="font-mono text-[9px] text-white/25">{formatRelative(new Date(conv.lastMessage))}</span>
                        </div>
                      </div>
                      {state.needsHelp && <p className="font-mono text-[9px] text-red-400 mb-0.5">⚠️ {t('needsHelp')}</p>}
                      <p className="font-mono text-[10px] text-white/35 truncate">{preview ?? '...'}</p>
                    </div>
                  </button>
                  {!bulkMode && (
                    <button onClick={() => { if (confirm('Supprimer ?')) handleDeleteConv(conv.id); }} disabled={deletingId === conv.id}
                      className="p-1 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0 mt-1.5 opacity-0 group-hover:opacity-100"
                      style={{ opacity: 0.3 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.3'}>
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
              <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2.5" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <button onClick={() => setMobileView('list')} className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <ContactAvatar
                  name={formatContactDisplay(selectedConv.contactName, selectedConv.contactId)}
                  photoUrl={selectedConnection?.platform === 'TELEGRAM' ? (contactCtx?.metadata?.profilePhotoUrl ?? photoMap[selectedConv.contactId]) : undefined}
                  size="lg"
                  style={{ background: `${ORANGE}25`, color: ORANGE }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-white truncate">
                    {formatContactDisplay(selectedConv.contactName, selectedConv.contactId)}
                  </p>
                  <p className="font-mono text-[9px] text-white/30">
                    {contactCtx?.metadata?.telegramUsername ? `@${contactCtx.metadata.telegramUsername} · ` : ''}
                    {selectedConnection?.platform === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}
                    {contactCtx?.wilaya ? ` · ${contactCtx.wilaya}` : ''}
                    {' · '}
                    <span className="text-green-400/70">● live</span>
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
                  <button
                    onClick={() => selectedConv && selectedConnection && loadMessages(selectedConv.id, selectedConnection.id, selectedConv.contactId)}
                    className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/[0.06] transition-all"
                    title="Rafraîchir les messages">
                    <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
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
                  const isLastInGroup = idx === arr.length - 1 || arr[idx + 1].direction !== msg.direction;
                  const contactPhotoUrl = selectedConnection?.platform === 'TELEGRAM'
                    ? (contactCtx?.metadata?.profilePhotoUrl ?? photoMap[selectedConv!.contactId])
                    : undefined;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isInbound ? 'justify-start' : 'justify-end'} ${isFirstInGroup ? 'mt-3' : ''}`}>
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
                      <div
                        className={`max-w-[72%] px-3.5 py-2.5 text-sm ${
                          isInbound
                            ? `bg-white/[0.07] text-white/90 ${isFirstInGroup ? 'rounded-2xl rounded-tl-sm' : isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-xl rounded-l-sm'}`
                            : `${isFirstInGroup ? 'rounded-2xl rounded-tr-sm' : isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-xl rounded-r-sm'}`
                        }`}
                        style={!isInbound ? { background: `linear-gradient(135deg, ${ORANGE}CC, ${ORANGE}99)` } : {}}
                      >
                        {msg.type === 'voice' && <p className="font-mono text-[9px] text-white/40 mb-1">🎤 {t('voiceTranscribed')}</p>}
                        {msg.type === 'image' && <p className="font-mono text-[9px] text-white/40 mb-1">🖼️ {t('image')}</p>}
                        {msg.type === 'manual' && <p className="font-mono text-[9px] mb-1 text-white/60">✏️ Vous</p>}
                        <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap" style={{ color: isInbound ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.95)' }}>
                          {msg.content}
                        </p>
                        {isLastInGroup && (
                          <p className={`font-mono text-[9px] mt-1 ${isInbound ? 'text-white/20' : 'text-white/40'} text-right`}>
                            {new Date(msg.createdAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                            {msg.tokensUsed > 0 && ` · ${msg.tokensUsed}t`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-2.5 border-t border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    placeholder="Répondre au client..."
                    rows={1}
                    className="flex-1 px-3.5 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.07] resize-none transition-all"
                    style={{ minHeight: '38px', maxHeight: '100px' }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all disabled:opacity-30 hover:opacity-90 active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${ORANGE}, #ff8c42)` }}
                  >
                    {sending
                      ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4 text-white" />}
                  </button>
                </div>
                <p className="font-mono text-[9px] text-white/15 mt-1 px-1">Entrée pour envoyer · Shift+Entrée pour saut de ligne</p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${ORANGE}15` }}>
                  <MessageSquare className="w-7 h-7" style={{ color: ORANGE }} />
                </div>
                <p className="font-mono text-sm text-white/30">{t('selectConversation')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
