import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationCodeEmail } from '@/lib/resend';
import { authRatelimit } from '@/lib/ratelimit';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await authRatelimit.limit(ip);
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return NextResponse.json({ success: true }); // Silent for security

  const code = generateCode();
  // Delete unused tokens before creating a new one
  await prisma.userVerificationToken.deleteMany({
    where: { userId: user.id, used: false },
  });
  await prisma.userVerificationToken.create({
    data: { userId: user.id, token: code, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  try {
    await sendVerificationCodeEmail(email, user.name || '', code);
  } catch (err) {
    console.error('[resend-verification] email send failed:', err);
  }
  return NextResponse.json({ success: true });
}
