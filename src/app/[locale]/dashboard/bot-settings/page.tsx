import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import BotSettingsClient from '@/components/dashboard/bot-settings-client';

export default async function BotSettingsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  const connections = await prisma.connection.findMany({
    where: { userId: session.user.id },
    include: {
      predefinedMessages: { orderBy: { priority: 'desc' } },
      detailResponses: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Réglage du bot</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Configurez la personnalité, les réponses et le comportement de vos bots
        </p>
      </div>

      <BotSettingsClient connections={connections} />
    </div>
  );
}
