'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShoppingCart, Search, Eye, X, Package, Clock,
  CheckCircle, Truck, XCircle, User, Bot,
  RotateCcw, Send, Loader2, Trash2, Square, CheckSquare, ChevronDown, CalendarClock,
} from 'lucide-react';

const ORANGE = '#FF6B2C';

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
  ecotrackTracking: string | null;
  deliveryFee: number | null;
  confirmationSentAt: Date | null;
  scheduledConfirmAt: Date | null;
  createdAt: Date;
  items: OrderItem[];
  connection: { name: string; platform: string };
};

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const t = useTranslations('orders');
  const tCommon = useTranslations('common');

  const STATUS_CONFIG: Record<
    string,
    { label: string; color: string; bg: string; icon: React.ElementType }
  > = {
    PENDING:    { label: t('status.PENDING'),    color: '#F59E0B', bg: '#F59E0B15', icon: Clock },
    CONFIRMED:  { label: t('status.CONFIRMED'),  color: '#3B82F6', bg: '#3B82F615', icon: CheckCircle },
    PROCESSING: { label: t('status.PROCESSING'), color: '#8B5CF6', bg: '#8B5CF615', icon: Package },
    SHIPPED:    { label: t('status.SHIPPED'),    color: ORANGE,    bg: `${ORANGE}15`, icon: Truck },
    DELIVERED:  { label: t('status.DELIVERED'),  color: '#10B981', bg: '#10B98115', icon: CheckCircle },
    CANCELLED:  { label: t('status.CANCELLED'),  color: '#EF4444', bg: '#EF444415', icon: XCircle },
    RETURNED:   { label: t('status.RETURNED'),   color: '#6B7280', bg: '#6B728015', icon: RotateCcw },
  };

  const STATUS_TRANSITIONS: Record<string, { next: string; label: string; color: string }[]> = {
    PENDING: [
      { next: 'CONFIRMED', label: t('actions.confirm'), color: '#3B82F6' },
      { next: 'CANCELLED', label: t('actions.cancel'),  color: '#EF4444' },
    ],
    CONFIRMED: [
      { next: 'SHIPPED',   label: t('actions.ship'),   color: ORANGE },
      { next: 'CANCELLED', label: t('actions.cancel'), color: '#EF4444' },
    ],
    PROCESSING: [
      { next: 'SHIPPED',   label: t('actions.ship'),   color: ORANGE },
      { next: 'CANCELLED', label: t('actions.cancel'), color: '#EF4444' },
    ],
    SHIPPED: [
      { next: 'DELIVERED', label: t('actions.deliver'), color: '#10B981' },
      { next: 'RETURNED',  label: t('actions.return'),  color: '#6B7280' },
    ],
    DELIVERED: [],
    CANCELLED: [],
    RETURNED:  [],
  };

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmRequestLoading, setConfirmRequestLoading] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState<string | null>(null);
  const [scheduleMenuId, setScheduleMenuId] = useState<string | null>(null);
  const [customDelay, setCustomDelay] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setLoadingAction(`${orderId}-${newStatus}`);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updated.status } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, status: updated.status } : null);
      showToast(t('statusUpdated'));
    } catch {
      showToast(t('updateError'), false);
    } finally {
      setLoadingAction(null);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Supprimer cette commande définitivement ?')) return;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setOrders(prev => prev.filter(o => o.id !== orderId));
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
      showToast('Commande supprimée');
    } catch {
      showToast('Erreur lors de la suppression', false);
    } finally {
      setDeletingId(null);
    }
  };

  const sendConfirmRequest = async (orderId: string) => {
    setConfirmRequestLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-request`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, confirmationSentAt: new Date() } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, confirmationSentAt: new Date() } : null);
      showToast(t('confirmSent'));
    } catch {
      showToast(t('sendError'), false);
    } finally {
      setConfirmRequestLoading(null);
    }
  };

  const scheduleConfirm = async (orderId: string, delayHours: number) => {
    setScheduleLoading(orderId);
    setScheduleMenuId(null);
    try {
      const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledConfirmAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) throw new Error();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, scheduledConfirmAt: scheduledAt } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, scheduledConfirmAt: scheduledAt } : null);
      showToast(`Confirmation automatique dans ${delayHours}h`);
    } catch {
      showToast('Erreur lors de la programmation', false);
    } finally {
      setScheduleLoading(null);
    }
  };

  const cancelSchedule = async (orderId: string) => {
    setScheduleLoading(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledConfirmAt: null }),
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, scheduledConfirmAt: null } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, scheduledConfirmAt: null } : null);
      showToast('Confirmation automatique annulée');
    } catch {
      showToast('Erreur', false);
    } finally {
      setScheduleLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    setShowBulkMenu(false);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      setOrders(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, status: newStatus } : o));
      setSelectedIds(new Set());
      showToast(`${selectedIds.size} commandes mises à jour`);
    } catch {
      showToast('Erreur lors de la mise à jour', false);
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} commande(s) définitivement ?`)) return;
    setBulkLoading(true);
    setShowBulkMenu(false);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/orders/${id}`, { method: 'DELETE' })
        )
      );
      setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
      if (selectedOrder && selectedIds.has(selectedOrder.id)) setSelectedOrder(null);
      setSelectedIds(new Set());
      showToast(`${selectedIds.size} commandes supprimées`);
    } catch {
      showToast('Erreur lors de la suppression', false);
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkSendConfirm = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    setShowBulkMenu(false);
    const ids = Array.from(selectedIds).filter(id => {
      const o = orders.find(x => x.id === id);
      return o && ['PENDING', 'CONFIRMED'].includes(o.status);
    });
    try {
      await Promise.all(ids.map(id => fetch(`/api/orders/${id}/confirm-request`, { method: 'POST' })));
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, confirmationSentAt: new Date() } : o));
      setSelectedIds(new Set());
      showToast(`Confirmation envoyée pour ${ids.length} commande(s)`);
    } catch {
      showToast('Erreur lors de l\'envoi', false);
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = orders.filter((o) => {
    const matchesSearch =
      !search ||
      (o.contactName || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.contactId || '').toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    confirmed: orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'DELIVERED').length,
    revenue: orders
      .filter((o) => o.status !== 'CANCELLED' && o.status !== 'RETURNED')
      .reduce((acc, o) => acc + (o.totalAmount || 0), 0),
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-mono text-sm font-semibold shadow-xl border ${
            toast.ok
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border flex-wrap"
          style={{ background: `${ORANGE}10`, borderColor: `${ORANGE}30` }}
        >
          <span className="font-mono text-sm font-semibold" style={{ color: ORANGE }}>
            {selectedIds.size} sélectionné(s)
          </span>
          <div className="flex items-center gap-2 flex-wrap ml-auto relative">
            <button
              onClick={bulkSendConfirm}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: '#8B5CF620', color: '#8B5CF6', border: '1px solid #8B5CF640' }}
            >
              <Send className="w-3 h-3" />
              Envoyer confirmation
            </button>
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(v => !v)}
                disabled={bulkLoading}
                className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Changer statut
                <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl border py-1 z-20 min-w-[160px]"
                  style={{ background: '#111', borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  {(['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED','RETURNED'] as string[]).map(s => (
                    <button
                      key={s}
                      onClick={() => bulkUpdateStatus(s)}
                      className="w-full text-left px-3 py-2 font-mono text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      {STATUS_CONFIG[s]?.label || s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={bulkDelete}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440' }}
            >
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Supprimer
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg text-white/30 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('stats.total'),      value: stats.total,     color: 'text-white' },
          { label: t('stats.pending'),    value: stats.pending,   color: 'text-yellow-400' },
          { label: t('stats.inProgress'), value: stats.confirmed, color: 'text-blue-400' },
          { label: t('stats.delivered'),  value: stats.delivered, color: 'text-green-400' },
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
            <p className="font-mono text-xs text-white/40">{t('totalRevenue')}</p>
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
            placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'].map((s) => (
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
              {s === 'ALL' ? t('filterAll') : STATUS_CONFIG[s]?.label || s}
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
          <h3 className="font-mono font-bold text-white mb-2">{t('empty')}</h3>
          <p className="font-mono text-sm text-white/30">
            {t('emptyDesc')}
          </p>
        </div>
      ) : (
        <>
        {/* Mobile card view */}
        <div className="sm:hidden space-y-3">
          {filtered.map((order) => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = status.icon;
            const transitions = STATUS_TRANSITIONS[order.status] || [];
            return (
              <div
                key={order.id}
                className={`rounded-2xl border border-white/[0.06] p-4 space-y-3 transition-colors ${selectedIds.has(order.id) ? 'bg-white/[0.04]' : 'bg-white/[0.02]'}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <button
                      onClick={e => { e.stopPropagation(); toggleSelect(order.id); }}
                      className="mt-0.5 text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                    >
                      {selectedIds.has(order.id)
                        ? <CheckSquare className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                        : <Square className="w-3.5 h-3.5" />}
                    </button>
                    <div>
                      <p className="font-mono text-xs text-white/40">#{order.id.slice(-6).toUpperCase()}</p>
                      <p className="font-mono text-sm font-semibold text-white mt-0.5">
                        {order.contactName || order.contactId || '—'}
                      </p>
                      {order.contactPhone && <p className="font-mono text-xs text-white/30">{order.contactPhone}</p>}
                    </div>
                  </div>
                  <div
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono font-semibold flex-shrink-0"
                    style={{ color: status.color, background: status.bg }}
                  >
                    <StatusIcon className="w-2.5 h-2.5" />
                    {status.label}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-white/30">
                    {order.items.length} article{order.items.length > 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' })}
                  </p>
                  <p className="font-mono text-sm font-bold text-white">
                    {order.totalAmount ? `${order.totalAmount.toLocaleString()} DA` : '—'}
                  </p>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {transitions.map((tr) => (
                    <button
                      key={tr.next}
                      onClick={() => updateStatus(order.id, tr.next)}
                      disabled={loadingAction === `${order.id}-${tr.next}`}
                      className="flex-1 py-2 rounded-xl font-mono text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1"
                      style={{ background: `${tr.color}20`, color: tr.color, border: `1px solid ${tr.color}40` }}
                    >
                      {loadingAction === `${order.id}-${tr.next}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {tr.label}
                    </button>
                  ))}
                  <button
                    onClick={() => deleteOrder(order.id)}
                    disabled={deletingId === order.id}
                    className="p-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    {deletingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block rounded-2xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 w-8">
                  <button onClick={toggleSelectAll} className="text-white/30 hover:text-white/60 transition-colors">
                    {selectedIds.size === filtered.length && filtered.length > 0
                      ? <CheckSquare className="w-3.5 h-3.5" />
                      : <Square className="w-3.5 h-3.5" />}
                  </button>
                </th>
                {[
                  t('table.order'),
                  t('table.client'),
                  t('table.bot'),
                  t('table.amount'),
                  t('table.status'),
                  t('table.date'),
                  t('table.actions'),
                ].map((h) => (
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
                const transitions = STATUS_TRANSITIONS[order.status] || [];
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${selectedIds.has(order.id) ? 'bg-white/[0.03]' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelect(order.id)}
                        className="text-white/30 hover:text-white/60 transition-colors"
                      >
                        {selectedIds.has(order.id)
                          ? <CheckSquare className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                          : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </td>
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
                        <span className="font-mono text-xs text-white/50">{order.connection.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-white">
                        {order.totalAmount ? `${order.totalAmount.toLocaleString('fr-DZ')} DA` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold w-fit"
                          style={{ color: status.color, background: status.bg }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </div>
                        {order.scheduledConfirmAt && order.status === 'PENDING' && !order.confirmationSentAt && (
                          <span className="font-mono text-[10px] text-purple-400/80 flex items-center gap-1">
                            <CalendarClock className="w-2.5 h-2.5" />
                            Auto {new Date(order.scheduledConfirmAt).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {order.confirmationSentAt && order.status === 'PENDING' && (
                          <span className="font-mono text-[10px] text-yellow-400/70 flex items-center gap-1">
                            <Send className="w-2.5 h-2.5" />
                            En attente réponse
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-white/30">
                        {new Date(order.createdAt).toLocaleDateString('fr-DZ', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Status action buttons */}
                        {transitions.map((tr) => (
                          <button
                            key={tr.next}
                            onClick={() => updateStatus(order.id, tr.next)}
                            disabled={loadingAction === `${order.id}-${tr.next}`}
                            className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                            style={{ background: `${tr.color}20`, color: tr.color, border: `1px solid ${tr.color}40` }}
                          >
                            {loadingAction === `${order.id}-${tr.next}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            {tr.label}
                          </button>
                        ))}

                        {/* Confirm request + auto-schedule (only for PENDING orders) */}
                        {order.status === 'PENDING' && (
                          <div className="flex items-center gap-1 relative">
                            <button
                              onClick={() => sendConfirmRequest(order.id)}
                              disabled={confirmRequestLoading === order.id}
                              className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                              style={{ background: '#8B5CF620', color: '#8B5CF6', border: '1px solid #8B5CF640' }}
                            >
                              {confirmRequestLoading === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              {order.confirmationSentAt ? 'Renvoyer' : 'Confirmer'}
                            </button>
                            {/* Schedule auto-confirm */}
                            {order.scheduledConfirmAt ? (
                              <button
                                onClick={() => cancelSchedule(order.id)}
                                disabled={scheduleLoading === order.id}
                                className="px-1.5 py-1 rounded-lg font-mono text-[10px] transition-all hover:opacity-80 flex items-center gap-1 text-yellow-400"
                                style={{ background: '#F59E0B15', border: '1px solid #F59E0B30' }}
                                title="Annuler la confirmation automatique"
                              >
                                <CalendarClock className="w-3 h-3" />
                              </button>
                            ) : (
                              <div className="relative">
                                <button
                                  onClick={() => setScheduleMenuId(scheduleMenuId === order.id ? null : order.id)}
                                  className="px-1.5 py-1 rounded-lg font-mono text-[10px] transition-all hover:opacity-80 flex items-center gap-1 text-white/40"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                                  title="Confirmation automatique"
                                >
                                  <CalendarClock className="w-3 h-3" />
                                </button>
                                {scheduleMenuId === order.id && (
                                  <div className="absolute right-0 top-7 z-50 bg-[#1a1a2e] border border-white/10 rounded-xl p-2 shadow-xl min-w-[160px]">
                                    {[5, 10, 24, 48].map(h => (
                                      <button key={h} onClick={() => scheduleConfirm(order.id, h)}
                                        className="w-full text-left px-3 py-1.5 text-xs font-mono text-white/70 hover:text-white hover:bg-white/[0.06] rounded-lg">
                                        Dans {h < 24 ? `${h}h` : `${h/24} jour${h > 24 ? 's' : ''}`}
                                      </button>
                                    ))}
                                    <div className="flex gap-1 mt-1 px-1">
                                      <input
                                        value={customDelay}
                                        onChange={e => setCustomDelay(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Xh"
                                        className="w-12 text-xs font-mono bg-white/[0.05] border border-white/10 rounded px-1.5 py-1 text-white/70"
                                      />
                                      <button
                                        onClick={() => { if (customDelay) { scheduleConfirm(order.id, Number(customDelay)); setCustomDelay(''); }}}
                                        className="text-xs font-mono px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                      >OK</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* View detail button */}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => deleteOrder(order.id)}
                          disabled={deletingId === order.id}
                          className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                        >
                          {deletingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
            <p className="font-mono text-xs text-white/20">
              {filtered.length > 1 ? t('countPlural', { count: filtered.length }) : t('count', { count: filtered.length })}
            </p>
          </div>
        </div>
        </>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-mono font-bold text-white text-lg">
                  {t('modal.title')} #{selectedOrder.id.slice(-6).toUpperCase()}
                </h2>
                <p className="font-mono text-xs text-white/30 mt-0.5">
                  {new Date(selectedOrder.createdAt).toLocaleString('fr-DZ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteOrder(selectedOrder.id)}
                  disabled={deletingId === selectedOrder.id}
                  className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Supprimer la commande"
                >
                  {deletingId === selectedOrder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Client info */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-4 space-y-2">
              <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">{t('modal.client')}</p>
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
              <p className="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">{t('modal.items')}</p>
              <div className="space-y-2">
                {selectedOrder.items.length === 0 ? (
                  <p className="font-mono text-xs text-white/20">{t('modal.noItems')}</p>
                ) : (
                  selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm text-white">{item.name}</p>
                        <p className="font-mono text-xs text-white/30">{t('modal.qty')}: {item.quantity}</p>
                      </div>
                      <span className="font-mono text-sm text-white">
                        {(item.price * item.quantity).toLocaleString('fr-DZ')} DA
                      </span>
                    </div>
                  ))
                )}
              </div>
              {selectedOrder.totalAmount != null && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06]">
                  <span className="font-mono text-sm font-bold text-white">{t('modal.total')}</span>
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
                  {t('modal.tracking')}
                </p>
                <p className="font-mono text-sm text-white">{selectedOrder.trackingCode}</p>
              </div>
            )}

            {/* Status + actions */}
            <div className="space-y-3">
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
                <span className="font-mono text-xs text-white/30">{t('modal.via')} {selectedOrder.connection.name}</span>
              </div>

              {/* Action buttons in modal */}
              {(STATUS_TRANSITIONS[selectedOrder.status] || []).length > 0 && (
                <div className="flex gap-2 flex-wrap pt-2 border-t border-white/[0.06]">
                  {(STATUS_TRANSITIONS[selectedOrder.status] || []).map((tr) => (
                    <button
                      key={tr.next}
                      onClick={() => updateStatus(selectedOrder.id, tr.next)}
                      disabled={loadingAction === `${selectedOrder.id}-${tr.next}`}
                      className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: `${tr.color}20`, color: tr.color, border: `1px solid ${tr.color}40` }}
                    >
                      {loadingAction === `${selectedOrder.id}-${tr.next}` && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {tr.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Confirm request in modal */}
              {selectedOrder.status === 'PENDING' && (
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  {selectedOrder.confirmationSentAt && (
                    <p className="font-mono text-xs text-yellow-400/70 flex items-center gap-1">
                      <Send className="w-3 h-3" /> Demande envoyée — en attente de réponse client
                    </p>
                  )}
                  {selectedOrder.scheduledConfirmAt && !selectedOrder.confirmationSentAt && (
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-purple-400 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        Auto le {new Date(selectedOrder.scheduledConfirmAt).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button onClick={() => cancelSchedule(selectedOrder.id)} className="text-[10px] font-mono text-red-400 hover:text-red-300">Annuler</button>
                    </div>
                  )}
                  <button
                    onClick={() => sendConfirmRequest(selectedOrder.id)}
                    disabled={confirmRequestLoading === selectedOrder.id}
                    className="w-full py-2.5 rounded-xl font-mono text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: '#8B5CF620', color: '#8B5CF6', border: '1px solid #8B5CF640' }}
                  >
                    {confirmRequestLoading === selectedOrder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {selectedOrder.confirmationSentAt ? 'Renvoyer la demande' : t('confirmRequestBtn')}
                  </button>
                  {/* Auto-confirm scheduling */}
                  {!selectedOrder.scheduledConfirmAt && !selectedOrder.confirmationSentAt && (
                    <div>
                      <p className="font-mono text-[10px] text-white/30 mb-1.5">Confirmation automatique dans :</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[5, 10, 24, 48].map(h => (
                          <button key={h} onClick={() => scheduleConfirm(selectedOrder.id, h)}
                            disabled={scheduleLoading === selectedOrder.id}
                            className="px-2.5 py-1 rounded-lg font-mono text-[11px] text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all">
                            {h < 24 ? `${h}h` : `${h/24}j`}
                          </button>
                        ))}
                        <div className="flex gap-1">
                          <input value={customDelay} onChange={e => setCustomDelay(e.target.value.replace(/\D/g, ''))} placeholder="Xh"
                            className="w-12 text-xs font-mono bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1 text-white/70" />
                          <button onClick={() => { if (customDelay) { scheduleConfirm(selectedOrder.id, Number(customDelay)); setCustomDelay(''); }}}
                            className="text-xs font-mono px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">OK</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
