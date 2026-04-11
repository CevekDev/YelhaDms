import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  targetType: z.enum(['all', 'user']),
  userId: z.string().optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { targetType, userId, subject, message } = parsed.data;

  let recipients: { email: string; name: string | null }[] = [];

  if (targetType === 'all') {
    recipients = await prisma.user.findMany({
      where: { role: 'USER', emailVerified: { not: null } },
      select: { email: true, name: true },
    });
  } else {
    if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    recipients = [user];
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire trouvé' }, { status: 400 });
  }

  // Resend free plan: use onboarding@resend.dev as FROM (no display name)
  const FROM = 'onboarding@resend.dev';

  const results = await Promise.allSettled(
    recipients.map(r =>
      resend.emails.send({
        from: FROM,
        to: r.email,
        subject: `[YelhaDms] ${subject}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
            <div style="background:#0a0a0a;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;">
              <span style="background:#FF6B2C;color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:monospace;">YelhaDms</span>
            </div>
            <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
              <h2 style="color:#111;margin-top:0;">${subject}</h2>
              <div style="color:#555;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
              <p style="color:#aaa;font-size:11px;margin:0;">© 2025 YelhaDms · mehdimerah06.pro@gmail.com</p>
            </div>
          </div>
        `,
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason?.message || 'Unknown error');

  if (failed > 0) console.error('[send-message] failed:', errors);

  return NextResponse.json({ success: true, sent, failed, total: recipients.length });
}
