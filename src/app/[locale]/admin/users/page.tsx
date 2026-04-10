import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AdminUsersTable from '@/components/admin/users-table';
import AdminTokensPanel from '@/components/admin/tokens-panel';
import AdminMessagesPanel from '@/components/admin/messages-panel';

export default async function AdminUsersPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, tokenBalance: true,
      role: true, unlimitedTokens: true, createdAt: true,
      twoFactorEnabled: true, emailVerified: true,
      _count: { select: { connections: true } },
    },
  });

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Utilisateurs</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          {allUsers.length} compte{allUsers.length > 1 ? 's' : ''} enregistré{allUsers.length > 1 ? 's' : ''}
        </p>
      </div>

      <AdminUsersTable users={allUsers} />
      <AdminTokensPanel users={allUsers} />
      <AdminMessagesPanel users={allUsers} />
    </div>
  );
}
