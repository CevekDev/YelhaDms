import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Users, MessageSquare, Coins, Tag } from 'lucide-react';
import AdminSettingsForm from '@/components/admin/settings-form';
import AdminTokensPanel from '@/components/admin/tokens-panel';
import AdminMessagesPanel from '@/components/admin/messages-panel';
import AdminPromoPanel from '@/components/admin/promo-panel';

const ORANGE = '#FF6B2C';

const STAT_ACCENTS = [
  '#60a5fa', // blue
  '#34d399', // green
  ORANGE,    // orange
  '#a78bfa', // purple
];

export default async function AdminPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const [totalUsers, totalMessages, tokenStats, systemPrompt, allUsers, promoCodes] = await Promise.all([
    prisma.user.count(),
    prisma.message.count(),
    prisma.tokenTransaction.aggregate({
      where: { type: 'PURCHASE' },
      _sum: { amount: true },
    }),
    prisma.systemSetting.findUnique({ where: { key: 'global_system_prompt' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, tokenBalance: true, role: true, unlimitedTokens: true, createdAt: true },
    }),
    prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { uses: true } } },
    }),
  ]);

  const stats = [
    { label: 'Utilisateurs', value: totalUsers.toLocaleString(), icon: Users, sub: 'inscrits' },
    { label: 'Messages traités', value: totalMessages.toLocaleString(), icon: MessageSquare, sub: 'au total' },
    { label: 'Tokens vendus', value: (tokenStats._sum.amount || 0).toLocaleString(), icon: Coins, sub: 'via achats' },
    { label: 'Codes promo actifs', value: promoCodes.filter(p => p.isActive).length.toLocaleString(), icon: Tag, sub: 'disponibles' },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">
          Panel <span style={{ color: ORANGE }}>Admin</span>
        </h1>
        <p className="text-white/40 text-sm mt-1">Vue d&apos;ensemble et gestion de la plateforme Yelha</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const accent = STAT_ACCENTS[i];
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex flex-col gap-3 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-white/40 uppercase tracking-wider">{stat.label}</span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${accent}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold font-mono text-white">{stat.value}</p>
                <p className="text-xs text-white/30 mt-0.5">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panels */}
      <AdminTokensPanel users={allUsers} />
      <AdminMessagesPanel users={allUsers} />
      <AdminPromoPanel initialCodes={promoCodes} />
      <AdminSettingsForm initialPrompt={systemPrompt?.value || ''} />
    </div>
  );
}
