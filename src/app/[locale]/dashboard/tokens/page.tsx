'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  Coins, Loader2, ShoppingCart, Tag, CheckCircle, Zap,
  CreditCard, Building2, Copy, MessageCircle, Clock,
  ArrowUpRight, ArrowDownLeft, Gift,
} from 'lucide-react';

const ORANGE = '#FF6B2C';
const CCP_NUMBER = '00799999004399346548';
const WHATSAPP_NUMBER = '+33761179379';

const TX_ICONS: Record<string, React.ElementType> = {
  PURCHASE: CreditCard,
  USAGE: ArrowUpRight,
  TRIAL: Gift,
  ADMIN_GRANT: Gift,
  BONUS: Gift,
  REFUND: ArrowDownLeft,
};

const TX_COLORS: Record<string, string> = {
  PURCHASE: '#10B981',
  USAGE: '#EF4444',
  TRIAL: ORANGE,
  ADMIN_GRANT: '#8B5CF6',
  BONUS: '#8B5CF6',
  REFUND: '#10B981',
};

export default function TokensPage() {
  const t = useTranslations('tokens');
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [packages, setPackages] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [unlimited, setUnlimited] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'chargily' | 'ccp'>('chargily');
  const [copied, setCopied] = useState(false);

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
    const [pkgRes, userRes, txRes] = await Promise.all([
      fetch('/api/tokens/packages'),
      fetch('/api/user/me'),
      fetch('/api/user/transactions'),
    ]);
    const [pkgs, user, txs] = await Promise.all([pkgRes.json(), userRes.json(), txRes.ok ? txRes.json() : []]);
    setPackages(Array.isArray(pkgs) ? pkgs : []);
    setBalance(user.tokenBalance || 0);
    setUnlimited(user.unlimitedTokens || false);
    setTransactions(Array.isArray(txs) ? txs : []);
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

  const copyCCP = () => {
    navigator.clipboard.writeText(CCP_NUMBER).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendReceipt = () => {
    const msg = encodeURIComponent(
      `Bonjour, je viens d'effectuer un versement CCP pour acheter des tokens YelhaDms.\n\nNuméro CCP : ${CCP_NUMBER}\n\nMerci de valider mon compte.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Tokens & Paiement</h1>
        <p className="text-white/40 text-sm mt-1 font-mono">Rechargez votre compte et consultez votre historique</p>
      </div>

      {/* Balance card */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5 border border-white/[0.06]"
        style={{ background: `linear-gradient(135deg, ${ORANGE}18 0%, #1a0a00 100%)` }}
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${ORANGE}25` }}>
          <Coins className="w-8 h-8" style={{ color: ORANGE }} />
        </div>
        <div>
          <p className="text-white/50 text-sm font-mono">{t('balance')}</p>
          <p className="text-4xl font-bold font-mono text-white mt-0.5">
            {unlimited ? '∞' : balance.toLocaleString()}
          </p>
          <p className="text-white/30 text-xs mt-1">{unlimited ? 'Tokens illimités' : 'tokens disponibles'}</p>
        </div>
      </div>

      {/* Buy tokens section */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: ORANGE }} />
            <h2 className="font-mono font-semibold text-white text-sm uppercase tracking-wider">Acheter des tokens</h2>
          </div>

          {/* Payment method tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
            <button
              onClick={() => setPaymentTab('chargily')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all"
              style={paymentTab === 'chargily'
                ? { background: `${ORANGE}25`, color: ORANGE }
                : { color: 'rgba(255,255,255,0.4)' }}
            >
              <CreditCard className="w-3.5 h-3.5" />
              CIB / Dahabiya
            </button>
            <button
              onClick={() => setPaymentTab('ccp')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all"
              style={paymentTab === 'ccp'
                ? { background: '#3B82F625', color: '#3B82F6' }
                : { color: 'rgba(255,255,255,0.4)' }}
            >
              <Building2 className="w-3.5 h-3.5" />
              Versement CCP
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* ChargiliPay packages */}
          {paymentTab === 'chargily' && (
            <>
              <p className="font-mono text-xs text-white/30 mb-4 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Paiement sécurisé via Chargily ePay — CIB & Dahabiya acceptés
              </p>
              {packages.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-white/30 font-mono text-sm">Aucun forfait disponible pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {packages.map((pkg: any) => (
                    <div
                      key={pkg.id}
                      className="rounded-xl border flex flex-col overflow-hidden"
                      style={{
                        borderColor: pkg.isFeatured ? `${ORANGE}60` : 'rgba(255,255,255,0.06)',
                        background: pkg.isFeatured ? `${ORANGE}08` : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      {pkg.isFeatured && (
                        <div className="text-[10px] font-mono font-bold text-center py-1.5 text-white tracking-wider uppercase" style={{ background: ORANGE }}>
                          ★ Populaire
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <p className="font-mono font-bold text-white text-sm">{pkg.name}</p>
                        <p className="text-white/40 text-xs mt-0.5">{pkg.tokens.toLocaleString()} tokens</p>
                        <p className="text-2xl font-bold font-mono mt-3 mb-4" style={{ color: pkg.isFeatured ? ORANGE : 'white' }}>
                          {pkg.price.toLocaleString('fr-FR')} <span className="text-sm font-normal text-white/40">DA</span>
                        </p>
                        <button
                          onClick={() => handlePurchase(pkg.id)}
                          disabled={!!loadingPkg}
                          className="mt-auto w-full flex items-center justify-center gap-1.5 font-mono text-xs py-2.5 rounded-lg transition-all hover:opacity-90 disabled:opacity-40"
                          style={pkg.isFeatured
                            ? { background: ORANGE, color: '#fff' }
                            : { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          {loadingPkg === pkg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                          Payer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CCP transfer */}
          {paymentTab === 'ccp' && (
            <div className="space-y-5">
              <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-xl p-4">
                <p className="font-mono text-xs text-blue-300/80 leading-relaxed">
                  Effectuez un versement CCP au numéro ci-dessous, puis envoyez votre reçu via WhatsApp.
                  Votre compte sera crédité dans les <strong>24h ouvrées</strong>.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {[
                  {
                    n: '01',
                    title: 'Choisissez votre pack',
                    desc: 'Starter 2 500 DA · Business 5 000 DA · Pro 10 000 DA · Agency 22 000 DA',
                  },
                  {
                    n: '02',
                    title: 'Versez au numéro CCP',
                    desc: null,
                    ccp: true,
                  },
                  {
                    n: '03',
                    title: 'Envoyez le reçu de versement',
                    desc: 'Envoyez une photo de votre reçu sur WhatsApp avec votre email YelhaDms.',
                    whatsapp: true,
                  },
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold text-white flex-shrink-0"
                      style={{ background: '#3B82F625', border: '1px solid #3B82F630', color: '#3B82F6' }}
                    >
                      {step.n}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-semibold text-white">{step.title}</p>
                      {step.desc && <p className="font-mono text-xs text-white/40 mt-1">{step.desc}</p>}

                      {step.ccp && (
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className="flex-1 px-3 py-2 rounded-lg font-mono text-sm font-bold text-white border"
                            style={{ background: '#3B82F615', borderColor: '#3B82F630', letterSpacing: '0.05em' }}
                          >
                            {CCP_NUMBER}
                          </div>
                          <button
                            onClick={copyCCP}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all"
                            style={copied
                              ? { background: '#10B98120', color: '#10B981' }
                              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                          >
                            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copié !' : 'Copier'}
                          </button>
                        </div>
                      )}

                      {step.whatsapp && (
                        <button
                          onClick={sendReceipt}
                          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all hover:opacity-90"
                          style={{ background: '#25D36620', color: '#25D366', border: '1px solid #25D36630' }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Envoyer le reçu de versement
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Promo code */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4" style={{ color: ORANGE }} />
          <h2 className="font-mono font-semibold text-white text-sm">Code promo</h2>
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
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handlePromoApply()}
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

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/30" />
            <h2 className="font-mono font-semibold text-white text-sm">Historique</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {transactions.map((tx: any) => {
              const Icon = TX_ICONS[tx.type] || Coins;
              const color = TX_COLORS[tx.type] || ORANGE;
              const isDebit = tx.amount < 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-white/70 truncate">{tx.description || tx.type}</p>
                    <p className="font-mono text-[10px] text-white/25 mt-0.5" suppressHydrationWarning>
                      {new Date(tx.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold" style={{ color: isDebit ? '#EF4444' : '#10B981' }}>
                      {isDebit ? '' : '+'}{tx.amount.toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-white/25">solde: {tx.balance.toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
