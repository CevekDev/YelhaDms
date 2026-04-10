import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Truck, Package, MapPin, Clock, CheckCircle, Zap } from 'lucide-react';

const ORANGE = '#FF6B2C';

const CARRIERS = [
  {
    name: 'Yalidine',
    logo: '🚚',
    desc: 'Livraison express en Algérie',
    coverage: '58 wilayas',
    delay: '24-48h',
    color: '#F59E0B',
  },
  {
    name: 'Maystro Delivery',
    logo: '📦',
    desc: 'Livraison door-to-door',
    coverage: '48 wilayas',
    delay: '24-72h',
    color: '#3B82F6',
  },
  {
    name: 'Procolis',
    logo: '🏎️',
    desc: 'Livraison & logistique',
    coverage: '58 wilayas',
    delay: '24-48h',
    color: '#8B5CF6',
  },
  {
    name: 'Ecotrack',
    logo: '🌿',
    desc: 'Suivi en temps réel',
    coverage: '58 wilayas',
    delay: '48-72h',
    color: '#10B981',
  },
  {
    name: 'Zaki Express',
    logo: '⚡',
    desc: 'Express & économique',
    coverage: '45 wilayas',
    delay: '24-48h',
    color: '#EF4444',
  },
  {
    name: 'Atlas Express',
    logo: '🦅',
    desc: 'Livraison nationale',
    coverage: '58 wilayas',
    delay: '48-96h',
    color: '#6366F1',
  },
];

const FEATURES_PRO = [
  'Intégration directe avec Yalidine, Maystro, Procolis',
  'Confirmation de commande automatique par le bot',
  'Calcul automatique des frais de livraison',
  'Envoi de bon de livraison par message',
];

const FEATURES_AGENCY = [
  'Tout ce qui est inclus dans Pro',
  'Suivi de colis en temps réel via le bot',
  'Notifications automatiques de statut',
  'Gestion multi-transporteurs',
];

export default async function DeliveryPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/auth/signin`);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold font-mono text-white">Livraison</h1>
          <span
            className="text-[10px] font-mono font-bold px-2 py-1 rounded-full border"
            style={{ color: ORANGE, borderColor: `${ORANGE}40`, background: `${ORANGE}15` }}
          >
            EN COURS DE DÉVELOPPEMENT
          </span>
        </div>
        <p className="text-white/30 text-sm font-mono">
          Intégrez vos sociétés de livraison pour automatiser vos expéditions
        </p>
      </div>

      {/* Coming soon banner */}
      <div
        className="rounded-2xl p-6 border"
        style={{
          borderColor: `${ORANGE}30`,
          background: `linear-gradient(135deg, ${ORANGE}08 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${ORANGE}20` }}
          >
            <Truck className="w-6 h-6" style={{ color: ORANGE }} />
          </div>
          <div className="flex-1">
            <h2 className="font-mono font-bold text-white text-lg mb-1">
              Bientôt disponible 🚀
            </h2>
            <p className="font-mono text-sm text-white/50 leading-relaxed">
              Nous travaillons sur l&apos;intégration des principales sociétés de livraison algériennes.
              Cette fonctionnalité sera disponible prochainement pour les abonnés Pro et Agency.
            </p>
          </div>
        </div>
      </div>

      {/* Carriers grid */}
      <div>
        <h2 className="font-mono text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          Transporteurs disponibles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARRIERS.map((carrier) => (
            <div
              key={carrier.name}
              className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02] opacity-60 cursor-not-allowed"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{carrier.logo}</span>
                <div>
                  <h3 className="font-mono font-semibold text-white text-sm">{carrier.name}</h3>
                  <p className="font-mono text-xs text-white/30">{carrier.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1 text-white/30">
                  <MapPin className="w-3 h-3" />
                  <span>{carrier.coverage}</span>
                </div>
                <div className="flex items-center gap-1 text-white/30">
                  <Clock className="w-3 h-3" />
                  <span>{carrier.delay}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] font-mono text-white/20 bg-white/[0.04] px-2 py-1 rounded-full">
                  Bientôt disponible
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pro */}
        <div className="rounded-2xl p-6 border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: ORANGE }} />
            <h3 className="font-mono font-bold text-white">Pack Pro</h3>
          </div>
          <ul className="space-y-2.5">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/20" />
                <span className="font-mono text-xs text-white/40">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Agency */}
        <div className="rounded-2xl p-6 border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4" style={{ color: '#8B5CF6' }} />
            <h3 className="font-mono font-bold text-white">Pack Agency</h3>
          </div>
          <ul className="space-y-2.5">
            {FEATURES_AGENCY.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/20" />
                <span className="font-mono text-xs text-white/40">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
