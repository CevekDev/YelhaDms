'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signUpSchema } from '@/lib/validations';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import { PasswordStrength } from '@/components/auth/password-strength';
import {
  YelhaAuthCard,
  AuthInput,
  AuthGoogleButton,
  AuthDivider,
  AuthSubmitButton,
} from '@/components/ui/yelha-signin';

type FormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
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
    watch,
  } = useForm<FormData>({ resolver: zodResolver(signUpSchema) });

  const watchedPassword = watch('password', '');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone || undefined,
          dateOfBirth: data.dateOfBirth || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: tCommon('error'),
          description: json.error || t('errors.emailExists'),
          variant: 'destructive',
        });
      } else {
        router.push(`/${locale}/auth/verify-email?email=${encodeURIComponent(data.email)}`);
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
      mode="signup"
      tagline="Créez votre bot Telegram IA en moins de 2 minutes. Arabe, Darija, Français, Anglais."
      switchHref={`/${locale}/auth/signin`}
      switchText="Déjà un compte ?"
      switchLabel="Se connecter"
    >
      <AuthGoogleButton onClick={handleGoogle} loading={googleLoading} />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Name */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Nom complet <span style={{ color: '#FF6B2C' }}>*</span>
          </label>
          <AuthInput
            placeholder="Ahmed Benali"
            error={!!errors.name}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-red-400 mt-1 font-mono">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Email <span style={{ color: '#FF6B2C' }}>*</span>
          </label>
          <AuthInput
            type="email"
            placeholder="vous@email.com"
            error={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-red-400 mt-1 font-mono">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
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
          <PasswordStrength password={watchedPassword} />
          {errors.password && (
            <p className="text-xs text-red-400 mt-1 font-mono">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Confirmer le mot de passe <span style={{ color: '#FF6B2C' }}>*</span>
          </label>
          <AuthInput
            type="password"
            placeholder="••••••••"
            error={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-400 mt-1 font-mono">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Téléphone <span className="text-white/20">(optionnel)</span>
          </label>
          <AuthInput
            type="tel"
            placeholder="+213 6XX XXX XXX"
            error={!!errors.phone}
            {...register('phone')}
          />
          {errors.phone && (
            <p className="text-xs text-red-400 mt-1 font-mono">{errors.phone.message}</p>
          )}
        </div>

        {/* Date of birth */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5">
            Date de naissance <span className="text-white/20">(optionnel)</span>
          </label>
          <AuthInput
            type="date"
            error={!!errors.dateOfBirth}
            {...register('dateOfBirth')}
          />
          {errors.dateOfBirth && (
            <p className="text-xs text-red-400 mt-1 font-mono">{errors.dateOfBirth.message}</p>
          )}
        </div>

        {/* Accept terms */}
        <div className="flex items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            id="acceptTerms"
            {...register('acceptTerms')}
            className="mt-0.5 accent-orange-500"
          />
          <label htmlFor="acceptTerms" className="text-xs font-mono text-white/40 cursor-pointer leading-relaxed">
            J&apos;accepte les{' '}
            <Link href={`/${locale}/terms`} className="text-white/60 hover:text-white underline">
              conditions d&apos;utilisation
            </Link>{' '}
            et la{' '}
            <Link href={`/${locale}/privacy`} className="text-white/60 hover:text-white underline">
              politique de confidentialité
            </Link>
          </label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-red-400 font-mono">{errors.acceptTerms.message}</p>
        )}

        <div className="pt-1">
          <AuthSubmitButton loading={loading} label="Créer mon compte" />
        </div>
      </form>
    </YelhaAuthCard>
  );
}
