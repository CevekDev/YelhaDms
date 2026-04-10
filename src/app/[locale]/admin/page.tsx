import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  Users, MessageSquare, Coins, Tag, Activity,
  TrendingUp, ShoppingCart, AlertCircle,
} from 'lucide-react';
import AdminUsersTable from '@/components/admin/users-table';
import AdminTokensPanel from '@/components/admin/tokens-panel';
import AdminMessagesPanel from '@/components/admin/messages-panel';
import AdminPromoPanel from '@/components/admin/promo-panel';
import AdminSettingsForm from '@/components/admin/settings-form';

const ORANGE = '#FF6B2C';

const STAT_ACCENTS = ['#60a5fa', '#34d399', ORANGE, '#a78bfa', '#f472b6', '#fbbf24'];

export default async function AdminPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const [
    totalUsers,
    totalMessages,
    tokenStats,
    systemPrompt,
    allUsers,
    promoCodes,
    recentTransactions,
    todayMessages,
    totalRevenueDZD,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.message.count(),
    prisma.tokenTransaction.aggregate({ where: { type: 'PURCHASE' }, _sum: { amount: true } }),
    prisma.systemSetting.findUnique({ where: { key: 'global_system_prompt' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, tokenBalance: true,
        role: true, unlimitedTokens: true, createdAt: true,
        twoFactorEnabled: true, emailVerified: true,
        _count: { select: { connections: true } },
      },
    }),
    prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { uses: true } } },
    }),
    prisma.tokenTransaction.findMany({
      where: { type: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.message.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.tokenPackage.findMany({ where: { isActive: true } }),
  ]);

  const activePromos = promoCodes.filter(p => p.isActive).length;

  const stats = [
    { label: 'Utilisateurs', value: totalUsers.toLocaleString(), icon: Users, sub: 'inscrits', accent: STAT_ACCENTS[0] },
    { label: 'Messages', value: totalMessages.toLocaleString(), icon: MessageSquare, sub: `dont ${todayMessages} aujourd'hui`, accent: STAT_ACCENTS[1] },
    { label: 'Tokens vendus', value: (tokenStats._sum.amount || 0).toLocaleString(), icon: Coins, sub: 'via achats', accent: STAT_ACCENTS[2] },
    { label: 'Codes promo actifs', value: activePromos.toLocaleString(), icon: Tag, sub: `${promoCodes.length} total`, accent: STAT_ACCENTS[3] },
    { label: 'Achats récents', value: recentTransactions.length.toLocaleString(), icon: ShoppingCart, sub: '10 derniers', accent: STAT_ACCENTS[4] },
    { label: 'Connexions actives', value: allUsers.reduce((a, u) => a + u._count.connections, 0).toLocaleString(), icon: Activity, sub: 'bots configurés', accent: STAT_ACCENTS[5] },
  ];

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white">
            Panel <span style={{ color: ORANGE }}>Admin</span>
          </h1>
          <p className="text-white/40 text-sm mt-1 font-mono">Yelha — Vue d&apos;ensemble complète de la plateforme</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <AlertCircle className="w-3.5 h-3.5" style={{ color: ORANGE }} />
          <span className="text-xs font-mono text-white/50">Accès restreint — Administrateur</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex flex-col gap-2 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider leading-tight">{stat.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${stat.accent}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: stat.accent }} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white">{stat.value}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
              <TrendingUp className="w-4 h-4" style={{ color: ORANGE }} />
            </div>
            <h2 className="font-mono font-semibold text-white text-sm">Achats récents</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-mono text-white/80">{tx.user?.name || tx.user?.email || 'Inconnu'}</p>
                  <p className="text-xs text-white/30 font-mono">{tx.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold" style={{ color: ORANGE }}>
                    +{tx.amount.toLocaleString()} tokens
                  </p>
                  <p className="text-[10px] text-white/25 font-mono">
                    {new Date(tx.createdAt).toLocaleDateString('fr-DZ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users table */}
      <AdminUsersTable users={allUsers} />

      {/* Tokens management */}
      <AdminTokensPanel users={allUsers} />

      {/* Send messages */}
      <AdminMessagesPanel users={allUsers} />

      {/* Promo codes */}
      <AdminPromoPanel initialCodes={promoCodes} />

      {/* System prompt */}
      <AdminSettingsForm initialPrompt={systemPrompt?.value || ''} />
    </div>
  );
}
