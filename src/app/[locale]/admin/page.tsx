import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  Users, MessageSquare, Coins, TrendingUp, ShoppingCart, Zap, Tag,
} from 'lucide-react';
import AdminUsersTable from '@/components/admin/users-table';
import AdminTokensPanel from '@/components/admin/tokens-panel';
import AdminMessagesPanel from '@/components/admin/messages-panel';
import AdminPromoPanel from '@/components/admin/promo-panel';
import AdminSettingsForm from '@/components/admin/settings-form';

const ORANGE = '#FF6B2C';

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function dayLabel(d: Date) {
  return d.toLocaleDateString('fr-DZ', { weekday: 'short' });
}

export default async function AdminPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    newUsersToday,
    todayMessages,
    allUsers,
    promoCodes,
    systemPrompt,
    packages,
    purchasesWeek,
    usageWeek,
    recentPurchases,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
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
    prisma.systemSetting.findUnique({ where: { key: 'global_system_prompt' } }),
    prisma.tokenPackage.findMany({ where: { isActive: true } }),
    prisma.tokenTransaction.findMany({
      where: { type: 'PURCHASE', createdAt: { gte: weekStart } },
      select: { amount: true, createdAt: true, pricePaid: true },
    }),
    prisma.tokenTransaction.findMany({
      where: { type: 'USAGE', createdAt: { gte: weekStart } },
      select: { amount: true, createdAt: true },
    }),
    prisma.tokenTransaction.findMany({
      where: { type: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  // Estimate revenue: use pricePaid if available, else find matching package price
  const estimateRevenue = (tokens: number, pricePaid: number | null): number => {
    if (pricePaid && pricePaid > 0) return pricePaid;
    const pkg = packages.find((p) => p.tokens === tokens);
    return pkg ? pkg.price : 0;
  };

  const last7 = getLast7Days();

  // Revenue per day
  const revenueByDay = last7.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const txs = purchasesWeek.filter(
      (t) => new Date(t.createdAt) >= day && new Date(t.createdAt) < next
    );
    return {
      label: dayLabel(day),
      revenue: txs.reduce((s, t) => s + estimateRevenue(t.amount, t.pricePaid ?? null), 0),
      count: txs.length,
    };
  });

  // Tokens consumed per day
  const tokensByDay = last7.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const txs = usageWeek.filter(
      (t) => new Date(t.createdAt) >= day && new Date(t.createdAt) < next
    );
    return {
      label: dayLabel(day),
      tokens: txs.reduce((s, t) => s + Math.abs(t.amount), 0),
    };
  });

  const revenueToday = purchasesWeek
    .filter((t) => new Date(t.createdAt) >= todayStart)
    .reduce((s, t) => s + estimateRevenue(t.amount, t.pricePaid ?? null), 0);

  const revenueWeek = purchasesWeek.reduce(
    (s, t) => s + estimateRevenue(t.amount, t.pricePaid ?? null),
    0
  );

  const tokensConsumedToday = usageWeek
    .filter((t) => new Date(t.createdAt) >= todayStart)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const tokensConsumedWeek = usageWeek.reduce((s, t) => s + Math.abs(t.amount), 0);

  const maxRevenue = Math.max(...revenueByDay.map((d) => d.revenue), 1);
  const maxTokens = Math.max(...tokensByDay.map((d) => d.tokens), 1);

  const statCards = [
    {
      label: 'Utilisateurs total',
      value: totalUsers.toLocaleString(),
      sub: `+${newUsersToday} aujourd'hui`,
      icon: Users,
      color: '#60a5fa',
    },
    {
      label: 'Messages aujourd\'hui',
      value: todayMessages.toLocaleString(),
      sub: 'traités par les bots',
      icon: MessageSquare,
      color: '#34d399',
    },
    {
      label: 'Tokens consommés / sem.',
      value: tokensConsumedWeek.toLocaleString(),
      sub: `${tokensConsumedToday.toLocaleString()} auj.`,
      icon: Zap,
      color: ORANGE,
    },
    {
      label: 'Revenu aujourd\'hui',
      value: `${revenueToday.toLocaleString('fr-DZ')} DA`,
      sub: 'achats du jour',
      icon: ShoppingCart,
      color: '#f472b6',
    },
    {
      label: 'Revenu cette semaine',
      value: `${revenueWeek.toLocaleString('fr-DZ')} DA`,
      sub: '7 derniers jours',
      icon: TrendingUp,
      color: '#a78bfa',
    },
    {
      label: 'Codes promo actifs',
      value: promoCodes.filter((p) => p.isActive).length.toLocaleString(),
      sub: `${promoCodes.length} total`,
      icon: Tag,
      color: '#fbbf24',
    },
  ];

  const SECTION = 'rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden';
  const HEADER = 'flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]';
  const ICON_WRAP = (color: string) =>
    `w-7 h-7 rounded-lg flex items-center justify-center` as const;

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">
          Vue d&apos;ensemble <span style={{ color: ORANGE }}>Admin</span>
        </h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Yelha — Tableau de bord administrateur
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 lg:p-5 hover:bg-white/[0.04] transition-colors"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${card.color}18` }}
              >
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <p className="text-xl lg:text-2xl font-bold font-mono text-white">{card.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5 font-mono">{card.label}</p>
              <p className="text-[10px] text-white/20 mt-0.5">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Revenue chart — 7 days */}
      <div className={SECTION}>
        <div className={HEADER}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${ORANGE}20` }}
          >
            <TrendingUp className="w-4 h-4" style={{ color: ORANGE }} />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">
            Revenus — 7 derniers jours
          </h2>
          <span className="ml-auto text-xs font-mono text-white/30">en DZD</span>
        </div>
        <div className="p-5 lg:p-6">
          <div className="flex items-end gap-2 lg:gap-3 h-36">
            {revenueByDay.map((day) => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-[9px] font-mono text-white/30 truncate">
                  {day.revenue > 0 ? `${(day.revenue / 1000).toFixed(1)}k` : ''}
                </span>
                <div
                  className="w-full rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${Math.max((day.revenue / maxRevenue) * 108, day.revenue > 0 ? 10 : 3)}px`,
                    background:
                      day.revenue > 0
                        ? `linear-gradient(180deg, ${ORANGE}, ${ORANGE}70)`
                        : 'rgba(255,255,255,0.04)',
                    minHeight: '3px',
                  }}
                />
                <span className="text-[10px] font-mono text-white/30 capitalize">{day.label}</span>
              </div>
            ))}
          </div>
          {revenueWeek === 0 && (
            <p className="text-center text-white/20 font-mono text-xs mt-3">
              Aucun achat cette semaine
            </p>
          )}
          <div className="flex justify-between mt-4 pt-4 border-t border-white/[0.04]">
            <div>
              <p className="text-xs text-white/30 font-mono">Aujourd'hui</p>
              <p className="text-base font-bold font-mono" style={{ color: ORANGE }}>
                {revenueToday.toLocaleString('fr-DZ')} DA
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/30 font-mono">Cette semaine</p>
              <p className="text-base font-bold font-mono text-white">
                {revenueWeek.toLocaleString('fr-DZ')} DA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tokens consumed chart — 7 days */}
      <div className={SECTION}>
        <div className={HEADER}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.15)' }}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">
            Tokens consommés — 7 derniers jours
          </h2>
        </div>
        <div className="p-5 lg:p-6">
          <div className="flex items-end gap-2 lg:gap-3 h-36">
            {tokensByDay.map((day) => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-[9px] font-mono text-white/30 truncate">
                  {day.tokens > 0 ? day.tokens.toLocaleString() : ''}
                </span>
                <div
                  className="w-full rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${Math.max((day.tokens / maxTokens) * 108, day.tokens > 0 ? 10 : 3)}px`,
                    background:
                      day.tokens > 0
                        ? 'linear-gradient(180deg, #34d399, #059669)'
                        : 'rgba(255,255,255,0.04)',
                    minHeight: '3px',
                  }}
                />
                <span className="text-[10px] font-mono text-white/30 capitalize">{day.label}</span>
              </div>
            ))}
          </div>
          {tokensConsumedWeek === 0 && (
            <p className="text-center text-white/20 font-mono text-xs mt-3">
              Aucune consommation cette semaine
            </p>
          )}
          <div className="flex justify-between mt-4 pt-4 border-t border-white/[0.04]">
            <div>
              <p className="text-xs text-white/30 font-mono">Aujourd'hui</p>
              <p className="text-base font-bold font-mono text-emerald-400">
                {tokensConsumedToday.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/30 font-mono">Cette semaine</p>
              <p className="text-base font-bold font-mono text-white">
                {tokensConsumedWeek.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent purchases */}
      <div className={SECTION}>
        <div className={HEADER}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(167,139,250,0.15)' }}
          >
            <ShoppingCart className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Derniers achats</h2>
        </div>
        {recentPurchases.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/20 font-mono text-sm">Aucun achat pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentPurchases.map((tx) => {
              const rev = estimateRevenue(tx.amount, (tx as any).pricePaid ?? null);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <p className="text-sm font-mono text-white/80">
                      {tx.user?.name || tx.user?.email || 'Inconnu'}
                    </p>
                    <p className="text-xs text-white/30 font-mono">{tx.user?.email}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-0.5">
                    <p className="text-sm font-mono font-bold" style={{ color: ORANGE }}>
                      +{tx.amount.toLocaleString()} tokens
                    </p>
                    {rev > 0 && (
                      <p className="text-xs font-mono text-emerald-400">
                        {rev.toLocaleString('fr-DZ')} DA
                      </p>
                    )}
                    <p className="text-[10px] text-white/25 font-mono">
                      {new Date(tx.createdAt).toLocaleDateString('fr-DZ', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
