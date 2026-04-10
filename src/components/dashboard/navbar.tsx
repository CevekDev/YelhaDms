'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Coins, ShoppingCart } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const ORANGE = '#FF6B2C';

export function DashboardNavbar() {
  const params = useParams();
  const locale = params.locale as string;
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(u => {
        setBalance(u.tokenBalance ?? 0);
        setUnlimited(u.unlimitedTokens ?? false);
      });
  }, []);

  return (
    <header className="h-16 border-b border-white/[0.06] bg-[#0D0D10] flex items-center px-6 gap-4 justify-end">
      {/* Token balance */}
      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-2">
        <Coins className="w-4 h-4" style={{ color: ORANGE }} />
        <span className="font-mono text-sm font-semibold text-white">
          {unlimited ? '∞' : (balance !== null ? balance.toLocaleString() : '...')}
        </span>
        <span className="text-white/30 text-xs font-mono">tokens</span>
      </div>

      {/* Buy tokens */}
      <Link href={`/${locale}/dashboard/tokens`}>
        <button
          className="flex items-center gap-1.5 font-mono text-sm text-white px-4 py-2 rounded-xl transition-all hover:opacity-90"
          style={{ background: ORANGE }}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Acheter
        </button>
      </Link>

      <LanguageSwitcher />
    </header>
  );
}
