import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Calculator, TrendingUp, TrendingDown, Euro, Zap, Mic, MessageSquare, Wallet } from 'lucide-react';
import AccountingControls from '@/components/admin/accounting-controls';

const ORANGE = '#FF6B2C';

// Taux de change : 1 EUR = 285 DA
const DZD_TO_EUR = 1 / 285;
const EUR_TO_DZD = 285;

function eurToDzd(eur: number) { return eur * EUR_TO_DZD; }
function dzdToEur(dzd: number) { return dzd * DZD_TO_EUR; }

export default async function AdminAccountingPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect(`/${locale}/dashboard`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Revenus : achats réels (PURCHASE) + packs offerts par admin (PACK_GRANT avec pricePaid)
  // EXCLUS : TRIAL, ADMIN_GRANT, BONUS, PROMO → comptés comme dépenses internes
  const REVENUE_TYPES = ['PURCHASE', 'PACK_GRANT'] as const;

  const [
    allPurchases,
    monthPurchases,
    lastMonthPurchases,
    allCostLogs,
    monthCostLogs,
    textMessages,
    voiceMessages,
    monthTextMessages,
    monthVoiceMessages,
    // Dépenses internes (tokens offerts sans pricePaid)
    trialCount,
    adminGrantCount,
  ] = await Promise.all([
    prisma.tokenTransaction.findMany({
      where: { type: { in: REVENUE_TYPES as any }, pricePaid: { gt: 0 } },
      select: { pricePaid: true, createdAt: true, type: true },
    }),
    prisma.tokenTransaction.findMany({
      where: { type: { in: REVENUE_TYPES as any }, pricePaid: { gt: 0 }, createdAt: { gte: monthStart } },
      select: { pricePaid: true, type: true },
    }),
    prisma.tokenTransaction.findMany({
      where: { type: { in: REVENUE_TYPES as any }, pricePaid: { gt: 0 }, createdAt: { gte: lastMonthStart, lt: monthStart } },
      select: { pricePaid: true },
    }),
    // Logs de coûts API
    prisma.costLog.findMany({ select: { type: true, estimatedCost: true } }),
    prisma.costLog.findMany({ where: { createdAt: { gte: monthStart } }, select: { type: true, estimatedCost: true } }),
    // Messages
    prisma.message.count({ where: { direction: 'inbound', type: 'text' } }),
    prisma.message.count({ where: { direction: 'inbound', type: 'voice' } }),
    prisma.message.count({ where: { direction: 'inbound', type: 'text', createdAt: { gte: monthStart } } }),
    prisma.message.count({ where: { direction: 'inbound', type: 'voice', createdAt: { gte: monthStart } } }),
    // Dépenses internes (tokens offerts sans contrepartie financière)
    prisma.tokenTransaction.aggregate({ where: { type: 'TRIAL' }, _sum: { amount: true } }),
    prisma.tokenTransaction.aggregate({ where: { type: { in: ['ADMIN_GRANT', 'BONUS', 'PROMO'] as any } }, _sum: { amount: true } }),
  ]);

  // Calculs revenus DZD
  const totalRevenueDZD = allPurchases.reduce((a, p) => a + (p.pricePaid || 0), 0);
  const monthRevenueDZD = monthPurchases.reduce((a, p) => a + (p.pricePaid || 0), 0);
  const lastMonthRevenueDZD = lastMonthPurchases.reduce((a, p) => a + (p.pricePaid || 0), 0);
  const revenueGrowth = lastMonthRevenueDZD > 0
    ? ((monthRevenueDZD - lastMonthRevenueDZD) / lastMonthRevenueDZD) * 100
    : 0;

  // Coûts API (en USD depuis logs → convertis en EUR → en DA)
  // 1 USD ≈ 0.92 EUR, 1 EUR = 285 DA
  const USD_TO_EUR = 0.92;
  const totalCostUSD = allCostLogs.reduce((a, c) => a + c.estimatedCost, 0);
  const monthCostUSD = monthCostLogs.reduce((a, c) => a + c.estimatedCost, 0);

  const estimatedTotalCostEUR = (allCostLogs.length > 0
    ? totalCostUSD
    : textMessages * 0.000154 + voiceMessages * (0.003 + 0.000154)) * USD_TO_EUR;
  const estimatedMonthCostEUR = (monthCostLogs.length > 0
    ? monthCostUSD
    : monthTextMessages * 0.000154 + monthVoiceMessages * (0.003 + 0.000154)) * USD_TO_EUR;

  const totalCostDZD = eurToDzd(estimatedTotalCostEUR);
  const monthCostDZD = eurToDzd(estimatedMonthCostEUR);

  // Dépenses internes (tokens non achetés, offerts gratuitement)
  const trialTokens = trialCount._sum.amount || 0;
  const grantedTokens = adminGrantCount._sum.amount || 0;
  // Coût théorique : tokens offerts × prix moyen Starter (5 DA/token)
  const AVG_TOKEN_PRICE = 5; // DA
  const internalCostDZD = (trialTokens + grantedTokens) * AVG_TOKEN_PRICE;

  const totalProfitDZD = totalRevenueDZD - totalCostDZD - internalCostDZD;
  const monthProfitDZD = monthRevenueDZD - monthCostDZD;
  const marginPercent = monthRevenueDZD > 0 ? (monthProfitDZD / monthRevenueDZD) * 100 : 0;

  // Pack grants (comptés comme revenu)
  const packGrantRevenueDZD = allPurchases
    .filter((p: any) => p.type === 'PACK_GRANT')
    .reduce((a: number, p: any) => a + (p.pricePaid || 0), 0);
  const realPurchaseRevenueDZD = allPurchases
    .filter((p: any) => p.type === 'PURCHASE')
    .reduce((a: number, p: any) => a + (p.pricePaid || 0), 0);

  // Coûts par type
  const deepseekCostUSD = (allCostLogs.length > 0
    ? allCostLogs.filter(c => c.type.startsWith('deepseek')).reduce((a, c) => a + c.estimatedCost, 0)
    : textMessages * 0.000154 + voiceMessages * 0.000154);
  const whisperCostUSD = (allCostLogs.length > 0
    ? allCostLogs.filter(c => c.type === 'whisper').reduce((a, c) => a + c.estimatedCost, 0)
    : voiceMessages * 0.003);

  // Soldes API restants
  let deepseekBalance: number | null = null;
  let openaiBalance: number | null = null;
  try {
    const dsRes = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      cache: 'no-store',
    });
    if (dsRes.ok) {
      const dsJson = await dsRes.json();
      deepseekBalance = dsJson?.balance_infos?.[0]?.total_balance ?? dsJson?.balance ?? null;
    }
  } catch {}
  // OpenAI doesn't have a public balance API — estimated from spend
  const openaiEstimatedSpendUSD = whisperCostUSD;

  // Historique mensuel (6 derniers mois)
  const months: { label: string; revDZD: number; costDZD: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = start.toLocaleDateString('fr-DZ', { month: 'short', year: '2-digit' });
    const rev = allPurchases.filter(p => {
      const d = new Date(p.createdAt);
      return d >= start && d < end;
    }).reduce((a, p) => a + (p.pricePaid || 0), 0);
    const msgs = monthTextMessages; // simplifié
    months.push({ label, revDZD: rev, costDZD: 0 });
  }

  const maxRev = Math.max(...months.map(m => m.revDZD), 1);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white flex items-center gap-3">
          <Calculator className="w-6 h-6" style={{ color: ORANGE }} />
          Comptabilité
        </h1>
        <p className="text-white/30 text-sm mt-1 font-mono">
          Revenus, coûts API et marges — données en temps réel
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Revenus (mois)',
            value: `${monthRevenueDZD.toLocaleString('fr-DZ')} DA`,
            sub: revenueGrowth > 0 ? `+${revenueGrowth.toFixed(0)}% vs mois dernier` : revenueGrowth < 0 ? `${revenueGrowth.toFixed(0)}% vs mois dernier` : 'Premier mois',
            icon: TrendingUp,
            color: '#10B981',
            up: revenueGrowth >= 0,
          },
          {
            label: 'Coûts API (mois)',
            value: `${monthCostDZD.toLocaleString('fr-DZ', { maximumFractionDigits: 0 })} DA`,
            sub: `≈ €${estimatedMonthCostEUR.toFixed(4)}`,
            icon: TrendingDown,
            color: '#EF4444',
            up: false,
          },
          {
            label: 'Bénéfice net (mois)',
            value: `${monthProfitDZD.toLocaleString('fr-DZ', { maximumFractionDigits: 0 })} DA`,
            sub: `Marge ${marginPercent.toFixed(1)}%`,
            icon: Euro,
            color: marginPercent > 50 ? '#10B981' : marginPercent > 20 ? ORANGE : '#EF4444',
            up: monthProfitDZD > 0,
          },
          {
            label: 'Revenus total',
            value: `${totalRevenueDZD.toLocaleString('fr-DZ')} DA`,
            sub: `Coûts: ${totalCostDZD.toLocaleString('fr-DZ', { maximumFractionDigits: 0 })} DA`,
            icon: Calculator,
            color: ORANGE,
            up: true,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs text-white/40">{card.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
              </div>
              <p className="font-mono text-xl font-bold text-white">{card.value}</p>
              <p className="font-mono text-xs mt-1" style={{ color: card.up ? '#10B981' : 'rgba(255,255,255,0.3)' }}>
                {card.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Revenus : réels vs packs offerts + dépenses internes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Achats réels */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="font-mono text-xs text-white/40 mb-1 uppercase tracking-wider">Achats clients (réels)</p>
          <p className="font-mono text-2xl font-bold text-white">{realPurchaseRevenueDZD.toLocaleString('fr-DZ')} <span className="text-sm text-white/30">DA</span></p>
          <p className="font-mono text-xs text-white/30 mt-1">Paiements CIB / Dahabiya / CCP</p>
          <div className="mt-3 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: totalRevenueDZD > 0 ? `${(realPurchaseRevenueDZD / totalRevenueDZD) * 100}%` : '0%' }} />
          </div>
        </div>
        {/* Packs offerts (comptés comme revenu) */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="font-mono text-xs text-white/40 mb-1 uppercase tracking-wider">Packs admin (revenus)</p>
          <p className="font-mono text-2xl font-bold text-white">{packGrantRevenueDZD.toLocaleString('fr-DZ')} <span className="text-sm text-white/30">DA</span></p>
          <p className="font-mono text-xs text-white/30 mt-1">Packs offerts → comptés en CA</p>
          <div className="mt-3 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: totalRevenueDZD > 0 ? `${(packGrantRevenueDZD / totalRevenueDZD) * 100}%` : '0%', background: ORANGE }} />
          </div>
        </div>
        {/* Dépenses internes */}
        <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-5">
          <p className="font-mono text-xs text-red-400/60 mb-1 uppercase tracking-wider">Dépenses internes</p>
          <p className="font-mono text-2xl font-bold text-white">{internalCostDZD.toLocaleString('fr-DZ')} <span className="text-sm text-white/30">DA*</span></p>
          <div className="mt-2 space-y-1">
            <p className="font-mono text-xs text-white/30">Essais gratuits : {trialTokens.toLocaleString()} tokens</p>
            <p className="font-mono text-xs text-white/30">Offerts (admin/bonus) : {grantedTokens.toLocaleString()} tokens</p>
          </div>
          <p className="font-mono text-[10px] text-white/20 mt-2">* Estimé à {AVG_TOKEN_PRICE} DA/token (coût d&apos;opportunité)</p>
        </div>
      </div>

      {/* Coûts par service */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Breakdown coûts API */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="font-mono font-bold text-white mb-5 flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: ORANGE }} />
            Coûts API (total)
          </h2>
          <div className="space-y-4">
            {[
              {
                label: 'DeepSeek (texte + vocal)',
                costEUR: deepseekCostUSD * USD_TO_EUR,
                count: textMessages + voiceMessages,
                unit: 'messages IA',
                color: '#8B5CF6',
                icon: MessageSquare,
              },
              {
                label: 'OpenAI Whisper (transcription)',
                costEUR: whisperCostUSD * USD_TO_EUR,
                count: voiceMessages,
                unit: 'messages vocaux',
                color: '#3B82F6',
                icon: Mic,
              },
            ].map((item) => {
              const Icon = item.icon;
              const totalCostSum = (deepseekCostUSD + whisperCostUSD) * USD_TO_EUR || 1;
              const pct = (item.costEUR / totalCostSum) * 100;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                      <span className="font-mono text-sm text-white/70">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-white">€{item.costEUR.toFixed(4)}</p>
                      <p className="font-mono text-[10px] text-white/30">{eurToDzd(item.costEUR).toLocaleString('fr-DZ', { maximumFractionDigits: 0 })} DA</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                  </div>
                  <p className="font-mono text-[10px] text-white/20 mt-1">{item.count.toLocaleString()} {item.unit}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-white/40">Total coûts API</span>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-white">€{estimatedTotalCostEUR.toFixed(4)}</p>
                <p className="font-mono text-[10px] text-white/30">≈ {totalCostDZD.toLocaleString('fr-DZ', { maximumFractionDigits: 0 })} DA</p>
              </div>
            </div>
            {allCostLogs.length === 0 && (
              <p className="font-mono text-[10px] text-yellow-400/60 mt-2">
                ⚠️ Coûts estimés (les logs démarrent dès maintenant)
              </p>
            )}
          </div>
        </div>

        {/* Stats messages */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="font-mono font-bold text-white mb-5 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{ color: ORANGE }} />
            Volume de messages
          </h2>
          <div className="space-y-5">
            {[
              { label: 'Messages texte (total)', value: textMessages, month: monthTextMessages, color: '#8B5CF6' },
              { label: 'Messages vocaux (total)', value: voiceMessages, month: monthVoiceMessages, color: '#3B82F6' },
              { label: 'Total messages', value: textMessages + voiceMessages, month: monthTextMessages + monthVoiceMessages, color: ORANGE },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-white/70">{s.label}</p>
                  <p className="font-mono text-[10px] text-white/30">Ce mois: {s.month.toLocaleString()}</p>
                </div>
                <span className="font-mono text-xl font-bold" style={{ color: s.color }}>
                  {s.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-2">
            <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider">Coût unitaire estimé</p>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/40">1 message texte</span>
              <span className="text-white/60">€0.000142 ≈ 0.04 DA</span>
            </div>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/40">1 message vocal</span>
              <span className="text-white/60">€0.0029 ≈ 0.83 DA</span>
            </div>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-white/40">1 token vendu (Starter)</span>
              <span style={{ color: ORANGE }}>5 DA → bénéfice ~4.57 DA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau récapitulatif marge par pack */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="font-mono font-bold text-white mb-5">Analyse de marge par pack</h2>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Pack', 'Prix (DA)', 'Tokens', 'Prix/token', 'Coût API/token', 'Marge/token', 'Marge %'].map(h => (
                  <th key={h} className="text-left pb-3 text-xs text-white/30 font-normal uppercase tracking-wider pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[
                { name: 'Starter', price: 2500, tokens: 500 },
                { name: 'Business', price: 5000, tokens: 2000 },
                { name: 'Pro', price: 10000, tokens: 5000 },
                { name: 'Agency', price: 22000, tokens: 15000 },
              ].map(pack => {
                const pricePerToken = pack.price / pack.tokens;
                const costPerTokenDZD = eurToDzd(0.000154 * USD_TO_EUR); // coût DeepSeek par token consommé (USD→EUR→DA)
                const marginPerToken = pricePerToken - costPerTokenDZD;
                const marginPct = (marginPerToken / pricePerToken) * 100;
                return (
                  <tr key={pack.name}>
                    <td className="py-3 text-white font-semibold pr-6">{pack.name}</td>
                    <td className="py-3 text-white/70 pr-6">{pack.price.toLocaleString('fr-DZ')}</td>
                    <td className="py-3 text-white/70 pr-6">{pack.tokens.toLocaleString()}</td>
                    <td className="py-3 pr-6" style={{ color: ORANGE }}>{pricePerToken.toFixed(1)} DA</td>
                    <td className="py-3 text-white/40 pr-6">{costPerTokenDZD.toFixed(4)} DA</td>
                    <td className="py-3 text-green-400 pr-6">{marginPerToken.toFixed(2)} DA</td>
                    <td className="py-3 pr-6">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#10B98115', color: '#10B981' }}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[10px] text-white/20 mt-3">
          * Coût API estimé à €0.000142/message texte DeepSeek. Ne prend pas en compte les coûts d'infrastructure (Railway, Supabase). Taux : 1 EUR = 285 DA.
        </p>
      </div>

      {/* Soldes API restants */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="font-mono font-bold text-white mb-5 flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: ORANGE }} />
          Soldes API restants
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DeepSeek */}
          <div className="rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <p className="font-mono text-xs text-white/50 uppercase tracking-wider">DeepSeek</p>
            </div>
            {deepseekBalance !== null ? (
              <>
                <p className="font-mono text-2xl font-bold text-white">
                  ${Number(deepseekBalance).toFixed(4)}
                </p>
                <p className="font-mono text-xs text-white/30 mt-1">
                  ≈ {eurToDzd(Number(deepseekBalance) * 0.92).toLocaleString('fr-DZ', { maximumFractionDigits: 0 })} DA
                </p>
              </>
            ) : (
              <p className="font-mono text-sm text-white/30">Indisponible (vérifier la clé API)</p>
            )}
          </div>
          {/* OpenAI */}
          <div className="rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <p className="font-mono text-xs text-white/50 uppercase tracking-wider">OpenAI (Whisper)</p>
            </div>
            <p className="font-mono text-sm text-white/50">
              Dépenses estimées : <span className="text-white font-bold">${openaiEstimatedSpendUSD.toFixed(4)}</span>
            </p>
            <p className="font-mono text-[10px] text-white/20 mt-1">
              OpenAI ne fournit pas d&apos;API de solde publique. Consultez platform.openai.com/usage.
            </p>
          </div>
        </div>
      </div>

      {/* Réinitialisation des coûts */}
      <AccountingControls />
    </div>
  );
}
