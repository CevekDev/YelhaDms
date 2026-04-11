import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MynaHero } from '@/components/ui/myna-hero';
import YelhaPricing from '@/components/ui/yelha-pricing';
import { Bot, Globe, Shield, Coins, Send, Mic, ShoppingCart } from 'lucide-react';

const ORANGE = '#FF6B2C';

export default async function LandingPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: undefined });

  const FEATURES = [
    {
      icon: Send,
      title: t('features.telegram.title'),
      desc: t('features.telegram.desc'),
    },
    {
      icon: Globe,
      title: t('features.multilang.title'),
      desc: t('features.multilang.desc'),
    },
    {
      icon: Mic,
      title: t('features.voice.title'),
      desc: t('features.voice.desc'),
    },
    {
      icon: ShoppingCart,
      title: t('features.orders.title'),
      desc: t('features.orders.desc'),
    },
    {
      icon: Coins,
      title: t('features.payment.title'),
      desc: t('features.payment.desc'),
    },
    {
      icon: Shield,
      title: t('features.security.title'),
      desc: t('features.security.desc'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* ── Hero (dark, animated) ── */}
      <MynaHero locale={locale} />

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white scroll-mt-20">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span
              className="font-mono text-xs font-semibold uppercase tracking-widest"
              style={{ color: ORANGE }}
            >
              {t('features.badge')}
            </span>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
              {t('features.title')}
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group flex flex-col gap-4 p-6 rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200 bg-white"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${ORANGE}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: ORANGE }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="py-24 bg-gray-50 scroll-mt-20">
        <div className="container max-w-4xl mx-auto px-6 text-center">
          <span
            className="font-mono text-xs font-semibold uppercase tracking-widest"
            style={{ color: ORANGE }}
          >
            {t('howItWorks.badge')}
          </span>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 mb-16">
            {t('howItWorks.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: '01', title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.desc') },
              { step: '02', title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.desc') },
              { step: '03', title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.desc') },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold text-white mb-5"
                  style={{ background: ORANGE }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
          <Link href={`/${locale}/auth/signup`}>
            <button
              className="font-mono text-white text-sm px-8 py-4 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ background: ORANGE, boxShadow: `0 0 32px ${ORANGE}40` }}
            >
              {t('cta.button')}
            </button>
          </Link>
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
            <span className="font-mono font-bold text-white">Yelha</span>
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
