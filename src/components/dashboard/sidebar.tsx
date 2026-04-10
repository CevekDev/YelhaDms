'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Plug, Coins, Settings, LogOut,
  Shield, BarChart3, Bot, Users, ChevronRight,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

const ORANGE = '#FF6B2C';

export function Sidebar() {
  const t = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const { data: session } = useSession();

  const navItems = [
    { href: `/${locale}/dashboard`, label: t('overview'), icon: LayoutDashboard },
    { href: `/${locale}/dashboard/connections`, label: t('connections'), icon: Plug },
    { href: `/${locale}/dashboard/tokens`, label: t('tokens'), icon: Coins },
    { href: `/${locale}/dashboard/analytics`, label: t('analytics'), icon: BarChart3 },
    { href: `/${locale}/dashboard/settings`, label: t('settings'), icon: Settings },
  ];

  if (session?.user.role === 'ADMIN') {
    navItems.push({ href: `/${locale}/admin`, label: 'Admin', icon: Shield });
    navItems.push({ href: `/${locale}/admin/waitlist`, label: "Liste d'attente", icon: Users });
  }

  return (
    <div className="flex h-full w-64 flex-col bg-[#0D0D10] border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex h-14 lg:h-16 items-center px-5 border-b border-white/[0.06] flex-shrink-0">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: ORANGE }}
          >
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-mono font-bold text-white text-lg">Yelha</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== `/${locale}/dashboard` && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group',
                isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
              )}
              style={isActive ? { background: `${ORANGE}20`, color: ORANGE } : {}}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={isActive ? { color: ORANGE } : {}}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: ORANGE }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + signout */}
      <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
        <div className="px-3 mb-2">
          <p className="text-sm font-medium text-white/80 truncate">
            {session?.user.name || 'Utilisateur'}
          </p>
          <p className="text-xs text-white/30 truncate">{session?.user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: `/${locale}/auth/signin` })}
          className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {tNav('signOut')}
        </button>
      </div>
    </div>
  );
}
