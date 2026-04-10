import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ORANGE = '#FF6B2C';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ success: true }); // don't reveal if user exists

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCode: code, twoFactorCodeExpiry: expiry },
    });

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: '[Yelha] Votre code de vérification',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
          <div style="background:#0a0a0a;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
            <span style="background:${ORANGE};color:#fff;padding:6px 18px;border-radius:20px;font-weight:700;font-family:monospace;font-size:14px;letter-spacing:1px;">Yelha</span>
          </div>
          <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
            <h2 style="color:#111;margin-top:0;">Code de vérification</h2>
            <p style="color:#555;">Votre code de vérification à deux facteurs :</p>
            <div style="background:#f9fafb;border-radius:12px;padding:28px;text-align:center;margin:20px 0;border:2px solid ${ORANGE}30;">
              <span style="font-size:48px;font-weight:900;font-family:monospace;color:${ORANGE};letter-spacing:12px;">${code}</span>
            </div>
            <p style="color:#999;font-size:13px;">Ce code expire dans <strong>10 minutes</strong>. Ne le partagez avec personne.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="color:#aaa;font-size:11px;margin:0;">© 2025 Yelha · Si vous n'avez pas demandé ce code, ignorez cet email.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[2fa/send]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
