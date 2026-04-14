'use client';
import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from './sidebar';
import { DashboardNavbar } from './navbar';
import { X, LayoutDashboard, MessageSquare, Settings2, Package, ShoppingCart } from 'lucide-react';

const ORANGE = '#FF6B2C';

export function DashboardShell({ children, planLevel = 'FREE' }: { children: React.ReactNode; planLevel?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;

  const bottomNavItems = [
    { href: `/${locale}/dashboard`, label: 'Home', icon: LayoutDashboard, exact: true },
    { href: `/${locale}/dashboard/conversations`, label: 'Messages', icon: MessageSquare },
    { href: `/${locale}/dashboard/orders`, label: 'Commandes', icon: ShoppingCart },
    { href: `/${locale}/dashboard/products`, label: 'Produits', icon: Package },
    { href: `/${locale}/dashboard/bot-settings`, label: 'Bot', icon: Settings2 },
  ];

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-[#080810] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar planLevel={planLevel} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar panel */}
          <div className="absolute left-0 top-0 h-full z-50 flex">
            <Sidebar planLevel={planLevel} onClose={() => setSidebarOpen(false)} />
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-[-44px] w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D0D10] border-t border-white/[0.06] flex items-center justify-around px-2 h-16">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all"
            >
              <Icon
                className="w-5 h-5"
                style={{ color: isActive ? ORANGE : 'rgba(255,255,255,0.35)' }}
              />
              <span
                className="font-mono text-[9px] font-medium"
                style={{ color: isActive ? ORANGE : 'rgba(255,255,255,0.3)' }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
