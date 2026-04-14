import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
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

  // Enforce 2FA: if enabled but not yet verified in this session, redirect to 2FA page
  if (session.user.twoFactorEnabled && !session.user.twoFactorVerified) {
    redirect(`/${locale}/auth/verify-2fa`);
  }

  return <DashboardShell>{children}</DashboardShell>;
}
