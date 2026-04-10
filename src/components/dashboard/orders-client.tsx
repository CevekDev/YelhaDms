'use client';

import { useState } from 'react';
import {
  ShoppingCart, Search, Eye, X, Package, Clock,
  CheckCircle, Truck, AlertCircle, XCircle, User, Bot,
} from 'lucide-react';

const ORANGE = '#FF6B2C';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  PENDING:    { label: 'En attente',   color: '#F59E0B', bg: '#F59E0B15', icon: Clock },
  CONFIRMED:  { label: 'Confirmée',    color: '#3B82F6', bg: '#3B82F615', icon: CheckCircle },
  PROCESSING: { label: 'En cours',     color: '#8B5CF6', bg: '#8B5CF615', icon: Package },
  SHIPPED:    { label: 'Expédiée',     color: ORANGE,    bg: `${ORANGE}15`, icon: Truck },
  DELIVERED:  { label: 'Livrée',       color: '#10B981', bg: '#10B98115', icon: CheckCircle },
  CANCELLED:  { label: 'Annulée',      color: '#EF4444', bg: '#EF444415', icon: XCircle },
};

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  product: { name: string } | null;
};

type Order = {
  id: string;
  contactName: string | null;
  contactId: string | null;
  contactPhone: string | null;
  status: string;
  totalAmount: number | null;
  notes: string | null;
  trackingCode: string | null;
  createdAt: Date;
  items: OrderItem[];
  connection: { name: string; platform: string };
};

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = orders.filter((o) => {
    const matchesSearch =
      !search ||
      (o.contactName || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.contactId || '').toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    confirmed: orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'DELIVERED').length,
    revenue: orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((acc, o) => acc + (o.totalAmount || 0), 0),
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'En attente', value: stats.pending, color: 'text-yellow-400' },
          { label: 'En cours', value: stats.confirmed, color: 'text-blue-400' },
          { label: 'Livrées', value: stats.delivered, color: 'text-green-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
          >
            <p className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="font-mono text-xs text-white/30 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue */}
      {stats.revenue > 0 && (
        <div
          className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ borderColor: `${ORANGE}30`, background: `${ORANGE}08` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${ORANGE}20` }}
          >
            <ShoppingCart className="w-5 h-5" style={{ color: ORANGE }} />
          </div>
          <div>
            <p className="font-mono text-xs text-white/40">Chiffre d'affaires total</p>
            <p className="font-mono text-xl font-bold text-white">
              {stats.revenue.toLocaleString('fr-DZ')} DA
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par client, ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl font-mono text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'text-white'
                  : 'text-white/30 border border-white/[0.06] hover:border-white/20 hover:text-white/60'
              }`}
              style={statusFilter === s ? { background: ORANGE } : {}}
            >
              {s === 'ALL' ? 'Toutes' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${ORANGE}15` }}
          >
            <ShoppingCart className="w-7 h-7" style={{ color: ORANGE }} />
          </div>
          <h3 className="font-mono font-bold text-white mb-2">Aucune commande</h3>
          <p className="font-mono text-sm text-white/30">
            Les commandes validées par vos bots apparaîtront ici automatiquement
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                {['Commande', 'Client', 'Bot', 'Montant', 'Statut', 'Date', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-mono text-xs font-semibold text-white/30 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={order.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-white/40">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                        <span className="font-mono text-sm text-white">
                          {order.contactName || order.contactId || '—'}
                        </span>
                      </div>
                      {order.contactPhone && (
                        <p className="font-mono text-xs text-white/30 ml-5">{order.contactPhone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                        <span className="font-mono text-xs text-white/50">
                          {order.connection.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-white">
                        {order.totalAmount
                          ? `${order.totalAmount.toLocaleString('fr-DZ')} DA`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold"
                        style={{ color: status.color, background: status.bg }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-white/30">
                        {new Date(order.createdAt).toLocaleDateString('fr-DZ', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
            <p className="font-mono text-xs text-white/20">
              {filtered.length} commande{filtered.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-mono font-bold text-white text-lg">
                  Commande #{selectedOrder.id.slice(-6).toUpperCase()}
                </h2>
                <p className="font-mono text-xs text-white/30 mt-0.5">
                  {new Date(selectedOrder.createdAt).toLocaleString('fr-DZ')}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Client info */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-4 space-y-2">
              <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">Client</p>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-white/30" />
                <span className="font-mono text-sm text-white">
                  {selectedOrder.contactName || selectedOrder.contactId || '—'}
                </span>
              </div>
              {selectedOrder.contactPhone && (
                <p className="font-mono text-xs text-white/40 ml-5">{selectedOrder.contactPhone}</p>
              )}
              {selectedOrder.notes && (
                <p className="font-mono text-xs text-white/30 mt-2 border-t border-white/[0.06] pt-2">
                  {selectedOrder.notes}
                </p>
              )}
            </div>

            {/* Items */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-4">
              <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">Articles</p>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm text-white">{item.name}</p>
                      <p className="font-mono text-xs text-white/30">Qté: {item.quantity}</p>
                    </div>
                    <span className="font-mono text-sm text-white">
                      {(item.price * item.quantity).toLocaleString('fr-DZ')} DA
                    </span>
                  </div>
                ))}
              </div>
              {selectedOrder.totalAmount != null && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06]">
                  <span className="font-mono text-sm font-bold text-white">Total</span>
                  <span className="font-mono text-sm font-bold" style={{ color: ORANGE }}>
                    {selectedOrder.totalAmount.toLocaleString('fr-DZ')} DA
                  </span>
                </div>
              )}
            </div>

            {/* Tracking */}
            {selectedOrder.trackingCode && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-4">
                <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-2">
                  Code de suivi
                </p>
                <p className="font-mono text-sm text-white">{selectedOrder.trackingCode}</p>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold"
                style={{
                  color: STATUS_CONFIG[selectedOrder.status]?.color,
                  background: STATUS_CONFIG[selectedOrder.status]?.bg,
                }}
              >
                {STATUS_CONFIG[selectedOrder.status]?.label}
              </div>
              <span className="font-mono text-xs text-white/30">via {selectedOrder.connection.name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
