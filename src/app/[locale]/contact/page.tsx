import Link from 'next/link';
import { Bot, ArrowLeft, Mail, MessageCircle, Send, Clock } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contactez l\'équipe YelhaDms — support et questions.',
};

const ORANGE = '#FF6B2C';
const EMAIL = 'mehdimerah06.pro@gmail.com';

export default function ContactPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ORANGE }}>
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-mono font-bold text-white">YelhaDms</span>
          </Link>
          <Link href={`/${locale}`} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors font-mono">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest" style={{ color: ORANGE }}>
            Contact
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-4 font-mono">
            On est là pour vous
          </h1>
          <p className="text-white/40 font-mono max-w-xl mx-auto">
            Une question, un problème technique, ou juste envie de discuter de votre projet ?
            Contactez-nous — nous répondons rapidement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: Mail,
              title: 'E-mail',
              value: EMAIL,
              desc: 'Pour toute question générale ou technique',
              href: `mailto:${EMAIL}`,
              cta: 'Envoyer un e-mail',
            },
            {
              icon: Send,
              title: 'Telegram',
              value: '@YelhaDmsDZ',
              desc: 'Support direct via Telegram',
              href: 'https://t.me/YelhaDmsDZ',
              cta: 'Ouvrir Telegram',
            },
            {
              icon: Clock,
              title: 'Délai de réponse',
              value: '< 24h',
              desc: 'Nous répondons en semaine de 9h à 18h (HEC)',
              href: null,
              cta: null,
            },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex flex-col gap-4 p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-orange-500/30 transition-all"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: `${ORANGE}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: ORANGE }} />
                </div>
                <div>
                  <h3 className="font-mono font-semibold text-white mb-1">{card.title}</h3>
                  <p className="font-mono text-sm mb-2" style={{ color: ORANGE }}>
                    {card.value}
                  </p>
                  <p className="text-xs text-white/40 font-mono leading-relaxed">{card.desc}</p>
                </div>
                {card.href && (
                  <a
                    href={card.href}
                    target={card.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="mt-auto font-mono text-xs text-white/60 hover:text-white border border-white/10 hover:border-orange-500/40 rounded-lg py-2.5 text-center transition-all"
                  >
                    {card.cta}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div>
          <h2 className="font-mono text-2xl font-bold mb-8 text-center">
            Questions fréquentes
          </h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {[
              {
                q: 'Comment créer un bot Telegram ?',
                a: `Ouvrez Telegram et cherchez @BotFather. Envoyez /newbot, choisissez un nom et un username pour votre bot. Copiez le token fourni et collez-le dans votre tableau de bord YelhaDms — le webhook est configuré automatiquement.`,
              },
              {
                q: 'Quels moyens de paiement acceptez-vous ?',
                a: 'Nous acceptons CIB, Dahabia et virement bancaire via Chargily ePay (opérateur agréé en Algérie). Tous les paiements sont en Dinars Algériens (DZD).',
              },
              {
                q: "Est-ce que l'IA parle Darija ?",
                a: "Oui ! YelhaDms utilise DeepSeek AI qui comprend et répond en Darija algérienne, arabe MSA, français, anglais et plus de 100 autres langues. Elle détecte automatiquement la langue du message reçu.",
              },
              {
                q: 'Les tokens expirent-ils ?',
                a: "Non, vos tokens n'ont pas de date d'expiration. Achetez selon vos besoins et utilisez-les quand vous voulez.",
              },
              {
                q: "Comment fonctionne la transcription vocale ?",
                a: 'Quand un client envoie un message vocal, YelhaDms le transcrit via OpenAI Whisper, puis DeepSeek AI génère une réponse textuelle appropriée. Cela coûte 2 tokens au lieu de 1.',
              },
              {
                q: 'Puis-je personnaliser les réponses du bot ?',
                a: "Absolument. Depuis votre tableau de bord, vous pouvez définir : la personnalité du bot, les instructions système, des réponses prédéfinies pour certains mots-clés (0 token), la formalité et le style des réponses.",
              },
            ].map(({ q, a }) => (
              <div
                key={q}
                className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all"
              >
                <h3 className="font-mono text-sm font-semibold text-white mb-2" style={{ color: ORANGE }}>
                  {q}
                </h3>
                <p className="font-mono text-sm text-white/50 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 mt-16">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span className="font-mono text-xs text-white/30">© 2025 YelhaDms</span>
          <div className="flex gap-5 font-mono text-xs">
            <Link href={`/${locale}/privacy`} className="text-white/30 hover:text-white/60 transition-colors">Confidentialité</Link>
            <Link href={`/${locale}/terms`} className="text-white/30 hover:text-white/60 transition-colors">CGU</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
