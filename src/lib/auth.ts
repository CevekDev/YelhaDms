import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional(),
  // passed from the 2FA page after code is verified
  twoFactorVerified: z.string().optional(),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/fr/auth/signin',
    error: '/fr/auth/error',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        twoFactorVerified: { label: '2FA Verified', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, twoFactorVerified } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // ── Path A: 2FA verification already done (coming from /auth/verify-2fa) ──
        if (twoFactorVerified === 'true') {
          // Trust: the /api/auth/2fa/verify endpoint already validated the code
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorVerified: true,
            unlimitedTokens: user.unlimitedTokens,
          };
        }

        // ── Path B: Normal credential login ──
        if (!user.password || !password) return null;
        if (!user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED');

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('ACCOUNT_LOCKED');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockData =
            attempts >= 10
              ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + 30 * 60 * 1000) }
              : { failedLoginAttempts: attempts };
          await prisma.user.update({ where: { id: user.id }, data: lockData });
          return null;
        }

        // Reset failed attempts
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        // If 2FA is enabled → signal the signin page to redirect to verify-2fa
        if (user.twoFactorEnabled) {
          // Send the code by email first
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/2fa/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
          } catch {}
          // Return a special marker — the signin page will detect this and redirect
          throw new Error(`2FA_REQUIRED:${email}`);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorVerified: false,
          unlimitedTokens: user.unlimitedTokens,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.twoFactorEnabled = (user as any).twoFactorEnabled;
        token.twoFactorVerified = (user as any).twoFactorVerified ?? false;
        token.unlimitedTokens = (user as any).unlimitedTokens ?? false;
      }
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
        session.user.twoFactorVerified = token.twoFactorVerified as boolean;
        session.user.unlimitedTokens = token.unlimitedTokens as boolean;
      }
      return session;
    },
  },
};
