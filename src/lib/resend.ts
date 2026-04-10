import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend free plan: must use onboarding@resend.dev as FROM (no custom domain)
const FROM = 'onboarding@resend.dev';
const ORANGE = '#FF6B2C';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yelha-production.up.railway.app';

function baseTemplate(content: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
      <div style="background:#0a0a0a;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;">
        <span style="background:${ORANGE};color:#fff;padding:6px 18px;border-radius:20px;font-size:14px;font-weight:700;font-family:monospace;letter-spacing:1px;">Yelha</span>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
        ${content}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
        <p style="color:#aaa;font-size:11px;margin:0;">© 2025 Yelha · mehdimerah06.pro@gmail.com</p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  locale: string = 'fr'
) {
  const verifyUrl = `${APP_URL}/${locale}/auth/verify-email?token=${token}`;

  const subjects: Record<string, string> = {
    fr: '[Yelha] Vérifiez votre adresse email',
    en: '[Yelha] Verify your email address',
    ar: '[Yelha] تحقق من عنوان بريدك الإلكتروني',
  };

  const content = `
    <h2 style="color:#111;margin-top:0;">
      ${locale === 'ar' ? 'مرحباً' : locale === 'en' ? 'Hello' : 'Bonjour'} ${name} !
    </h2>
    <p style="color:#555;line-height:1.7;">
      ${locale === 'ar'
        ? 'انقر على الزر أدناه للتحقق من بريدك الإلكتروني:'
        : locale === 'en'
        ? 'Click the button below to verify your email address:'
        : 'Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :'}
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${verifyUrl}"
         style="display:inline-block;background:${ORANGE};color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-family:monospace;font-size:14px;">
        ${locale === 'ar' ? 'تحقق من البريد الإلكتروني' : locale === 'en' ? 'Verify Email' : 'Vérifier mon email'}
      </a>
    </div>
    <p style="color:#999;font-size:13px;">
      ${locale === 'ar' ? 'هذا الرابط صالح لمدة 24 ساعة.' : locale === 'en' ? 'This link expires in 24 hours.' : 'Ce lien expire dans 24 heures.'}
    </p>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: subjects[locale] || subjects.fr,
    html: baseTemplate(content),
  });
}

export async function sendTokenPurchaseEmail(
  email: string,
  name: string,
  tokens: number,
  amountDZD: number
) {
  const formattedAmount = amountDZD.toLocaleString('fr-FR') + ' DA';

  const content = `
    <h2 style="color:#111;margin-top:0;">Merci pour votre achat, ${name} !</h2>
    <p style="color:#555;line-height:1.7;">Votre paiement a bien été reçu. Vos tokens ont été ajoutés instantanément à votre compte.</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin:24px 0;text-align:center;">
      <p style="margin:0;color:#888;font-size:13px;font-family:monospace;">TOKENS ACHETÉS</p>
      <p style="margin:10px 0 4px;font-size:42px;font-weight:800;color:${ORANGE};font-family:monospace;">${tokens.toLocaleString()}</p>
      <p style="margin:0;color:#888;font-size:13px;">Montant payé : <strong style="color:#333;">${formattedAmount}</strong></p>
    </div>
    <p style="color:#555;line-height:1.7;">Connectez-vous à votre tableau de bord pour commencer à utiliser vos tokens.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/fr/dashboard/tokens"
         style="display:inline-block;background:${ORANGE};color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-family:monospace;font-size:14px;">
        Voir mon solde
      </a>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `[Yelha] Confirmation d'achat — ${tokens.toLocaleString()} tokens`,
    html: baseTemplate(content),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string,
  locale: string = 'fr'
) {
  const resetUrl = `${APP_URL}/${locale}/auth/reset-password?token=${token}`;

  const subjects: Record<string, string> = {
    fr: '[Yelha] Réinitialisez votre mot de passe',
    en: '[Yelha] Reset your password',
    ar: '[Yelha] إعادة تعيين كلمة المرور',
  };

  const content = `
    <h2 style="color:#111;margin-top:0;">
      ${locale === 'ar' ? 'مرحباً' : locale === 'en' ? 'Hello' : 'Bonjour'} ${name},
    </h2>
    <p style="color:#555;line-height:1.7;">
      ${locale === 'ar'
        ? 'انقر على الزر أدناه لإعادة تعيين كلمة المرور الخاصة بك:'
        : locale === 'en'
        ? 'Click the button below to reset your password:'
        : 'Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :'}
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}"
         style="display:inline-block;background:${ORANGE};color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-family:monospace;font-size:14px;">
        ${locale === 'ar' ? 'إعادة تعيين كلمة المرور' : locale === 'en' ? 'Reset Password' : 'Réinitialiser le mot de passe'}
      </a>
    </div>
    <p style="color:#999;font-size:13px;">
      ${locale === 'ar' ? 'هذا الرابط صالح لمدة 15 دقيقة فقط.' : locale === 'en' ? 'This link expires in 15 minutes.' : 'Ce lien expire dans 15 minutes.'}
    </p>
  `;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: subjects[locale] || subjects.fr,
    html: baseTemplate(content),
  });
}
