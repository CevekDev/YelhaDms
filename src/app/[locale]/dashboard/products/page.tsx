import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ProductsClient from '@/components/dashboard/products-client';

export default async function ProductsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planLevel: true },
  });

  // Plans that allow WooCommerce/Shopify import: BUSINESS, PRO, AGENCY
  const canImport = ['BUSINESS', 'PRO', 'AGENCY'].includes(user?.planLevel || 'FREE');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Produits</h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Gérez votre catalogue produits — le bot peut les présenter et prendre des commandes
        </p>
      </div>

      <ProductsClient initialProducts={products} canImport={canImport} />
    </div>
  );
}
