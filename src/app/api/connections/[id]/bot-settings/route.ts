import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await prisma.connection.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!connection) return NextResponse.json({ error: 'Bot introuvable' }, { status: 404 });

  const body = await req.json();
  const { botName, businessName, customInstructions, botPersonality } = body;

  const updated = await prisma.connection.update({
    where: { id: params.id },
    data: {
      botName: botName || 'Assistant',
      businessName: businessName || null,
      customInstructions: customInstructions || null,
      botPersonality: botPersonality || null,
    },
  });

  return NextResponse.json(updated);
}
