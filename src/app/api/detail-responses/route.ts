import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function verifyConnectionOwner(connectionId: string, userId: string) {
  return prisma.connection.findFirst({ where: { id: connectionId, userId } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { connectionId, questionType, response } = body;

  if (!connectionId || !questionType?.trim() || !response?.trim()) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const conn = await verifyConnectionOwner(connectionId, session.user.id);
  if (!conn) return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });

  const detail = await prisma.botDetailResponse.create({
    data: { connectionId, questionType: questionType.trim(), response: response.trim() },
  });

  return NextResponse.json(detail, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, questionType, response, isActive } = body;

  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  const existing = await prisma.botDetailResponse.findUnique({
    where: { id },
    include: { connection: { select: { userId: true } } },
  });
  if (!existing || existing.connection.userId !== session.user.id) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  const data: any = {};
  if (questionType !== undefined) data.questionType = questionType.trim();
  if (response !== undefined) data.response = response.trim();
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.botDetailResponse.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  const existing = await prisma.botDetailResponse.findUnique({
    where: { id },
    include: { connection: { select: { userId: true } } },
  });
  if (!existing || existing.connection.userId !== session.user.id) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  await prisma.botDetailResponse.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
