import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Plug, MessageSquare, Coins, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const ORANGE = '#FF6B2C';

export default async function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);

  // Admin → redirect directly to admin panel
  if (session?.user.role === 'ADMIN') {
    redirect(`/${locale}/admin`);
  }

  const t = await getTranslations('dashboard');

  const [user, connections, todayMessages, totalMessages] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { tokenBalance: true, name: true, unlimitedTokens: true },
    }),
    prisma.connection.count({ where: { userId: session!.user.id, isActive: true } }),
    prisma.message.count({
      where: {
        conversation: { connection: { userId: session!.user.id } },
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.message.count({ where: { conversation: { connection: { userId: session!.user.id } } } }),
  ]);

  const stats = [
    {
      label: t('tokenBalance'),
      value: user?.unlimitedTokens ? '∞' : (user?.tokenBalance ?? 0).toLocaleString(),
      icon: Coins,
      accent: ORANGE,
      sub: 'tokens disponibles',
    },
    {
      label: t('activeConnections'),
      value: connections.toLocaleString(),
      icon: Plug,
      accent: '#34d399',
      sub: 'plateformes connectées',
    },
    {
      label: t('messagesToday'),
      value: todayMessages.toLocaleString(),
      icon: MessageSquare,
      accent: '#a78bfa',
      sub: "messages aujourd'hui",
    },
    {
      label: t('totalMessages'),
      value: totalMessages.toLocaleString(),
      icon: TrendingUp,
      accent: '#60a5fa',
      sub: 'messages au total',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">
          Bonjour, <span style={{ color: ORANGE }}>{user?.name || 'utilisateur'}</span> 👋
        </h1>
        <p className="text-white/40 text-sm mt-1 font-mono">
          Voici un aperçu de votre activité aujourd&apos;hui.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex flex-col gap-3 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-white/40 uppercase tracking-wider">{stat.label}</span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.accent}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                </div>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-bold font-mono text-white">{stat.value}</p>
                <p className="text-xs text-white/30 mt-0.5">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {connections === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: `${ORANGE}18` }}
          >
            <Plug className="w-7 h-7" style={{ color: ORANGE }} />
          </div>
          <h3 className="text-lg font-semibold font-mono text-white mb-2">
            Aucune connexion pour l&apos;instant
          </h3>
          <p className="text-white/40 text-sm mb-6 max-w-sm">
            Connectez votre première plateforme de messagerie pour commencer à automatiser vos réponses.
          </p>
          <Link href={`/${locale}/dashboard/connections`}>
            <button
              className="flex items-center gap-2 font-mono text-sm text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90"
              style={{ background: ORANGE }}
            >
              <Plug className="w-4 h-4" />
              Ajouter une connexion
            </button>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-mono text-white/40 uppercase tracking-wider mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Acheter des tokens', href: `/${locale}/dashboard/tokens`, desc: 'Recharger votre solde' },
            { label: 'Gérer les connexions', href: `/${locale}/dashboard/connections`, desc: 'Plateformes & bots' },
            { label: 'Voir les analytics', href: `/${locale}/dashboard/analytics`, desc: 'Statistiques détaillées' },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all p-4 cursor-pointer group">
                <p className="text-sm font-mono font-medium text-white group-hover:text-[#FF6B2C] transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-white/30 mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
