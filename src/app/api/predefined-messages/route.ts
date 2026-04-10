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
  const { connectionId, keywords, response } = body;

  if (!connectionId || !Array.isArray(keywords) || keywords.length === 0 || !response?.trim()) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const conn = await verifyConnectionOwner(connectionId, session.user.id);
  if (!conn) return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });

  const count = await prisma.predefinedMessage.count({ where: { connectionId } });
  if (count >= 50) {
    return NextResponse.json({ error: 'Maximum 50 Q&R prédéfinies' }, { status: 400 });
  }

  const msg = await prisma.predefinedMessage.create({
    data: {
      connectionId,
      keywords,
      response: response.trim(),
    },
  });

  return NextResponse.json(msg, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, keywords, response, isActive } = body;

  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  const existing = await prisma.predefinedMessage.findUnique({
    where: { id },
    include: { connection: { select: { userId: true } } },
  });
  if (!existing || existing.connection.userId !== session.user.id) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  const data: any = {};
  if (keywords !== undefined) data.keywords = keywords;
  if (response !== undefined) data.response = response.trim();
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.predefinedMessage.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

  const existing = await prisma.predefinedMessage.findUnique({
    where: { id },
    include: { connection: { select: { userId: true } } },
  });
  if (!existing || existing.connection.userId !== session.user.id) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  await prisma.predefinedMessage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
