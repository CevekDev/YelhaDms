'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionne YelhaDms ?',
    a: "YelhaDms connecte votre bot Telegram à une IA avancée. Vos clients envoient des messages, le bot répond automatiquement, gère les commandes et répond aux questions sur vos produits — 24h/24.",
  },
  {
    q: 'Combien de tokens vais-je consommer ?',
    a: "Chaque message texte consomme environ 1 token. Un message vocal en consomme entre 3 et 5. Avec 500 tokens (pack Starter), vous pouvez gérer environ 500 échanges — suffisant pour un démarrage confortable.",
  },
  {
    q: 'Le bot parle quelle langue ?',
    a: "Le bot détecte automatiquement la langue du client et lui répond dans sa langue. Il supporte l'arabe, le français, l'anglais et bien d'autres langues.",
  },
  {
    q: 'Est-ce que je peux tester gratuitement ?',
    a: "Oui ! À l'inscription, vous recevez 50 tokens offerts pour tester toutes les fonctionnalités du pack Starter — sans carte bancaire requise.",
  },
  {
    q: 'Comment configurer le bot ?',
    a: "Depuis votre espace client, connectez votre bot Telegram (via BotFather), ajoutez vos produits, personnalisez le comportement du bot via les instructions personnalisées, et c'est prêt. La mise en place prend moins de 5 minutes.",
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    a: "Oui. Toutes les données sont chiffrées, les tokens Telegram sont stockés de façon sécurisée, et vos informations ne sont jamais partagées avec des tiers.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="bg-[#0A0A0A] py-24">
      <div className="container max-w-3xl mx-auto px-6">
        <h2 className="font-mono text-3xl md:text-4xl font-bold text-white text-center mb-16">
          Questions fréquentes
        </h2>
        <div className="divide-y divide-white/[0.06]">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="border-b border-white/[0.06] last:border-b-0">
                <button
                  className="w-full flex items-center justify-between gap-4 py-5 text-left"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-mono text-white/80 text-sm md:text-base leading-snug">
                    {item.q}
                  </span>
                  <ChevronDown
                    className="w-5 h-5 text-white/40 flex-shrink-0 transition-transform duration-300"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: isOpen ? '500px' : '0px' }}
                >
                  <p className="font-mono text-white/40 text-sm leading-relaxed pb-5">
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
