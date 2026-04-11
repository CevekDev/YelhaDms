import Link from 'next/link';
import { Bot, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité de YelhaDms — comment nous protégeons vos données.',
};

const ORANGE = '#FF6B2C';
const EMAIL = 'mehdimerah06.pro@gmail.com';

export default function PrivacyPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2 font-mono">Politique de confidentialité</h1>
        <p className="text-white/40 font-mono text-sm mb-12">Dernière mise à jour : Janvier 2025</p>

        {[
          {
            title: '1. Qui sommes-nous ?',
            content: `YelhaDms est un service SaaS algérien qui permet aux entreprises d'automatiser leurs réponses Telegram grâce à l'intelligence artificielle. Nous sommes basés en Algérie.\n\nContact : ${EMAIL}`,
          },
          {
            title: '2. Données collectées',
            content: `Nous collectons uniquement les données nécessaires au fonctionnement du service :\n\n• **Données de compte** : nom, adresse e-mail, mot de passe (haché bcrypt)\n• **Données de connexion** : tokens de bots Telegram (chiffrés AES-256-GCM)\n• **Données de paiement** : traitement délégué à Chargily ePay — nous ne stockons jamais vos coordonnées bancaires\n• **Logs d'utilisation** : nombre de messages traités, tokens consommés\n• **Cookies de session** : gestion de l'authentification via NextAuth.js`,
          },
          {
            title: '3. Utilisation des données',
            content: `Vos données sont utilisées exclusivement pour :\n\n• Fournir le service de réponse automatique IA\n• Gérer votre compte et vos abonnements\n• Vous envoyer des notifications transactionnelles (e-mail de vérification, confirmation d'achat)\n• Améliorer la qualité du service\n\nNous ne vendons jamais vos données à des tiers.`,
          },
          {
            title: '4. Stockage et sécurité',
            content: `• **Base de données** : PostgreSQL hébergé sur Supabase (région EU-West-1)\n• **Chiffrement** : tokens sensibles chiffrés avec AES-256-GCM\n• **Authentification** : JWT sécurisé, 2FA TOTP disponible\n• **Transport** : HTTPS (TLS 1.3) sur toutes les communications\n• **Rate limiting** : protection via Upstash Redis`,
          },
          {
            title: '5. Partage des données',
            content: `Nous partageons uniquement les données nécessaires avec :\n\n• **Supabase** — hébergement base de données (EU)\n• **Chargily ePay** — traitement des paiements DZD\n• **Telegram API** — envoi/réception de messages via votre bot\n• **DeepSeek AI** — génération des réponses IA (messages anonymisés)\n• **OpenAI Whisper** — transcription audio (données non conservées)`,
          },
          {
            title: '6. Vos droits',
            content: `Conformément aux lois applicables, vous disposez des droits suivants :\n\n• **Accès** : obtenir une copie de vos données\n• **Rectification** : corriger des données inexactes\n• **Suppression** : demander la suppression de votre compte et données\n• **Portabilité** : exporter vos données (disponible dans les paramètres)\n\nPour exercer ces droits, contactez-nous à : **${EMAIL}**`,
          },
          {
            title: '7. Cookies',
            content: `Nous utilisons uniquement les cookies strictement nécessaires :\n\n• Cookie de session NextAuth (authentification)\n• Aucun cookie publicitaire ou de tracking tiers`,
          },
          {
            title: '8. Conservation des données',
            content: `• Données de compte : conservées jusqu'à suppression du compte\n• Logs de messages : conservés 90 jours\n• Données de paiement : conservées selon les obligations légales algériennes\n\nAprès suppression du compte, toutes les données sont effacées sous 30 jours.`,
          },
          {
            title: '9. Contact',
            content: `Pour toute question relative à cette politique de confidentialité :\n\nE-mail : **${EMAIL}**\n\nNous répondons dans un délai de 72 heures ouvrables.`,
          },
        ].map(section => (
          <section key={section.title} className="mb-10">
            <h2 className="text-xl font-semibold mb-4 font-mono" style={{ color: ORANGE }}>
              {section.title}
            </h2>
            <div className="text-white/60 leading-relaxed space-y-2 font-mono text-sm whitespace-pre-line">
              {section.content.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('•') ? 'pl-2' : ''}>
                  {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                </p>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <span className="font-mono text-xs text-white/30">© 2025 YelhaDms</span>
          <div className="flex gap-5 font-mono text-xs">
            <Link href={`/${locale}/terms`} className="text-white/30 hover:text-white/60 transition-colors">CGU</Link>
            <Link href={`/${locale}/contact`} className="text-white/30 hover:text-white/60 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
