import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authRatelimit, getRateLimitKey } from '@/lib/ratelimit';
import { passwordSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: passwordSchema,
});

export async function POST(req: NextRequest) {
  const { success } = await authRatelimit.limit(getRateLimitKey(req));
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { email, code, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 });

  // Find token where the stored value ends with `-{code}`
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      used: false,
      expires: { gt: new Date() },
      token: { endsWith: `-${code}` },
    },
  });

  if (!resetToken) {
    return NextResponse.json({ error: 'Code invalide ou expiré.' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
