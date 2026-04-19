import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Internal endpoint called by the WhatsApp microservice to persist session state
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-whatsapp-secret');
  if (!secret || secret !== process.env.WHATSAPP_SERVICE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectionId, userId, phoneNumber, displayName, isActive } = await req.json();

  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });

  if (isActive === false) {
    await prisma.whatsAppSession.updateMany({
      where: { connectionId },
      data: { isActive: false, waStatus: 'disconnected', qrDataUrl: null },
    });
  } else if (userId) {
    await prisma.whatsAppSession.upsert({
      where: { connectionId },
      create: { userId, connectionId, phoneNumber, displayName, isActive: true, waStatus: 'ready', qrDataUrl: null, lastSeen: new Date() },
      update: { phoneNumber, displayName, isActive: true, waStatus: 'ready', qrDataUrl: null, lastSeen: new Date() },
    });
    // Mark the connection's WHATSAPP platform as active
    await prisma.connection.update({
      where: { id: connectionId },
      data: { isActive: true },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
