import Link from 'next/link';
import { Bot, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "CGU de YelhaDms — conditions d'utilisation du service.",
};

const ORANGE = '#FF6B2C';
const EMAIL = 'mehdimerah06.pro@gmail.com';

export default function TermsPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
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
        <h1 className="text-4xl font-bold mb-2 font-mono">Conditions Générales d&apos;Utilisation</h1>
        <p className="text-white/40 font-mono text-sm mb-12">Dernière mise à jour : Janvier 2025</p>

        {[
          {
            title: '1. Présentation du service',
            content: `YelhaDms est une plateforme SaaS qui permet aux entreprises et professionnels algériens de créer des bots Telegram alimentés par l'intelligence artificielle.\n\nEn utilisant YelhaDms, vous acceptez les présentes conditions d'utilisation.`,
          },
          {
            title: '2. Inscription et compte',
            content: `• Vous devez fournir des informations exactes lors de l'inscription\n• Vous êtes responsable de la confidentialité de vos identifiants\n• Un compte par personne physique ou morale\n• Vous devez avoir au moins 18 ans pour utiliser le service\n• YelhaDms se réserve le droit de suspendre tout compte en cas d'utilisation abusive`,
          },
          {
            title: '3. Système de tokens',
            content: `Le service fonctionne sur un système de tokens prépayés en Dinars Algériens (DZD) :\n\n• 1 token = 1 message texte traité\n• 2 tokens = 1 message vocal (transcription + réponse)\n• 0 token = réponses prédéfinies (mots-clés)\n\nLes tokens achetés sont valables sans date d'expiration. Les achats sont définitifs et non remboursables sauf défaut technique de notre part.`,
          },
          {
            title: '4. Paiement',
            content: `Les paiements sont traités via Chargily ePay (opérateur de paiement agréé en Algérie). Nous acceptons :\n\n• CIB (Carte Interbancaire)\n• Dahabia\n• Virement bancaire\n\nTous les prix sont exprimés en Dinars Algériens (DZD). Aucune TVA supplémentaire n'est appliquée.`,
          },
          {
            title: '5. Utilisation acceptable',
            content: `Il est strictement interdit d'utiliser YelhaDms pour :\n\n• Envoyer du spam ou des messages non sollicités\n• Diffuser des contenus illicites, haineux ou offensants\n• Collecter des données personnelles sans consentement\n• Violer les Conditions d'utilisation de Telegram\n• Tenter d'accéder à des systèmes tiers sans autorisation\n• Usurper l'identité d'une autre personne ou organisation\n\nToute violation entraîne la suspension immédiate du compte sans remboursement.`,
          },
          {
            title: '6. Disponibilité du service',
            content: `Nous nous efforçons de maintenir une disponibilité maximale mais ne pouvons garantir un service ininterrompu. Des maintenances peuvent être planifiées avec préavis.\n\nYelhaDms n'est pas responsable des interruptions liées à Telegram, DeepSeek, ou d'autres services tiers.`,
          },
          {
            title: '7. Propriété intellectuelle',
            content: `Le code, le design, la marque YelhaDms et tous les contenus du service sont protégés par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite.\n\nLes contenus que vous créez (instructions bot, réponses prédéfinies) restent votre propriété.`,
          },
          {
            title: '8. Limitation de responsabilité',
            content: `YelhaDms ne saurait être tenu responsable :\n\n• Des réponses générées par l'IA (contenu généré automatiquement)\n• Des pertes commerciales liées à une interruption de service\n• Des actions des utilisateurs utilisant le service\n\nVotre responsabilité en tant qu'opérateur du bot vous incombe entièrement.`,
          },
          {
            title: '9. Résiliation',
            content: `Vous pouvez supprimer votre compte à tout moment depuis les paramètres. Les tokens non utilisés ne sont pas remboursés.\n\nYelhaDms peut résilier votre compte avec un préavis de 30 jours, ou immédiatement en cas de violation des CGU.`,
          },
          {
            title: '10. Droit applicable',
            content: `Les présentes CGU sont soumises au droit algérien. Tout litige sera soumis à la compétence des tribunaux d'Alger, Algérie.\n\nPour toute question : ${EMAIL}`,
          },
        ].map(section => (
          <section key={section.title} className="mb-10">
            <h2 className="text-xl font-semibold mb-4 font-mono" style={{ color: ORANGE }}>
              {section.title}
            </h2>
            <div className="text-white/60 leading-relaxed font-mono text-sm whitespace-pre-line">
              {section.content.split('\n').map((line, i) => (
                <p key={i} className={`${line.startsWith('•') ? 'pl-2' : ''} mb-1`}>
                  {line}
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
            <Link href={`/${locale}/privacy`} className="text-white/30 hover:text-white/60 transition-colors">Confidentialité</Link>
            <Link href={`/${locale}/contact`} className="text-white/30 hover:text-white/60 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
