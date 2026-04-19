import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Tells the Railway microservice to initialise a WA client (fire-and-forget)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { connectionId } = await req.json();
  if (!connectionId) return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 });

  const connection = await prisma.connection.findFirst({
    where: { id: connectionId, userId: session.user.id, platform: 'WHATSAPP' },
  });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const WA_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;
  const WA_SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET;

  if (!WA_SERVICE_URL || !WA_SERVICE_SECRET) {
    return NextResponse.json({ error: 'WhatsApp service not configured' }, { status: 503 });
  }

  // Mark session as initializing
  await prisma.whatsAppSession.upsert({
    where: { connectionId },
    create: { userId: session.user.id, connectionId, isActive: false, waStatus: 'initializing', qrDataUrl: null },
    update: { waStatus: 'initializing', qrDataUrl: null, isActive: false },
  });

  // Fire-and-forget — do not await the QR generation
  fetch(`${WA_SERVICE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': WA_SERVICE_SECRET },
    body: JSON.stringify({ connectionId, userId: session.user.id }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
