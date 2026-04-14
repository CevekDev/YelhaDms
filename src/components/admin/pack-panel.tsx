'use client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Gift, Loader2, Search } from 'lucide-react';

const ORANGE = '#FF6B2C';

const PACKS = [
  { key: 'STARTER',  label: 'Starter',  tokens: 500,   price: 2500  },
  { key: 'BUSINESS', label: 'Business', tokens: 2000,  price: 5000  },
  { key: 'PRO',      label: 'Pro',      tokens: 5000,  price: 10000 },
  { key: 'AGENCY',   label: 'Agency',   tokens: 15000, price: 22000 },
] as const;

type PackKey = (typeof PACKS)[number]['key'];

interface User {
  id: string;
  name: string | null;
  email: string;
  tokenBalance: number;
  role: string;
  unlimitedTokens: boolean;
}

export default function PackPanel({ users }: { users: User[] }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPack, setSelectedPack] = useState<PackKey>('STARTER');
  const [mode, setMode] = useState<'offer' | 'activate'>('offer');
  const [loading, setLoading] = useState(false);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId);
  const pack = PACKS.find(p => p.key === selectedPack)!;

  const handleActivate = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/activate-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, pack: selectedPack, mode }),
      });
      const json = await res.json();
      if (res.ok) {
        const modeLabel = mode === 'offer' ? 'offert' : 'activé';
        toast({
          title: `✅ Pack ${pack.label} ${modeLabel} à ${selectedUser?.name || selectedUser?.email}`,
          description: `+${pack.tokens.toLocaleString()} tokens · Nouveau solde : ${json.newBalance.toLocaleString()} tokens`,
        });
      } else {
        toast({ title: 'Erreur', description: json.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
          <Gift className="w-4 h-4" style={{ color: ORANGE }} />
        </div>
        <h2 className="font-mono font-semibold text-white text-sm">Activer un pack utilisateur</h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
          />
        </div>

        {/* User list */}
        <div className="max-h-52 overflow-y-auto rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
          {filtered.slice(0, 20).map(user => (
            <div
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
              style={{
                background: selectedUserId === user.id ? `${ORANGE}10` : 'transparent',
                borderLeft: selectedUserId === user.id ? `2px solid ${ORANGE}` : '2px solid transparent',
              }}
              onMouseEnter={e => { if (selectedUserId !== user.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (selectedUserId !== user.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div>
                <p className="text-sm font-medium text-white/80">{user.name || 'Sans nom'}</p>
                <p className="text-xs text-white/30">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-white">
                  {user.unlimitedTokens ? '∞' : user.tokenBalance.toLocaleString()}
                  <span className="text-xs text-white/30 ml-1">tokens</span>
                </p>
                <p className="text-xs text-white/20">{user.role}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-white/30 text-sm py-6 font-mono">Aucun utilisateur trouvé</p>
          )}
        </div>

        {/* Config form */}
        {selectedUserId && (
          <div
            className="rounded-xl p-4 space-y-4 border"
            style={{ background: `${ORANGE}08`, borderColor: `${ORANGE}25` }}
          >
            {/* Selected user label */}
            <p className="text-sm font-mono font-medium" style={{ color: ORANGE }}>
              {selectedUser?.name || selectedUser?.email}
              <span className="text-white/30 font-normal ml-2">
                — Solde actuel : {selectedUser?.unlimitedTokens ? '∞' : selectedUser?.tokenBalance.toLocaleString()} tokens
              </span>
            </p>

            {/* Pack selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PACKS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setSelectedPack(p.key)}
                  className="rounded-xl px-3 py-2.5 text-left transition-all border"
                  style={{
                    background: selectedPack === p.key ? `${ORANGE}20` : 'rgba(255,255,255,0.04)',
                    borderColor: selectedPack === p.key ? ORANGE : 'rgba(255,255,255,0.07)',
                  }}
                >
                  <p className="text-xs font-mono font-semibold text-white">{p.label}</p>
                  <p className="text-xs font-mono text-white/50 mt-0.5">{p.tokens.toLocaleString()} tk</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: selectedPack === p.key ? ORANGE : 'rgba(255,255,255,0.3)' }}>
                    {p.price.toLocaleString()} DA
                  </p>
                </button>
              ))}
            </div>

            {/* Mode selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('offer')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-mono text-sm transition-all border"
                style={{
                  background: mode === 'offer' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                  borderColor: mode === 'offer' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)',
                  color: mode === 'offer' ? '#f87171' : 'rgba(255,255,255,0.4)',
                }}
              >
                <span>🎁</span>
                <span>Offrir</span>
                {mode === 'offer' && (
                  <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                    Dépense
                  </span>
                )}
              </button>
              <button
                onClick={() => setMode('activate')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-mono text-sm transition-all border"
                style={{
                  background: mode === 'activate' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  borderColor: mode === 'activate' ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)',
                  color: mode === 'activate' ? '#4ade80' : 'rgba(255,255,255,0.4)',
                }}
              >
                <span>✅</span>
                <span>Activer — achat réel</span>
                {mode === 'activate' && (
                  <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>
                    Revenu
                  </span>
                )}
              </button>
            </div>

            {/* Summary line */}
            <p className="text-xs font-mono text-white/30">
              {mode === 'offer'
                ? `🎁 Offrir ${pack.tokens.toLocaleString()} tokens (Pack ${pack.label}) — aucun revenu comptabilisé`
                : `✅ Activer Pack ${pack.label} — ${pack.price.toLocaleString()} DA comptabilisé comme revenu`}
            </p>

            {/* Submit */}
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex items-center gap-2 font-mono text-sm text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: ORANGE }}
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Gift className="w-4 h-4" />}
              {mode === 'offer' ? `Offrir Pack ${pack.label}` : `Activer Pack ${pack.label} — ${pack.price.toLocaleString()} DA`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
