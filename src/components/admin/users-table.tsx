'use client';
import { useState } from 'react';
import { Users, Search, CheckCircle, XCircle, Shield, User, Infinity } from 'lucide-react';

const ORANGE = '#FF6B2C';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  tokenBalance: number;
  role: string;
  unlimitedTokens: boolean;
  createdAt: Date | string;
  twoFactorEnabled: boolean;
  emailVerified: Date | string | null;
  _count: { connections: number };
}

export default function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN'>('ALL');

  const filtered = users.filter(u => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#60a5fa20' }}>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Utilisateurs ({users.length})</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Role filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {(['ALL', 'USER', 'ADMIN'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className="px-2.5 py-1 rounded-md font-mono text-xs transition-all"
                style={roleFilter === r
                  ? { background: ORANGE + '25', color: ORANGE }
                  : { color: 'rgba(255,255,255,0.3)' }}
              >
                {r}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-mono text-white bg-white/[0.04] border border-white/[0.07] rounded-lg focus:outline-none focus:border-[#FF6B2C]/40 placeholder:text-white/20 w-44"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {['Utilisateur', 'Tokens', 'Connexions', '2FA', 'Email vérifié', 'Rôle', 'Inscrit le'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-white/30 font-normal uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white/80 font-medium">{u.name || '—'}</p>
                    <p className="text-white/30 text-[10px]">{u.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold" style={{ color: ORANGE }}>
                    {u.unlimitedTokens ? '∞' : u.tokenBalance.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/50">{u._count.connections}</td>
                <td className="px-4 py-3">
                  {u.twoFactorEnabled
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    : <XCircle className="w-3.5 h-3.5 text-white/20" />}
                </td>
                <td className="px-4 py-3">
                  {u.emailVerified
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400/60" />}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                    style={u.role === 'ADMIN'
                      ? { background: `${ORANGE}20`, color: ORANGE }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    {u.role === 'ADMIN' ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/30">
                  {new Date(u.createdAt).toLocaleDateString('fr-DZ')}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/20">
                  Aucun utilisateur trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
