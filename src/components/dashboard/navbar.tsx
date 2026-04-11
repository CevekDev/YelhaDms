'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Coins, ShoppingCart, Menu } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useEffect, useState } from 'react';

const ORANGE = '#FF6B2C';

interface DashboardNavbarProps {
  onMenuClick?: () => void;
}

export function DashboardNavbar({ onMenuClick }: DashboardNavbarProps) {
  const params = useParams();
  const locale = params.locale as string;
  const [balance, setBalance] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(u => {
        setBalance(u.tokenBalance ?? 0);
        setUnlimited(u.unlimitedTokens ?? false);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="h-14 lg:h-16 border-b border-white/[0.06] bg-[#0D0D10] flex items-center px-4 gap-3 justify-between lg:justify-end flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Logo on mobile */}
      <div className="lg:hidden flex-1">
        <span className="font-mono font-bold text-white text-base">
          YelhaDms<span style={{ color: ORANGE }}>.</span>
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Token balance */}
        <div className="flex items-center gap-1.5 lg:gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-2.5 lg:px-3.5 py-2">
          <Coins className="w-3.5 h-3.5 lg:w-4 lg:h-4" style={{ color: ORANGE }} />
          <span className="font-mono text-xs lg:text-sm font-semibold text-white">
            {unlimited ? '∞' : (balance !== null ? balance.toLocaleString() : '...')}
          </span>
          <span className="text-white/30 text-xs font-mono hidden sm:inline">tokens</span>
        </div>

        {/* Buy tokens */}
        <Link href={`/${locale}/dashboard/tokens`}>
          <button
            className="flex items-center gap-1 lg:gap-1.5 font-mono text-xs lg:text-sm text-white px-3 lg:px-4 py-2 rounded-xl transition-all hover:opacity-90"
            style={{ background: ORANGE }}
          >
            <ShoppingCart className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
            <span className="hidden sm:inline">Acheter</span>
            <span className="sm:hidden">+</span>
          </button>
        </Link>

        <div className="hidden sm:block">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
