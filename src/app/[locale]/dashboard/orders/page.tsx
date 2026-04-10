import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OrdersClient from '@/components/dashboard/orders-client';

export default async function OrdersPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
      connection: { select: { name: true, platform: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Commandes</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Toutes les commandes validées par vos bots
        </p>
      </div>

      <OrdersClient initialOrders={orders} />
    </div>
  );
}
