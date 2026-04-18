import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { validateEcotrackToken } from '@/lib/ecotrack';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { planLevel: true } });
  const allowedPlans = ['BUSINESS', 'PRO', 'AGENCY'];
  if (!user || !allowedPlans.includes(user.planLevel)) {
    return NextResponse.json({ error: 'Cette fonctionnalité nécessite le pack Business ou supérieur.' }, { status: 403 });
  }

  const connection = await prisma.connection.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { url, token, autoShip, remove, autoShipOnly } = body;

  if (remove) {
    await prisma.connection.update({ where: { id: params.id }, data: { ecotrackUrl: null, ecotrackToken: null, ecotrackAutoShip: false } });
    return NextResponse.json({ ok: true });
  }

  // Toggle auto-ship only (no token needed)
  if (autoShipOnly) {
    await prisma.connection.update({ where: { id: params.id }, data: { ecotrackAutoShip: !!autoShip } });
    return NextResponse.json({ ok: true });
  }

  if (!url || !token) return NextResponse.json({ error: 'URL et token requis.' }, { status: 400 });

  // Validate token against Ecotrack
  const valid = await validateEcotrackToken(url.replace(/\/$/, ''), token);
  if (!valid) {
    return NextResponse.json({ error: 'Token Ecotrack invalide. Vérifiez vos identifiants.' }, { status: 400 });
  }

  const encryptedToken = encrypt(token);
  await prisma.connection.update({
    where: { id: params.id },
    data: {
      ecotrackUrl: url.replace(/\/$/, ''),
      ecotrackToken: encryptedToken,
      ecotrackAutoShip: !!autoShip,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await prisma.connection.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { ecotrackUrl: true, ecotrackToken: true, ecotrackAutoShip: true },
  });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ecotrackUrl: connection.ecotrackUrl ?? '',
    ecotrackConfigured: !!connection.ecotrackToken,
    ecotrackAutoShip: connection.ecotrackAutoShip,
  });
}
