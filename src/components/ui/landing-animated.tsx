'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { Send, Globe, Mic, ShoppingCart, Coins, Shield } from 'lucide-react';

const ORANGE = '#FF6B2C';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

// Icons defined client-side (cannot pass functions as props from Server Components)
const FEATURE_ICONS = [Send, Globe, Mic, ShoppingCart, Coins, Shield];

interface FeatureText {
  title: string;
  desc: string;
}

interface Step {
  step: string;
  title: string;
  desc: string;
}

interface Props {
  featuresBadge: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: FeatureText[];
  howBadge: string;
  howTitle: string;
  steps: Step[];
}

export function LandingAnimated({ featuresBadge, featuresTitle, featuresSubtitle, features, howBadge, howTitle, steps }: Props) {
  return (
    <LazyMotion features={domAnimation}>
      {/* ── Features ── */}
      <section id="features" className="py-24 bg-white scroll-mt-20">
        <div className="container max-w-6xl mx-auto px-6">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ hidden: {}, visible: {} }}
            className="text-center mb-16"
          >
            <m.span
              custom={0}
              variants={fadeUp}
              className="font-mono text-xs font-semibold uppercase tracking-widest block"
              style={{ color: ORANGE }}
            >
              {featuresBadge}
            </m.span>
            <m.h2
              custom={1}
              variants={fadeUp}
              className="mt-3 text-4xl font-bold tracking-tight text-gray-900"
            >
              {featuresTitle}
            </m.h2>
            <m.p
              custom={2}
              variants={fadeUp}
              className="mt-4 text-gray-500 max-w-xl mx-auto"
            >
              {featuresSubtitle}
            </m.p>
          </m.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <m.div
                  key={f.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={fadeUp}
                  whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                  className="group flex flex-col gap-4 p-6 rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all duration-200 bg-white"
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
                </m.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-24 bg-gray-50 scroll-mt-20">
        <div className="container max-w-4xl mx-auto px-6 text-center">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ hidden: {}, visible: {} }}
          >
            <m.span
              custom={0}
              variants={fadeUp}
              className="font-mono text-xs font-semibold uppercase tracking-widest block"
              style={{ color: ORANGE }}
            >
              {howBadge}
            </m.span>
            <m.h2
              custom={1}
              variants={fadeUp}
              className="mt-3 text-4xl font-bold tracking-tight text-gray-900 mb-16"
            >
              {howTitle}
            </m.h2>
          </m.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((item, i) => (
              <m.div
                key={item.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                className="flex flex-col items-center"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold text-white mb-5"
                  style={{ background: ORANGE }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
