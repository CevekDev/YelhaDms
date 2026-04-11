'use client';

import { useState, useEffect } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Menu, Bot, Send, Globe, Mic } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations } from 'next-intl';

const ORANGE = '#FF6B2C';

interface MynaHeroProps {
  locale: string;
}

export function MynaHero({ locale }: MynaHeroProps) {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [visibleWords, setVisibleWords] = useState<number[]>([]);

  const titleWords = [
    t('hero.title1'),
    t('hero.title2'),
    t('hero.title3'),
  ];

  const featureCards = [
    { icon: Send,  label: 'Telegram Bot',     desc: t('hero.telegram'), color: '#0EA5E9' },
    { icon: Globe, label: t('features.multilang.title'), desc: t('hero.multilang'), color: ORANGE },
    { icon: Mic,   label: t('features.voice.title'),     desc: t('hero.voice'),     color: '#8B5CF6' },
  ];

  const navLinks = [
    { href: '#features',  label: t('nav.features') },
    { href: '#pricing',   label: t('nav.pricing') },
    { href: '#how',       label: t('nav.howItWorks') },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    titleWords.forEach((_, i) => {
      setTimeout(() => {
        setVisibleWords(prev => [...prev, i]);
      }, 120 * i + 400);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0A0A0A]/95 backdrop-blur border-b border-white/10 shadow-md'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: ORANGE }}
            >
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-mono font-bold text-white text-lg tracking-tight">Yelha</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="font-mono text-sm text-white/60 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link href={`/${locale}/auth/signin`}>
              <button className="font-mono text-sm text-white/70 hover:text-white px-4 py-2 rounded-lg transition-colors">
                {t('nav.signIn')}
              </button>
            </Link>
            <Link href={`/${locale}/auth/signup`}>
              <button
                className="font-mono text-sm text-white px-4 py-2 rounded-lg transition-all hover:opacity-90 active:scale-95"
                style={{ background: ORANGE }}
              >
                {t('nav.signUp')}
              </button>
            </Link>
          </div>

          {/* Mobile menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden text-white/80 hover:text-white p-2">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[#0A0A0A] border-white/10 text-white">
              <div className="flex flex-col gap-6 mt-8">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="font-mono text-white/70 hover:text-white transition-colors text-lg"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="flex flex-col gap-3 mt-4">
                  <Link href={`/${locale}/auth/signin`} onClick={() => setMenuOpen(false)}>
                    <button className="font-mono text-sm text-white/70 hover:text-white w-full border border-white/20 px-4 py-3 rounded-lg transition-colors">
                      {t('nav.signIn')}
                    </button>
                  </Link>
                  <Link href={`/${locale}/auth/signup`} onClick={() => setMenuOpen(false)}>
                    <button
                      className="font-mono text-sm text-white w-full px-4 py-3 rounded-lg transition-all hover:opacity-90"
                      style={{ background: ORANGE }}
                    >
                      {t('hero.cta')}
                    </button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen bg-[#0A0A0A] overflow-hidden flex flex-col items-center justify-center px-6 pt-24 pb-16">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px] pointer-events-none"
          style={{ background: ORANGE }}
        />

        {/* Badge */}
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 mb-8"
        >
          <Bot className="w-3.5 h-3.5" style={{ color: ORANGE }} />
          <span className="font-mono text-xs text-white/50">{t('hero.badge')}</span>
        </m.div>

        {/* Title — word by word */}
        <h1 className="font-mono text-5xl md:text-7xl font-bold text-center leading-[1.1] mb-6">
          {titleWords.map((word, i) => (
            <AnimatePresence key={i}>
              {visibleWords.includes(i) && (
                <m.span
                  initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="inline-block mr-3"
                  style={i === titleWords.length - 1 ? { color: ORANGE } : { color: 'white' }}
                >
                  {word}
                </m.span>
              )}
            </AnimatePresence>
          ))}
        </h1>

        {/* Subtitle */}
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="font-mono text-white/50 text-center max-w-xl text-base md:text-lg mb-10 leading-relaxed"
        >
          {t('hero.subtitle')}
        </m.p>

        {/* CTAs */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-8"
        >
          <Link href={`/${locale}/auth/signup`}>
            <button
              className="font-mono text-white text-sm px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-95 shadow-lg"
              style={{ background: ORANGE, boxShadow: `0 0 24px ${ORANGE}40` }}
            >
              {t('hero.cta')}
            </button>
          </Link>
          <a href="#pricing">
            <button className="font-mono text-sm text-white/60 hover:text-white px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 transition-all">
              {t('nav.pricing')}
            </button>
          </a>
        </m.div>

        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.5 }}
          className="font-mono text-xs text-white/20 mb-16"
        >
          {t('hero.ctaSub')}
        </m.p>

        {/* Feature cards */}
        <m.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl"
        >
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <m.div
                key={card.label}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400 }}
                className="flex flex-col gap-2 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 cursor-default"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${card.color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <p className="font-mono text-sm font-semibold text-white">{card.label}</p>
                <p className="font-mono text-xs text-white/40 leading-relaxed">{card.desc}</p>
              </m.div>
            );
          })}
        </m.div>
      </section>
    </LazyMotion>
  );
}
