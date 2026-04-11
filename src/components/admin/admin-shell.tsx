'use client';
import { useState } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { Menu } from 'lucide-react';

const ORANGE = '#FF6B2C';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080810' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <AdminSidebar />
      </div>

      {/* Sidebar mobile (drawer) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center h-14 px-4 border-b border-white/[0.06] gap-3 flex-shrink-0"
          style={{ background: '#0A0A10' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-mono font-bold text-white flex-1">
            YelhaDms<span style={{ color: ORANGE }}>.</span>
          </span>
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
            style={{ background: `${ORANGE}25`, color: ORANGE }}
          >
            ADMIN
          </span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
