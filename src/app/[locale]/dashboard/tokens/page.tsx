'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Coins, Loader2, ShoppingCart, Tag, CheckCircle, Zap } from 'lucide-react';

const ORANGE = '#FF6B2C';

export default function TokensPage() {
  const t = useTranslations('tokens');
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [packages, setPackages] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [unlimited, setUnlimited] = useState(false);
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({ title: '✅ Paiement réussi !', description: 'Vos tokens ont été ajoutés à votre compte.' });
    }
    if (searchParams.get('canceled') === 'true') {
      toast({ title: 'Paiement annulé', variant: 'destructive' });
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    const [pkgRes, userRes] = await Promise.all([
      fetch('/api/tokens/packages'),
      fetch('/api/user/me'),
    ]);
    const [pkgs, user] = await Promise.all([pkgRes.json(), userRes.json()]);
    setPackages(Array.isArray(pkgs) ? pkgs : []);
    setBalance(user.tokenBalance || 0);
    setUnlimited(user.unlimitedTokens || false);
  };

  const handlePurchase = async (packageId: string) => {
    setLoadingPkg(packageId);
    try {
      const res = await fetch('/api/tokens/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, locale }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } finally {
      setLoadingPkg(null);
    }
  };

  const handlePromoApply = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await fetch('/api/promo-codes/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoApplied(true);
        setPromoCode('');
        toast({ title: `🎉 Code appliqué ! +${data.tokensAdded} tokens` });
        fetchData();
      } else {
        toast({ title: 'Code invalide', description: data.error, variant: 'destructive' });
      }
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Tokens</h1>
        <p className="text-white/40 text-sm mt-1">Gérez votre solde et achetez des tokens.</p>
      </div>

      {/* Balance card */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5 border border-white/[0.06]"
        style={{ background: `linear-gradient(135deg, ${ORANGE}18 0%, #1a0a00 100%)` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${ORANGE}25` }}
        >
          <Coins className="w-8 h-8" style={{ color: ORANGE }} />
        </div>
        <div>
          <p className="text-white/50 text-sm font-mono">{t('balance')}</p>
          <p className="text-4xl lg:text-5xl font-bold font-mono text-white mt-0.5">
            {unlimited ? '∞' : balance.toLocaleString()}
          </p>
          <p className="text-white/30 text-xs mt-1">{unlimited ? 'Tokens illimités' : 'tokens disponibles'}</p>
        </div>
      </div>

      {/* Promo code */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4" style={{ color: ORANGE }} />
          <h2 className="text-sm font-mono font-semibold text-white">Code promo</h2>
        </div>
        {promoApplied ? (
          <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
            <CheckCircle className="w-4 h-4" />
            Code appliqué avec succès !
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handlePromoApply()}
              placeholder="YELHA-XXXXXX"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6B2C]/50 transition-colors"
            />
            <button
              onClick={handlePromoApply}
              disabled={promoLoading || !promoCode.trim()}
              className="px-5 py-2.5 rounded-xl font-mono text-sm text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
              style={{ background: ORANGE }}
            >
              {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
            </button>
          </div>
        )}
      </div>

      {/* Packages */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-4 h-4" style={{ color: ORANGE }} />
          <h2 className="text-sm font-mono font-semibold text-white uppercase tracking-wider">Acheter des tokens</h2>
        </div>

        {packages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.02] py-12 text-center">
            <p className="text-white/30 font-mono text-sm">Aucun forfait disponible pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg: any) => (
              <div
                key={pkg.id}
                className="rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col"
                style={{
                  borderColor: pkg.isFeatured ? `${ORANGE}60` : 'rgba(255,255,255,0.06)',
                  background: pkg.isFeatured ? `linear-gradient(145deg, ${ORANGE}12, rgba(255,255,255,0.02))` : 'rgba(255,255,255,0.02)',
                  boxShadow: pkg.isFeatured ? `0 0 30px ${ORANGE}15` : 'none',
                }}
              >
                {pkg.isFeatured && (
                  <div
                    className="text-xs font-mono font-bold text-center py-2 text-white tracking-widest uppercase"
                    style={{ background: ORANGE }}
                  >
                    ⭐ Plus populaire
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-mono font-bold text-white text-base">{pkg.name}</p>
                      <p className="text-white/40 text-xs mt-0.5">{pkg.tokens.toLocaleString()} tokens</p>
                    </div>
                    <div
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold"
                      style={{ background: `${ORANGE}20`, color: ORANGE }}
                    >
                      {pkg.tokens.toLocaleString()}
                    </div>
                  </div>

                  <div className="mb-5">
                    <span className="text-3xl font-bold font-mono text-white">
                      {pkg.price.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-white/40 font-mono text-sm ml-1">DA</span>
                  </div>

                  <div className="mt-auto">
                    <button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={!!loadingPkg}
                      className="w-full flex items-center justify-center gap-2 font-mono text-sm py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
                      style={
                        pkg.isFeatured
                          ? { background: ORANGE, color: '#fff' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      {loadingPkg === pkg.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      {t('purchase')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info note */}
      <p className="text-white/20 text-xs font-mono text-center">
        Paiement sécurisé via Chargily ePay · DZD uniquement · Livraison immédiate
      </p>
    </div>
  );
}
