import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AdminPromoPanel from '@/components/admin/promo-panel';

export default async function AdminPromoPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const promoCodes = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { uses: true } } },
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Codes promo</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Créez et gérez vos codes promotionnels
        </p>
      </div>

      <AdminPromoPanel initialCodes={promoCodes} />
    </div>
  );
}
