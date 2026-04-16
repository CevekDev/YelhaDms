import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MynaHero } from '@/components/ui/myna-hero';
import YelhaPricing from '@/components/ui/yelha-pricing';
import { Bot } from 'lucide-react';
import { FaqSection } from '@/components/ui/faq-section';
import { LandingAnimated } from '@/components/ui/landing-animated';

const ORANGE = '#FF6B2C';

export default async function LandingPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: undefined });

  // Icons are defined client-side in LandingAnimated — only pass serializable text here
  const FEATURES = [
    { title: t('features.telegram.title'), desc: t('features.telegram.desc') },
    { title: t('features.multilang.title'), desc: t('features.multilang.desc') },
    { title: t('features.voice.title'), desc: t('features.voice.desc') },
    { title: t('features.orders.title'), desc: t('features.orders.desc') },
    { title: t('features.payment.title'), desc: t('features.payment.desc') },
    { title: t('features.security.title'), desc: t('features.security.desc') },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* ── Hero (dark, animated) ── */}
      <MynaHero locale={locale} />

      {/* ── Features + How it works (animated) ──────────────────────── */}
      <LandingAnimated
        featuresBadge={t('features.badge')}
        featuresTitle={t('features.title')}
        featuresSubtitle={t('features.subtitle')}
        features={FEATURES}
        howBadge={t('howItWorks.badge')}
        howTitle={t('howItWorks.title')}
        steps={[
          { step: '01', title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.desc') },
          { step: '02', title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.desc') },
          { step: '03', title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.desc') },
        ]}
      />

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ── Pricing (dark) ───────────────────────────────────────────── */}
      <YelhaPricing locale={locale} />

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#0A0A0A]">
        <div className="container max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-mono text-4xl md:text-5xl font-bold text-white mb-6">
            {t('cta.title1')} <br />
            <span style={{ color: ORANGE }}>{t('cta.title2')}</span>
          </h2>
          <p className="text-white/50 text-base mb-10 font-mono">
            {t('cta.subtitle')}
          </p>
          <Link
            href={`/${locale}/auth/signup`}
            className="inline-block font-mono text-white text-sm px-8 py-4 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: ORANGE, boxShadow: `0 0 32px ${ORANGE}40` }}
          >
            {t('cta.button')}
          </Link>
        </div>
      </section>

      {/* ── Help Us ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#0A0A0A] border-t border-white/[0.06]">
        <div className="container max-w-2xl mx-auto px-6 text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest" style={{ color: ORANGE }}>
            Help Us Improve
          </span>
          <h2 className="font-mono text-2xl font-bold text-white mt-3 mb-2">
            Une idée ? Un bug à signaler ?
          </h2>
          <p className="font-mono text-sm text-white/40 mb-8">
            Votre retour nous aide à améliorer YelhaDms. Envoyez-nous vos suggestions ou signalez un problème.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:cvkdev@outlook.fr?subject=Suggestion%20YelhaDms"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: ORANGE }}
            >
              💡 Proposer une amélioration
            </a>
            <a
              href="mailto:cvkdev@outlook.fr?subject=Bug%20YelhaDms"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-mono text-sm border border-white/15 text-white/60 hover:border-white/30 hover:text-white transition-all"
            >
              🐛 Signaler un bug
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 bg-[#0A0A0A]">
        <div className="container max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: ORANGE }}
            >
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-mono font-bold text-white">YelhaDms</span>
          </div>
          <p className="font-mono text-xs text-white/30">{t('footer.rights')}</p>
          <div className="flex gap-5 font-mono text-xs text-white/30">
            <Link href={`/${locale}/privacy`} className="hover:text-white/60 transition-colors">
              {t('footer.privacy')}
            </Link>
            <Link href={`/${locale}/terms`} className="hover:text-white/60 transition-colors">
              {t('footer.terms')}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-white/60 transition-colors">
              {t('footer.contact')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
