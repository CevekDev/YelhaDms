import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Called by Railway microservice when a QR code is generated
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-whatsapp-secret');
  if (!secret || secret !== process.env.WHATSAPP_SERVICE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectionId, userId, qrDataUrl } = await req.json();
  if (!connectionId || !qrDataUrl) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  await prisma.whatsAppSession.upsert({
    where: { connectionId },
    create: { userId, connectionId, isActive: false, waStatus: 'qr', qrDataUrl },
    update: { waStatus: 'qr', qrDataUrl },
  });

  return NextResponse.json({ ok: true });
}
