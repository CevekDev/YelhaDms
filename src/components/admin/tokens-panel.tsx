'use client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Coins, Loader2, Search } from 'lucide-react';

const ORANGE = '#FF6B2C';

interface User {
  id: string;
  name: string | null;
  email: string;
  tokenBalance: number;
  role: string;
  unlimitedTokens: boolean;
}

export default function AdminTokensPanel({ users }: { users: User[] }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const selected = users.find(u => u.id === selectedUserId);

  const handleGrant = async () => {
    if (!selectedUserId || !amount) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/add-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, amount: Number(amount), description }),
      });
      const json = await res.json();
      if (res.ok) {
        toast({ title: `✅ ${amount} tokens ajoutés à ${selected?.name || selected?.email}. Nouveau solde : ${json.newBalance}` });
        setAmount('');
        setDescription('');
      } else {
        toast({ title: 'Erreur', description: json.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
          <Coins className="w-4 h-4" style={{ color: ORANGE }} />
        </div>
        <h2 className="font-mono font-semibold text-white text-sm">Gestion des tokens utilisateurs</h2>
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

        {/* Grant form */}
        {selectedUserId && (
          <div
            className="rounded-xl p-4 space-y-3 border"
            style={{ background: `${ORANGE}08`, borderColor: `${ORANGE}25` }}
          >
            <p className="text-sm font-mono font-medium" style={{ color: ORANGE }}>
              {selected?.name || selected?.email}
              <span className="text-white/30 font-normal ml-2">
                — Solde actuel : {selected?.unlimitedTokens ? '∞' : selected?.tokenBalance} tokens
              </span>
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Nb de tokens"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={1}
                className="w-36 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
              />
              <input
                placeholder="Description (optionnel)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
              />
            </div>
            <button
              onClick={handleGrant}
              disabled={loading || !amount || Number(amount) <= 0}
              className="flex items-center gap-2 font-mono text-sm text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: ORANGE }}
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Coins className="w-4 h-4" />}
              Ajouter {amount ? `${Number(amount).toLocaleString()}` : ''} tokens
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
