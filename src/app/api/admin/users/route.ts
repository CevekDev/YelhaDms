import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const search = searchParams.get('search') ?? '';
  const filter = searchParams.get('filter') ?? 'all'; // all | banned | admins

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (filter === 'banned') where.isBanned = true;
  if (filter === 'admins') where.role = 'ADMIN';

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        tokenBalance: true,
        unlimitedTokens: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pageSize: PAGE_SIZE });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  isBanned: z.boolean().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  unlimitedTokens: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userId, isBanned, role, unlimitedTokens } = parsed.data;

  // Prevent admin from banning themselves
  if (userId === session.user.id && isBanned === true) {
    return NextResponse.json({ error: 'Cannot ban your own account' }, { status: 400 });
  }

  const data: any = {};
  if (isBanned !== undefined) data.isBanned = isBanned;
  if (role !== undefined) data.role = role;
  if (unlimitedTokens !== undefined) data.unlimitedTokens = unlimitedTokens;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true, isBanned: true, unlimitedTokens: true },
  });

  return NextResponse.json(user);
}
