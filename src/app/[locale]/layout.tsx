import type { Metadata } from 'next';
import { Inter, Cairo } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SessionProvider } from '@/components/providers/session-provider';
import { Toaster } from '@/components/ui/toaster';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  preload: true,
});

const locales = ['fr', 'en', 'ar'];

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  return staticMetadata(locale);
}

function staticMetadata(locale: string): Metadata {
  return {
  title: {
    default: 'YelhaDms — Bot IA pour les entreprises algériennes',
    template: '%s | YelhaDms',
  },
  description:
    'Automatisez vos réponses Telegram avec une IA intelligente. Parle arabe (Darija & MSA), français, anglais. Paiement en Dinars Algériens (DZD) via Chargily.',
  keywords: [
    'bot telegram algérie',
    'intelligence artificielle algérie',
    'chatbot DZ',
    'automatisation messages algérie',
    'bot ia darija',
    'bot telegram DZD',
    'yelha',
    'service client automatique algérie',
    'bot arabe algérie',
    'SaaS algérie',
  ],
  authors: [{ name: 'YelhaDms', url: 'https://yelha-production.up.railway.app' }],
  creator: 'YelhaDms',
  publisher: 'YelhaDms',
  metadataBase: new URL('https://yelha-production.up.railway.app'),
  alternates: {
    canonical: '/',
    languages: {
      'fr': '/fr',
      'en': '/en',
      'ar': '/ar',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_DZ',
    url: 'https://yelha-production.up.railway.app',
    siteName: 'YelhaDms',
    title: 'YelhaDms — Bot IA pour les entreprises algériennes',
    description:
      'Automatisez vos réponses Telegram avec une IA intelligente. Arabe (Darija & MSA), français, anglais. Paiement DZD.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'YelhaDms — Bot IA Algérie',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YelhaDms — Bot IA',
    description: 'Automatisez vos messages Telegram avec une IA qui parle Darija, arabe, français.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: '',
  },
  icons: { icon: '/favicon.ico' },
  other: {
    'geo.region': 'DZ',
    'geo.country': 'Algeria',
  },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages();
  const isRTL = locale === 'ar';

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} className={`${inter.variable} ${cairo.variable}`} suppressHydrationWarning>
      <body className={`${isRTL ? 'font-cairo' : 'font-sans'} antialiased bg-background text-foreground`} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            {children}
            <Toaster />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
