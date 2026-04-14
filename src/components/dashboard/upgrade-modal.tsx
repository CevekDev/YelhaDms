'use client';

import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ORANGE = '#FF6B2C';

const PLAN_LABELS: Record<string, string> = {
  STARTER:  'Starter',
  BUSINESS: 'Business',
  PRO:      'Pro',
  AGENCY:   'Agency',
};

interface UpgradeModalProps {
  requiredPlan: 'STARTER' | 'BUSINESS' | 'PRO' | 'AGENCY';
  featureName: string;
  onClose: () => void;
}

export function UpgradeModal({ requiredPlan, featureName, onClose }: UpgradeModalProps) {
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${ORANGE}20` }}>
          <Zap className="w-6 h-6" style={{ color: ORANGE }} />
        </div>

        <h3 className="font-mono font-bold text-white text-lg mb-2">Fonctionnalité Premium</h3>
        <p className="font-mono text-sm text-white/50 mb-1">
          <span className="text-white/80">{featureName}</span> est disponible à partir du pack{' '}
          <span style={{ color: ORANGE }} className="font-semibold">{PLAN_LABELS[requiredPlan]}</span>.
        </p>
        <p className="font-mono text-xs text-white/30 mb-6">
          Achetez des tokens pour accéder à toutes les fonctionnalités du pack.
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all">
            Fermer
          </button>
          <Link href={`/${locale}/dashboard/tokens`} onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white text-center transition-all hover:opacity-90"
            style={{ background: ORANGE }}>
            Voir les packs
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Hook for gated feature buttons */
export function useFeatureGate() {
  const [gateInfo, setGateInfo] = useState<{ requiredPlan: string; featureName: string } | null>(null);

  const gate = (requiredPlan: 'STARTER' | 'BUSINESS' | 'PRO' | 'AGENCY', featureName: string) => {
    setGateInfo({ requiredPlan, featureName });
  };

  const modal = gateInfo ? (
    <UpgradeModal
      requiredPlan={gateInfo.requiredPlan as any}
      featureName={gateInfo.featureName}
      onClose={() => setGateInfo(null)}
    />
  ) : null;

  return { gate, modal };
}
