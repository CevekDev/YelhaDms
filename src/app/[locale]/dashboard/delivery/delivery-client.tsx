'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Truck, Settings, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const ORANGE = '#FF6B2C';

interface EcoConnection {
  id: string;
  name: string;
  platform: string;
  ecotrackUrl: string;
  ecotrackAutoShip: boolean;
}

export default function DeliveryClient({
  connections,
  locale,
}: {
  connections: EcoConnection[];
  locale: string;
}) {
  const { toast } = useToast();
  const [autoShipMap, setAutoShipMap] = useState<Record<string, boolean>>(
    Object.fromEntries(connections.map(c => [c.id, c.ecotrackAutoShip]))
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const toggleAutoShip = async (id: string, value: boolean) => {
    setLoading(l => ({ ...l, [id]: true }));
    try {
      const res = await fetch(`/api/connections/${id}/ecotrack`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoShipOnly: true, autoShip: value }),
      });
      if (res.ok) {
        setAutoShipMap(m => ({ ...m, [id]: value }));
        toast({ title: value ? '✅ Expédition automatique activée' : 'Expédition automatique désactivée' });
      } else {
        toast({ title: 'Erreur', variant: 'destructive' });
      }
    } finally {
      setLoading(l => ({ ...l, [id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {connections.map(conn => (
        <div
          key={conn.id}
          className="rounded-2xl p-5 border"
          style={{ borderColor: `${ORANGE}30`, background: `linear-gradient(135deg, ${ORANGE}06 0%, transparent 60%)` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
                <Truck className="w-5 h-5" style={{ color: ORANGE }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-semibold text-white text-sm">{conn.name}</h3>
                  <span className="text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> Connecté
                  </span>
                </div>
                <p className="font-mono text-xs text-white/30 mt-0.5">{conn.ecotrackUrl}</p>
              </div>
            </div>
            <Link
              href={`/${locale}/dashboard/connections/${conn.id}`}
              className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <div>
              <p className="font-mono text-sm text-white font-medium">Expédition automatique</p>
              <p className="font-mono text-xs text-white/40 mt-0.5">
                {autoShipMap[conn.id]
                  ? 'Les commandes sont expédiées dès que le client confirme'
                  : 'Les commandes sont confirmées sans être expédiées automatiquement'}
              </p>
            </div>
            <Switch
              checked={autoShipMap[conn.id] ?? false}
              onCheckedChange={v => toggleAutoShip(conn.id, v)}
              disabled={loading[conn.id]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
