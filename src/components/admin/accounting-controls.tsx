'use client';
import { useState } from 'react';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';

const ORANGE = '#FF6B2C';

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week',  label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'all',   label: 'Tout' },
] as const;

export default function AccountingControls() {
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reset = async (period: string) => {
    if (!confirm(`Supprimer les logs de coûts API pour : ${period} ?`)) return;
    setLoading(period);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/reset-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ ${json.deleted} entrée(s) supprimée(s)`);
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg(`❌ Erreur: ${json.error}`);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
          <Trash2 className="w-4 h-4" style={{ color: ORANGE }} />
        </div>
        <h2 className="font-mono font-bold text-white text-sm">Réinitialiser les coûts API</h2>
        <span className="ml-auto text-[10px] font-mono text-white/20 border border-white/[0.06] px-2 py-0.5 rounded-full">
          Supprime les CostLogs uniquement
        </span>
      </div>
      <p className="font-mono text-xs text-white/30 mb-4">
        Efface les enregistrements de coûts API pour la période sélectionnée. Les revenus ne sont pas affectés.
      </p>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => reset(p.key)}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border border-white/[0.08] text-white/50 hover:border-red-500/40 hover:text-red-400 transition-all disabled:opacity-40"
          >
            {loading === p.key
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />
            }
            {p.label}
          </button>
        ))}
      </div>
      {msg && (
        <p className="font-mono text-xs mt-3" style={{ color: msg.startsWith('✅') ? '#10B981' : '#EF4444' }}>
          {msg}
        </p>
      )}
    </div>
  );
}
