'use client';

import { useState } from 'react';
import { MessageSquare, Bot, Search, User, Send, Plug } from 'lucide-react';
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

export default function ConversationsClient({ connections }: { connections: Connection[] }) {
  const params = useParams();
  const locale = params.locale as string;
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(
    connections[0] || null
  );
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(
    connections[0]?.conversations[0] || null
  );
  const [search, setSearch] = useState('');

  const filteredConvs = (selectedConnection?.conversations || []).filter((c) => {
    const name = c.contactName || c.contactId;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const totalConvs = connections.reduce((acc, c) => acc + c.conversations.length, 0);

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
          Connectez votre premier bot pour voir les conversations ici
        </p>
        <Link
          href={`/${locale}/dashboard/connections`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: ORANGE }}
        >
          <Plug className="w-4 h-4" />
          Connecter un bot
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Bots actifs', value: connections.length },
          { label: 'Conversations', value: totalConvs },
          {
            label: 'Aujourd\'hui',
            value: connections
              .flatMap((c) => c.conversations)
              .filter(
                (c) =>
                  new Date(c.lastMessage).toDateString() === new Date().toDateString()
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
        <div className="col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.06]">
            <p className="font-mono text-xs font-semibold text-white/30 uppercase tracking-wider">Bots</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {connections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => {
                  setSelectedConnection(conn);
                  setSelectedConv(conn.conversations[0] || null);
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                  selectedConnection?.id === conn.id
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
                style={
                  selectedConnection?.id === conn.id
                    ? { background: `${ORANGE}15`, color: ORANGE }
                    : {}
                }
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold"
                  style={{
                    background: selectedConnection?.id === conn.id ? `${ORANGE}30` : 'rgba(255,255,255,0.06)',
                    color: selectedConnection?.id === conn.id ? ORANGE : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {conn.platform === 'TELEGRAM' ? 'TG' : 'WA'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-semibold truncate">{conn.name}</p>
                  <p className="font-mono text-[10px] text-white/30 truncate">
                    {conn.conversations.length} conv.
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="col-span-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="font-mono text-xs text-white/20">Aucune conversation</p>
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const lastMsg = conv.messages[0];
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/[0.04] transition-all ${
                      selectedConv?.id === conv.id
                        ? 'bg-white/[0.05]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-mono font-bold"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                    >
                      {(conv.contactName || conv.contactId)[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-mono text-xs font-semibold text-white truncate">
                          {conv.contactName || conv.contactId}
                        </p>
                        <span className="font-mono text-[10px] text-white/20 ml-2 flex-shrink-0">
                          {formatRelative(new Date(conv.lastMessage))}
                        </span>
                      </div>
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
                <div>
                  <p className="font-mono text-sm font-semibold text-white">
                    {selectedConv.contactName || selectedConv.contactId}
                  </p>
                  <p className="font-mono text-xs text-white/30">
                    {selectedConnection?.platform === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
                <ConversationMessages convId={selectedConv.id} />
              </div>

              {/* Read-only notice */}
              <div className="p-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-4 py-2.5">
                  <Send className="w-4 h-4 text-white/10" />
                  <span className="font-mono text-xs text-white/20">
                    Vue lecture seule — répondez directement via Telegram
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="font-mono text-sm text-white/20">Sélectionnez une conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationMessages({ convId }: { convId: string }) {
  // In a real implementation this would fetch messages via API or use a server component
  // For now we show a placeholder since messages are loaded server-side in the parent
  return (
    <div className="text-center py-8">
      <p className="font-mono text-xs text-white/20">
        Chargement des messages...
      </p>
    </div>
  );
}
