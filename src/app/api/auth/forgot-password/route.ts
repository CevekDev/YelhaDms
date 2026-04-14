import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/resend';
import { authRatelimit, getRateLimitKey } from '@/lib/ratelimit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const schema = z.object({ email: z.string().email(), locale: z.string().optional() });

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  const { success } = await authRatelimit.limit(getRateLimitKey(req));
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Email invalide' }, { status: 400 });

  const { email, locale = 'fr' } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success (don't reveal if email exists)
  if (!user || !user.password) return NextResponse.json({ success: true });

  const code = generateCode();

  // Delete old reset tokens, store new one with cuid prefix for uniqueness
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: `${uuidv4()}-${code}`,
      expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  await sendPasswordResetEmail(email, user.name || '', code, locale);
  return NextResponse.json({ success: true });
}
