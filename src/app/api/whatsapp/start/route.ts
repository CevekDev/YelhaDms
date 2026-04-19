import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    return NextResponse.json({ error: 'WHATSAPP_SERVICE_URL ou WHATSAPP_SERVICE_SECRET manquant sur Vercel' }, { status: 503 });
  }

  // Mark session as initializing
  await prisma.whatsAppSession.upsert({
    where: { connectionId },
    create: { userId: session.user.id, connectionId, isActive: false, waStatus: 'initializing', qrDataUrl: null },
    update: { waStatus: 'initializing', qrDataUrl: null, isActive: false },
  });

  let initRes: Response | null = null;
  try {
    initRes = await fetch(`${WA_SERVICE_URL}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-secret': WA_SERVICE_SECRET },
      body: JSON.stringify({ connectionId, userId: session.user.id }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Impossible de joindre Railway: ${e?.message}` }, { status: 503 });
  }

  if (initRes.status === 401) {
    return NextResponse.json({ error: 'Secret Railway invalide (401) — vérifiez WHATSAPP_SERVICE_SECRET sur Vercel et Railway' }, { status: 503 });
  }

  if (!initRes.ok) {
    return NextResponse.json({ error: `Railway a retourné ${initRes.status}` }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
