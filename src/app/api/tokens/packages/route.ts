import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_PACKAGES = [
  { id: 'starter',  name: 'Starter',  tokens: 500,   price: 2500,  currency: 'DZD', isActive: true, isFeatured: false },
  { id: 'business', name: 'Business', tokens: 2000,  price: 5000,  currency: 'DZD', isActive: true, isFeatured: true  },
  { id: 'pro',      name: 'Pro',      tokens: 5000,  price: 10000, currency: 'DZD', isActive: true, isFeatured: false },
  { id: 'agency',   name: 'Agency',   tokens: 15000, price: 22000, currency: 'DZD', isActive: true, isFeatured: false },
];

export async function GET() {
  let packages = await prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: { tokens: 'asc' },
  });

  // Auto-seed if table is empty
  if (packages.length === 0) {
    for (const pkg of DEFAULT_PACKAGES) {
      await prisma.tokenPackage.upsert({
        where: { id: pkg.id },
        update: {},
        create: pkg,
      });
    }
    packages = await prisma.tokenPackage.findMany({
      where: { isActive: true },
      orderBy: { tokens: 'asc' },
    });
  }

  return NextResponse.json(packages);
}
