import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AdminSettingsForm from '@/components/admin/settings-form';

export default async function AdminSettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const systemPrompt = await prisma.systemSetting.findUnique({
    where: { key: 'global_system_prompt' },
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Paramètres système</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Configurez le prompt système global et les paramètres de la plateforme
        </p>
      </div>

      <AdminSettingsForm initialPrompt={systemPrompt?.value || ''} />
    </div>
  );
}
