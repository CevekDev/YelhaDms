'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Tag, Settings,
  LogOut, Bot, Shield, BarChart3, Calculator,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

const ORANGE = '#FF6B2C';

export function AdminSidebar() {
  const t = useTranslations('admin');
  const tNav = useTranslations('nav');
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const { data: session } = useSession();

  const navItems = [
    { href: `/${locale}/admin`, label: t('overview'), icon: LayoutDashboard, exact: true },
    { href: `/${locale}/admin/users`, label: t('users'), icon: Users, exact: false },
    { href: `/${locale}/admin/accounting`, label: t('accounting'), icon: Calculator, exact: false },
    { href: `/${locale}/admin/promo`, label: t('promoCodes'), icon: Tag, exact: false },
    { href: `/${locale}/admin/settings`, label: t('settings'), icon: Settings, exact: false },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r border-white/[0.06]" style={{ background: '#0A0A10' }}>
      {/* Logo + badge ADMIN */}
      <div className="flex h-16 items-center px-5 border-b border-white/[0.06] flex-shrink-0 gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: ORANGE }}
        >
          <Bot className="w-5 h-5 text-white" />
        </div>
        <span className="font-mono font-bold text-white text-lg flex-1">YelhaDms</span>
        <span
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md tracking-wider"
          style={{ background: `${ORANGE}25`, color: ORANGE }}
        >
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
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
            </Link>
          );
        })}

        {/* Séparateur — accès espace client */}
        <div className="pt-3 mt-3 border-t border-white/[0.04]">
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span>{tNav('dashboard')}</span>
          </Link>
        </div>
      </nav>

      {/* User info + déconnexion */}
      <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
        <div className="px-3 mb-2 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ORANGE }} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">
              {session?.user.name || 'Administrateur'}
            </p>
            <p className="text-xs text-white/30 truncate">{session?.user.email}</p>
          </div>
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
