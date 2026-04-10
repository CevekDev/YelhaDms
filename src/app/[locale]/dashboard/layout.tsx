import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { DashboardNavbar } from '@/components/dashboard/navbar';

export default async function DashboardLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  return (
    <div className="flex h-screen bg-[#080810]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardNavbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
