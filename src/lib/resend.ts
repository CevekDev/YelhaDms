import nodemailer from 'nodemailer';

const ORANGE = '#FF6B2C';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yelha-production.up.railway.app';

// Gmail SMTP transporter — set GMAIL_USER + GMAIL_APP_PASSWORD in Railway env vars
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

const FROM = `Yelha <${process.env.GMAIL_USER}>`;

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

async function sendMail(to: string, subject: string, html: string) {
  const transporter = createTransporter();
  await transporter.sendMail({ from: FROM, to, subject, html });
}

// Legacy link-based verification (kept for backwards compat)
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  locale: string = 'fr'
) {
  await sendVerificationCodeEmail(email, name, token, locale);
}

// 6-digit code verification email
export async function sendVerificationCodeEmail(
  email: string,
  name: string,
  code: string,
  locale: string = 'fr'
) {
  const subjects: Record<string, string> = {
    fr: '[Yelha] Votre code de vérification',
    en: '[Yelha] Your verification code',
    ar: '[Yelha] رمز التحقق الخاص بك',
  };

  const greeting = locale === 'ar' ? 'مرحباً' : locale === 'en' ? 'Hello' : 'Bonjour';
  const intro = locale === 'ar'
    ? 'أدخل الرمز أدناه للتحقق من بريدك الإلكتروني:'
    : locale === 'en'
    ? 'Enter the code below to verify your email address:'
    : 'Entrez ce code sur le site pour vérifier votre adresse email :';
  const expiry = locale === 'ar'
    ? 'هذا الرمز صالح لمدة 24 ساعة.'
    : locale === 'en'
    ? 'This code expires in 24 hours.'
    : 'Ce code expire dans 24 heures.';

  const content = `
    <h2 style="color:#111;margin-top:0;">${greeting} ${name} !</h2>
    <p style="color:#555;line-height:1.7;">${intro}</p>
    <div style="background:#f9fafb;border-radius:12px;padding:32px;text-align:center;margin:24px 0;border:2px solid ${ORANGE}30;">
      <span style="font-size:52px;font-weight:900;font-family:monospace;color:${ORANGE};letter-spacing:14px;">${code}</span>
    </div>
    <p style="color:#999;font-size:13px;">${expiry} Ne partagez ce code avec personne.</p>
  `;

  await sendMail(email, subjects[locale] || subjects.fr, baseTemplate(content));
}

// Admin gift notification email
export async function sendAdminGiftEmail(
  email: string,
  name: string,
  tokens: number,
  packName: string | null,
  reason: string | null
) {
  const content = `
    <h2 style="color:#111;margin-top:0;">🎁 Vous avez reçu des tokens, ${name} !</h2>
    <p style="color:#555;line-height:1.7;">L'équipe Yelha vous a offert des tokens sur votre compte.</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin:24px 0;text-align:center;">
      <p style="margin:0;color:#888;font-size:13px;font-family:monospace;">${packName ? `PACK ${packName.toUpperCase()}` : 'TOKENS OFFERTS'}</p>
      <p style="margin:10px 0 4px;font-size:42px;font-weight:800;color:${ORANGE};font-family:monospace;">${tokens.toLocaleString()}</p>
      <p style="margin:0;color:#888;font-size:13px;">tokens ajoutés à votre compte</p>
    </div>
    ${reason ? `<p style="color:#555;line-height:1.7;">Motif : <strong>${reason}</strong></p>` : ''}
    <p style="color:#555;line-height:1.7;">Connectez-vous à votre tableau de bord pour les utiliser.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/fr/dashboard/tokens"
         style="display:inline-block;background:${ORANGE};color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-family:monospace;font-size:14px;">
        Voir mon solde
      </a>
    </div>
  `;

  await sendMail(email, `[Yelha] 🎁 ${tokens.toLocaleString()} tokens offerts par Yelha`, baseTemplate(content));
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

  await sendMail(email, `[Yelha] Confirmation d'achat — ${tokens.toLocaleString()} tokens`, baseTemplate(content));
}

// Partner notification email
export async function sendPartnerEmail(
  email: string,
  name: string,
  tokenLimit: number | null,
  adminMessage: string | null
) {
  const tokensLabel = tokenLimit
    ? `${tokenLimit.toLocaleString()} tokens alloués`
    : 'Tokens illimités';

  const content = `
    <h2 style="color:#111;margin-top:0;">🤝 Félicitations ${name} — Vous êtes maintenant Partenaire Yelha !</h2>

    <div style="background:linear-gradient(135deg,#FF6B2C15,#FF6B2C05);border:2px solid ${ORANGE}40;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <span style="background:${ORANGE};color:#fff;font-family:monospace;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:2px;text-transform:uppercase;">PARTENAIRE</span>
      <p style="margin:16px 0 4px;font-size:18px;font-weight:800;color:#111;font-family:monospace;">${tokensLabel}</p>
      <p style="margin:0;color:#888;font-size:13px;">Accès complet — Niveau Agence</p>
    </div>

    <p style="color:#555;line-height:1.7;"><strong>Ce que vous obtenez en tant que partenaire :</strong></p>
    <ul style="color:#555;line-height:2;">
      <li>✅ Accès à toutes les fonctionnalités du plan Agence</li>
      <li>✅ Bots illimités sur vos connexions</li>
      <li>✅ Prise de commandes automatique</li>
      <li>✅ Multi-bots Telegram & intégration livraison</li>
      <li>✅ Support prioritaire</li>
      ${tokenLimit ? `<li>✅ ${tokenLimit.toLocaleString()} tokens disponibles sur votre compte</li>` : '<li>✅ Tokens illimités</li>'}
    </ul>

    ${adminMessage ? `<div style="background:#f9fafb;border-left:3px solid ${ORANGE};padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0;"><p style="margin:0;color:#555;font-size:14px;font-style:italic;">"${adminMessage}"</p><p style="margin:8px 0 0;color:#aaa;font-size:12px;">— L'équipe Yelha</p></div>` : ''}

    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/fr/dashboard"
         style="display:inline-block;background:${ORANGE};color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-family:monospace;font-size:14px;">
        Accéder à mon tableau de bord
      </a>
    </div>
    <p style="color:#999;font-size:13px;">Merci de votre confiance. Bienvenue dans le programme partenaire Yelha !</p>
  `;

  await sendMail(email, `[Yelha] 🤝 Vous êtes maintenant Partenaire Yelha !`, baseTemplate(content));
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

  await sendMail(email, subjects[locale] || subjects.fr, baseTemplate(content));
}
