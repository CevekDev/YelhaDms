'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import Link from 'next/link';
import { Check, Zap, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ORANGE = '#FF6B2C';

const PLAN_KEYS = [
  { key: 'starter', name: 'Starter', tokens: 500,   price: 2500,  popular: false },
  { key: 'business', name: 'Business', tokens: 2000,  price: 5000,  popular: true  },
  { key: 'pro',      name: 'Pro',      tokens: 5000,  price: 10000, popular: false },
  { key: 'agency',   name: 'Agency',   tokens: 15000, price: 22000, popular: false },
] as const;

const cardVariants: any = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  visible: (i: number) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { delay: 0.1 + i * 0.12, duration: 0.5, ease: 'easeOut' },
  }),
};

interface YelhaPricingProps {
  locale: string;
}

export default function YelhaPricing({ locale }: YelhaPricingProps) {
  const t = useTranslations();

  return (
    <section
      id="pricing"
      className="relative bg-[#030308] py-24 px-6 overflow-hidden scroll-mt-20"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right,#ffffff 1px,transparent 1px),linear-gradient(to bottom,#ffffff 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Blue glow orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(49,49,245,0.18) 0%, transparent 70%)',
        }}
      />

      <LazyMotion features={domAnimation}>
        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14">
            <m.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 mb-5"
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: ORANGE }} />
              <span className="font-mono text-xs text-white/50">{t('pricing.badge')}</span>
            </m.div>

            <m.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-mono text-4xl md:text-5xl font-bold text-white mb-4"
            >
              {t('pricing.title1')}<br />
              <span style={{ color: ORANGE }}>{t('pricing.title2')}</span>
            </m.h2>

            <m.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="font-mono text-white/40 max-w-lg mx-auto"
            >
              {t('pricing.subtitle')}
            </m.p>

            {/* Free trial banner */}
            <m.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="inline-flex items-center gap-2 mt-6 bg-white/[0.04] border border-orange-500/30 rounded-xl px-5 py-3"
            >
              <Zap className="w-4 h-4" style={{ color: ORANGE }} />
              <span className="font-mono text-sm text-white/80">
                🎁 <strong style={{ color: ORANGE }}>{t('pricing.trial')}</strong>{' '}—{' '}
                <span className="text-white/50">{t('pricing.trialSub')}</span>
              </span>
            </m.div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLAN_KEYS.map((plan, i) => {
              const features = t.raw(`pricing.plans.${plan.key}.features`) as string[];
              const desc = t(`pricing.plans.${plan.key}.desc`);

              return (
                <m.div
                  key={plan.key}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={cardVariants}
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`relative flex flex-col rounded-2xl p-6 border ${
                    plan.popular
                      ? 'border-orange-500/60 bg-gradient-to-b from-white/[0.08] to-white/[0.03]'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                  style={
                    plan.popular
                      ? { boxShadow: `0 0 60px rgba(255,107,44,0.12), 0 -1px 0 rgba(255,107,44,0.5) inset` }
                      : {}
                  }
                >
                  {plan.popular && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-white px-3 py-1 rounded-full whitespace-nowrap"
                      style={{ background: ORANGE }}
                    >
                      {t('pricing.popular')}
                    </div>
                  )}

                  {/* Plan name */}
                  <h3 className="font-mono text-white font-bold text-xl mb-1">{plan.name}</h3>
                  <p className="font-mono text-xs text-white/40 mb-5">{desc}</p>

                  {/* Price */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-4xl font-bold text-white">
                        {plan.price.toLocaleString('fr-DZ')}
                      </span>
                      <span className="font-mono text-sm text-white/40">{t('pricing.da')}</span>
                    </div>
                    <p className="font-mono text-sm mt-1" style={{ color: ORANGE }}>
                      {plan.tokens.toLocaleString()} {t('pricing.tokens')}
                    </p>
                    <p className="font-mono text-xs text-white/30 mt-0.5">
                      = {(plan.price / plan.tokens).toFixed(1)} {t('pricing.perToken')}
                    </p>
                  </div>

                  {/* CTA */}
                  <Link href={`/${locale}/auth/signup`} className="mb-6">
                    <button
                      className={`w-full py-3 rounded-xl font-mono text-sm font-semibold transition-all ${
                        plan.popular
                          ? 'text-white hover:opacity-90'
                          : 'text-white/70 border border-white/15 hover:border-white/30 hover:text-white'
                      }`}
                      style={plan.popular ? { background: ORANGE } : {}}
                    >
                      {t('pricing.start')}
                    </button>
                  </Link>

                  {/* Features */}
                  <div className="border-t border-white/10 pt-5 space-y-2.5 flex-1">
                    {Array.isArray(features) && features.map((f: string) => (
                      <div key={f} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                        <span className="font-mono text-xs text-white/50 leading-relaxed">{f}</span>
                      </div>
                    ))}
                  </div>
                </m.div>
              );
            })}
          </div>

          {/* Token legend */}
          <m.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-10 font-mono text-xs text-white/30"
          >
            <span>💬 {t('pricing.legend.text')}</span>
            <span>🎤 {t('pricing.legend.voice')}</span>
            <span>⚡ {t('pricing.legend.predefined')}</span>
            <span>♾️ {t('pricing.legend.noExpiry')}</span>
          </m.div>
        </div>
      </LazyMotion>
    </section>
  );
}
