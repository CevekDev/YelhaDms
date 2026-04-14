import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  if (session.user.twoFactorEnabled && !session.user.twoFactorVerified) {
    redirect(`/${locale}/auth/verify-2fa`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planLevel: true, trialUsed: true, tokenBalance: true },
  });

  const planLevel = user?.planLevel || 'FREE';

  return <DashboardShell planLevel={planLevel}>{children}</DashboardShell>;
}
