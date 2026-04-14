import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Settings, Info } from 'lucide-react';

const ORANGE = '#FF6B2C';

export default async function AdminSettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const [userCount, connectionCount, convCount, orderCount] = await Promise.all([
    prisma.user.count(),
    prisma.connection.count(),
    prisma.conversation.count(),
    prisma.order.count(),
  ]);

  const stats = [
    { label: 'Utilisateurs', value: userCount },
    { label: 'Connexions actives', value: connectionCount },
    { label: 'Conversations', value: convCount },
    { label: 'Commandes', value: orderCount },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Paramètres système</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Statistiques globales de la plateforme
        </p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center"
          >
            <p className="font-mono text-3xl font-bold text-white">{s.value.toLocaleString()}</p>
            <p className="font-mono text-xs text-white/30 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info block */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${ORANGE}20` }}>
            <Info className="w-4 h-4" style={{ color: ORANGE }} />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-white text-sm mb-1">Prompt système</h2>
            <p className="text-xs text-white/40 font-mono leading-relaxed">
              Le prompt système global est géré directement dans le code source (
              <code className="text-white/60">src/lib/deepseek.ts</code>).
              Chaque utilisateur peut personnaliser son bot depuis les paramètres de son bot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
