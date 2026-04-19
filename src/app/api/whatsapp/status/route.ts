import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');
  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });

  const waSession = await prisma.whatsAppSession.findUnique({
    where: { connectionId },
    select: { phoneNumber: true, displayName: true, isActive: true, lastSeen: true, waStatus: true, qrDataUrl: true },
  });

  return NextResponse.json({
    isActive: waSession?.isActive ?? false,
    phoneNumber: waSession?.phoneNumber ?? null,
    displayName: waSession?.displayName ?? null,
    lastSeen: waSession?.lastSeen ?? null,
    waStatus: waSession?.waStatus ?? null,
    qrDataUrl: waSession?.qrDataUrl ?? null,
  });
}
