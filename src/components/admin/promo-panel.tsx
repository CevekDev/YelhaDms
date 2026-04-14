'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, Loader2, X, Shuffle, Percent, Coins } from 'lucide-react';
// Note: Percent and Coins kept for the promo code list display

const PURPLE = '#a78bfa';

interface PromoCode {
  id: string;
  code: string;
  tokens: number;
  discountPercent?: number | null;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date | string | null;
  description: string | null;
  _count: { uses: number };
}

function generateCode(prefix = 'YELHA') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${suffix}`;
}

export default function AdminPromoPanel({ initialCodes }: { initialCodes: PromoCode[] }) {
  const { toast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '',          // generated client-side only (avoid Math.random() SSR mismatch)
    tokens: '100',
    maxUses: '1',
    expiresAt: '',
    description: '',
  });

  // Generate initial code only on the client to avoid hydration mismatch
  useEffect(() => {
    setForm(f => ({ ...f, code: generateCode() }));
  }, []);

  const inputClass =
    'w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#a78bfa]/40 transition-colors';

  const refreshCodes = async () => {
    const res = await fetch('/api/admin/promo-codes');
    const data = await res.json();
    setCodes(data);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload: any = {
        code: form.code.toUpperCase(),
        tokens: Number(form.tokens),
        maxUses: Number(form.maxUses),
        expiresAt: form.expiresAt || undefined,
        description: form.description || undefined,
      };

      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        toast({ title: `✅ Code promo "${form.code}" créé !` });
        setShowForm(false);
        setForm({ code: generateCode(), tokens: '100', maxUses: '1', expiresAt: '', description: '' });
        await refreshCodes();
      } else {
        toast({ title: 'Erreur', description: json.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string, code: string) => {
    await fetch('/api/admin/promo-codes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    toast({ title: `Code "${code}" désactivé` });
    await refreshCodes();
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${PURPLE}20` }}>
            <Tag className="w-4 h-4" style={{ color: PURPLE }} />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Codes promo ({codes.length})</h2>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 font-mono text-xs text-white px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau code
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Create form */}
        {showForm && (
          <div
            className="rounded-xl p-4 space-y-4 border"
            style={{ background: `${PURPLE}08`, borderColor: `${PURPLE}25` }}
          >
            <h3 className="font-mono font-semibold text-sm" style={{ color: PURPLE }}>Créer un code promo</h3>


            <div className="grid grid-cols-2 gap-3">
              {/* Code */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-white/40 font-mono">Code</label>
                <div className="flex gap-1.5 mt-1">
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="YELHA-XXXXX"
                    className={inputClass}
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, code: generateCode() }))}
                    title="Générer"
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.10] transition-colors flex-shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-white/50" />
                  </button>
                </div>
              </div>

              {/* Tokens */}
              <div>
                <label className="text-xs text-white/40 font-mono">Tokens offerts</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={form.tokens}
                    onChange={e => setForm(f => ({ ...f, tokens: e.target.value }))}
                    min={1}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Max uses */}
              <div>
                <label className="text-xs text-white/40 font-mono">Utilisations max</label>
                <input
                  type="number"
                  value={form.maxUses}
                  onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                  min={1}
                  className={inputClass + ' mt-1'}
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="text-xs text-white/40 font-mono">Date d&apos;expiration</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className={inputClass + ' mt-1'}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-white/40 font-mono">Description (optionnel)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Offre lancement, -20% été..."
                className={inputClass + ' mt-1'}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={loading || !form.code}
                className="flex items-center gap-2 font-mono text-sm text-white px-4 py-2 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: PURPLE }}
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                Créer le code
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="font-mono text-sm text-white/40 hover:text-white/70 px-4 py-2 rounded-xl transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Codes list */}
        <div className="space-y-2">
          {codes.length === 0 && (
            <p className="text-center text-white/20 text-sm py-8 font-mono">Aucun code promo créé</p>
          )}
          {codes.map(code => {
            const expiresDate = code.expiresAt ? new Date(code.expiresAt as string) : null;
            const isExpired = expiresDate && expiresDate < new Date();
            const isDiscount = (code.discountPercent ?? 0) > 0;
            return (
              <div
                key={code.id}
                className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/[0.05] bg-white/[0.02]"
                style={{ opacity: !code.isActive ? 0.45 : 1 }}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-white">{code.code}</span>
                    {!code.isActive && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.08] text-white/40">Désactivé</span>
                    )}
                    {isExpired && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400">Expiré</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {isDiscount ? (
                      <span className="text-xs font-mono flex items-center gap-1" style={{ color: PURPLE }}>
                        <Percent className="w-3 h-3" />
                        -{code.discountPercent}% de réduction
                      </span>
                    ) : (
                      <span className="text-xs font-mono flex items-center gap-1" style={{ color: PURPLE }}>
                        <Coins className="w-3 h-3" />
                        +{code.tokens} tokens
                      </span>
                    )}
                    <span className="text-xs text-white/30 font-mono">
                      {code._count.uses}/{code.maxUses} utilisations
                    </span>
                    {expiresDate && !isExpired && (
                      <span className="text-xs text-white/20 font-mono" suppressHydrationWarning>
                        Expire le {expiresDate.toLocaleDateString('fr-DZ')}
                      </span>
                    )}
                    {code.description && (
                      <span className="text-xs text-white/20 italic">{code.description}</span>
                    )}
                  </div>
                </div>
                {code.isActive && (
                  <button
                    onClick={() => handleDeactivate(code.id, code.code)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Désactiver"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
