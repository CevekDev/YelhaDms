import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ConversationsClient from '@/components/dashboard/conversations-client';

export default async function ConversationsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  const connections = await prisma.connection.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      conversations: {
        orderBy: { lastMessage: 'desc' },
        take: 50,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Conversations</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Suivez les conversations de vos bots en temps réel
        </p>
      </div>

      <ConversationsClient connections={connections} />
    </div>
  );
}
