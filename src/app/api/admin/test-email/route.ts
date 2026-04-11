import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'RESEND_API_KEY manquant dans les variables d\'environnement Railway',
    });
  }

  const { to } = await req.json().catch(() => ({ to: session.user.email }));
  const recipient = to || session.user.email;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'YelhaDms <noreply@dms.yelha.net>',
      to: recipient,
      subject: '[YelhaDms] Test email ✅',
      html: '<p style="font-family:monospace">Si tu vois cet email, Resend fonctionne correctement !</p>',
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message, detail: result.error });
    }

    return NextResponse.json({ ok: true, id: result.data?.id, to: recipient });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
