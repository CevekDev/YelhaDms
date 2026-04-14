import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { sendWelcomeEmail } from './resend';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional(),
  twoFactorVerified: z.string().optional(),
  autoLoginToken: z.string().optional(),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
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
        autoLoginToken: { label: 'Auto Login Token', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, twoFactorVerified, autoLoginToken } = parsed.data;

        // ── Path 0: Auto-login after email verification ──
        if (autoLoginToken && autoLoginToken.startsWith('al_')) {
          const tokenRecord = await prisma.userVerificationToken.findFirst({
            where: {
              token: autoLoginToken,
              used: false,
              expires: { gt: new Date() },
            },
            include: { user: true },
          });
          if (!tokenRecord) return null;
          await prisma.userVerificationToken.update({
            where: { id: tokenRecord.id },
            data: { used: true },
          });
          const u = tokenRecord.user;
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            image: u.image,
            role: u.role,
            twoFactorEnabled: u.twoFactorEnabled,
            twoFactorVerified: false,
            unlimitedTokens: u.unlimitedTokens,
          };
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // ── Path A: 2FA verification already done ──
        if (twoFactorVerified === 'true') {
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

        if (!user.emailVerified) {
          // Include email in error so the signin page can redirect to verify-email
          throw new Error(`EMAIL_NOT_VERIFIED:${user.email}`);
        }

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

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        if (user.twoFactorEnabled) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/2fa/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
          } catch {}
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
  events: {
    async signIn({ user, isNewUser, account }) {
      if (account?.provider === 'google' && user.email) {
        if (isNewUser) {
          // Nouveaux users Google → 50 tokens gratuits
          const TRIAL_TOKENS = 50;
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { tokenBalance: TRIAL_TOKENS, trialUsed: true },
            });
            await prisma.tokenTransaction.create({
              data: {
                userId: user.id,
                type: 'TRIAL',
                amount: TRIAL_TOKENS,
                balance: TRIAL_TOKENS,
                description: `🎁 Essai gratuit — ${TRIAL_TOKENS} tokens offerts`,
              },
            });
            await sendWelcomeEmail(user.email, user.name || 'Utilisateur');
          } catch (e) {
            console.error('[auth] Google new user setup failed:', e);
          }
        } else {
          // Utilisateur existant qui revient via Google
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { trialUsed: true, name: true },
          });
          if (dbUser?.trialUsed === false) {
            // A un compte mais n'a jamais eu les tokens (cas rare)
            const TRIAL_TOKENS = 50;
            try {
              await prisma.user.update({
                where: { id: user.id },
                data: { tokenBalance: { increment: TRIAL_TOKENS }, trialUsed: true },
              });
              await prisma.tokenTransaction.create({
                data: {
                  userId: user.id,
                  type: 'TRIAL',
                  amount: TRIAL_TOKENS,
                  balance: TRIAL_TOKENS,
                  description: `🎁 Essai gratuit — ${TRIAL_TOKENS} tokens offerts`,
                },
              });
            } catch {}
          }
        }
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        if (!(user as any).role) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, twoFactorEnabled: true, unlimitedTokens: true },
          });
          token.role = dbUser?.role ?? 'USER';
          token.twoFactorEnabled = dbUser?.twoFactorEnabled ?? false;
          token.twoFactorVerified = false;
          token.unlimitedTokens = dbUser?.unlimitedTokens ?? false;
        } else {
          token.role = (user as any).role;
          token.twoFactorEnabled = (user as any).twoFactorEnabled;
          token.twoFactorVerified = (user as any).twoFactorVerified ?? false;
          token.unlimitedTokens = (user as any).unlimitedTokens ?? false;
        }
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
