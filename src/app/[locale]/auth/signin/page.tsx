'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import {
  YelhaAuthCard,
  AuthInput,
  AuthGoogleButton,
  AuthDivider,
  AuthSubmitButton,
} from '@/components/ui/yelha-signin';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function SignInPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        // 2FA required — redirect to verify-2fa page
        if (result.error.startsWith('2FA_REQUIRED:')) {
          const email = result.error.split('2FA_REQUIRED:')[1];
          router.push(`/${locale}/auth/verify-2fa?email=${encodeURIComponent(email)}`);
          return;
        }

        const errorMap: Record<string, string> = {
          EMAIL_NOT_VERIFIED: t('errors.emailNotVerified'),
          ACCOUNT_LOCKED: t('errors.accountLocked'),
        };
        toast({
          title: t('errors.invalidCredentials'),
          description: errorMap[result.error] || t('errors.invalidCredentials'),
          variant: 'destructive',
        });
      } else {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn('google', { callbackUrl: `/${locale}/dashboard` });
  };

  return (
    <YelhaAuthCard
      mode="signin"
      switchHref={`/${locale}/auth/signup`}
      switchText="Pas encore de compte ?"
      switchLabel="S'inscrire"
    >
      <AuthGoogleButton onClick={handleGoogle} loading={googleLoading} />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Email <span style={{ color: '#FF6B2C' }}>*</span>
          </label>
          <AuthInput
            type="email"
            placeholder="votre@email.com"
            error={!!errors.email}
            {...register('email')}
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Mot de passe <span style={{ color: '#FF6B2C' }}>*</span>
          </label>
          <div className="relative">
            <AuthInput
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••••"
              error={!!errors.password}
              className="pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-white/30 hover:text-white/60 transition-colors"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end mt-1.5">
            <Link
              href={`/${locale}/auth/forgot-password`}
              className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        <div className="pt-1">
          <AuthSubmitButton loading={loading} label="Se connecter" />
        </div>
      </form>
    </YelhaAuthCard>
  );
}
