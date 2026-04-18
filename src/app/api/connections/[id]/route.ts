import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  businessName: z.string().max(100).optional(),
  botName: z.string().min(1).max(50).optional(),
  botPersonality: z.object({
    formality: z.number().min(1).max(10),
    friendliness: z.number().min(1).max(10),
    responseLength: z.number().min(1).max(10),
    emojiUsage: z.number().min(1).max(10),
  }).optional(),
  customInstructions: z.string().max(2000).optional(),
  welcomeMessage: z.string().max(1000).optional(),
  awayMessage: z.string().max(1000).optional(),
  businessHours: z.record(z.string(), z.object({
    open: z.string().optional(),
    close: z.string().optional(),
    closed: z.boolean().optional(),
  })).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  deliveryFee: z.number().min(0).max(100000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [connection, user] = await Promise.all([
    prisma.connection.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { predefinedMessages: { orderBy: { priority: 'asc' } }, botCommands: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { planLevel: true } }),
  ]);

  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { telegramBotToken, ecotrackToken, ...safe } = connection;
  return NextResponse.json({ ...safe, _planLevel: user?.planLevel ?? 'FREE' });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await prisma.connection.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Validate botName is not empty if provided
  if (parsed.data.botName !== undefined && !parsed.data.botName.trim()) {
    return NextResponse.json({ error: 'Le nom du bot est obligatoire' }, { status: 400 });
  }

  const updated = await prisma.connection.update({ where: { id: params.id }, data: parsed.data });
  const { telegramBotToken, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await prisma.connection.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.connection.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
