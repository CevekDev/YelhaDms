'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShoppingCart, Search, Eye, X, Package, Clock,
  CheckCircle, Truck, XCircle, User, Bot,
  RotateCcw, Send, Loader2, Trash2, Square, CheckSquare,
  ChevronDown, CalendarClock, MapPin, Phone, Hash, TrendingUp,
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

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  PENDING:    { label: 'En attente',    color: '#F59E0B', bg: '#F59E0B12', border: '#F59E0B30', icon: Clock },
  CONFIRMED:  { label: 'Confirmée',    color: '#3B82F6', bg: '#3B82F612', border: '#3B82F630', icon: CheckCircle },
  PROCESSING: { label: 'En traitement', color: '#8B5CF6', bg: '#8B5CF612', border: '#8B5CF630', icon: Package },
  SHIPPED:    { label: 'Expédiée',     color: ORANGE,    bg: `${ORANGE}12`, border: `${ORANGE}30`, icon: Truck },
  DELIVERED:  { label: 'Livrée',       color: '#10B981', bg: '#10B98112', border: '#10B98130', icon: CheckCircle },
  CANCELLED:  { label: 'Annulée',      color: '#EF4444', bg: '#EF444412', border: '#EF444430', icon: XCircle },
  RETURNED:   { label: 'Retournée',    color: '#6B7280', bg: '#6B728012', border: '#6B728030', icon: RotateCcw },
};

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const t = useTranslations('orders');

  const STATUS_TRANSITIONS: Record<string, { next: string; label: string; color: string }[]> = {
    PENDING: [
      { next: 'CANCELLED', label: t('actions.cancel'), color: '#EF4444' },
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
    setTimeout(() => setToast(null), 3500);
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

  const filtered = orders.filter((o) => {
    const matchesSearch = !search ||
      (o.contactName || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.contactId || '').toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.ecotrackTracking || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(o => o.id)));
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (!selectedIds.size) return;
    setBulkLoading(true); setShowBulkMenu(false);
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
      ));
      setOrders(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, status: newStatus } : o));
      setSelectedIds(new Set());
      showToast(`${selectedIds.size} commandes mises à jour`);
    } catch { showToast('Erreur', false); }
    finally { setBulkLoading(false); }
  };

  const bulkDelete = async () => {
    if (!selectedIds.size || !confirm(`Supprimer ${selectedIds.size} commande(s) ?`)) return;
    setBulkLoading(true); setShowBulkMenu(false);
    try {
      await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' })));
      setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
      if (selectedOrder && selectedIds.has(selectedOrder.id)) setSelectedOrder(null);
      setSelectedIds(new Set());
      showToast(`${selectedIds.size} commandes supprimées`);
    } catch { showToast('Erreur', false); }
    finally { setBulkLoading(false); }
  };

  const bulkSendConfirm = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true); setShowBulkMenu(false);
    const ids = Array.from(selectedIds).filter(id => {
      const o = orders.find(x => x.id === id);
      return o && ['PENDING', 'CONFIRMED'].includes(o.status);
    });
    try {
      await Promise.all(ids.map(id => fetch(`/api/orders/${id}/confirm-request`, { method: 'POST' })));
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, confirmationSentAt: new Date() } : o));
      setSelectedIds(new Set());
      showToast(`Confirmation envoyée pour ${ids.length} commande(s)`);
    } catch { showToast('Erreur', false); }
    finally { setBulkLoading(false); }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    confirmed: orders.filter(o => ['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
    revenue: orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status)).reduce((acc, o) => acc + (o.totalAmount || 0), 0),
  };

  function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
    const Icon = s.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full ${size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[10px]'}`}
        style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
      >
        <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        {s.label}
      </span>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-mono text-sm font-semibold shadow-2xl border backdrop-blur-sm ${toast.ok ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border flex-wrap" style={{ background: `${ORANGE}0A`, borderColor: `${ORANGE}25` }}>
          <span className="font-mono text-sm font-bold" style={{ color: ORANGE }}>{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button onClick={bulkSendConfirm} disabled={bulkLoading}
              className="px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: '#8B5CF615', color: '#8B5CF6', border: '1px solid #8B5CF630' }}>
              <Send className="w-3 h-3" />Envoyer confirmation
            </button>
            <div className="relative">
              <button onClick={() => setShowBulkMenu(v => !v)} disabled={bulkLoading}
                className="px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Changer statut <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 rounded-xl border py-1.5 z-20 min-w-[170px] shadow-xl backdrop-blur-sm"
                  style={{ background: '#1a1a2e', borderColor: 'rgba(255,255,255,0.1)' }}>
                  {(['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED','RETURNED'] as string[]).map(s => {
                    const st = STATUS_STYLES[s];
                    return (
                      <button key={s} onClick={() => bulkUpdateStatus(s)}
                        className="w-full text-left px-3 py-2 font-mono text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
                        style={{ color: st?.color || 'rgba(255,255,255,0.6)' }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st?.color }} />
                        {st?.label || s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="px-3 py-1.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: '#EF444415', color: '#EF4444', border: '1px solid #EF444430' }}>
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Supprimer
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-lg text-white/30 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('stats.total'),      value: stats.total,     color: '#fff',    bg: 'rgba(255,255,255,0.04)', icon: ShoppingCart },
          { label: t('stats.pending'),    value: stats.pending,   color: '#F59E0B', bg: '#F59E0B0A', icon: Clock },
          { label: t('stats.inProgress'), value: stats.confirmed, color: '#3B82F6', bg: '#3B82F60A', icon: Truck },
          { label: t('stats.delivered'),  value: stats.delivered, color: '#10B981', bg: '#10B9810A', icon: CheckCircle },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] p-4 flex items-center gap-3 transition-all hover:border-white/10"
              style={{ background: s.bg }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}18` }}>
                <Icon className="w-4.5 h-4.5" style={{ color: s.color, width: 18, height: 18 }} />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="font-mono text-[10px] text-white/30 mt-0.5">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue bar */}
      {stats.revenue > 0 && (
        <div className="rounded-2xl border p-4 flex items-center gap-4" style={{ borderColor: `${ORANGE}25`, background: `linear-gradient(135deg, ${ORANGE}0A, ${ORANGE}05)` }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${ORANGE}20` }}>
            <TrendingUp className="w-5 h-5" style={{ color: ORANGE }} />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] text-white/40 uppercase tracking-wider">{t('totalRevenue')}</p>
            <p className="font-mono text-2xl font-bold text-white mt-0.5">{stats.revenue.toLocaleString('fr-DZ')} <span className="text-base text-white/50">DA</span></p>
          </div>
          <div className="font-mono text-xs text-white/25 text-right">
            <p>{orders.filter(o => !['CANCELLED','RETURNED'].includes(o.status)).length} commandes</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.05] transition-all" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => {
            const st = STATUS_STYLES[s];
            const isActive = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-2 rounded-xl font-mono text-xs font-semibold transition-all"
                style={isActive
                  ? { background: st?.bg || `${ORANGE}15`, color: st?.color || ORANGE, border: `1px solid ${st?.border || `${ORANGE}40`}` }
                  : { color: 'rgba(255,255,255,0.30)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {s === 'ALL' ? t('filterAll') : st?.label || s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-14 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${ORANGE}15` }}>
            <ShoppingCart className="w-7 h-7" style={{ color: ORANGE }} />
          </div>
          <h3 className="font-mono font-bold text-white mb-2">{t('empty')}</h3>
          <p className="font-mono text-sm text-white/30">{t('emptyDesc')}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2.5">
            {filtered.map((order) => {
              const transitions = STATUS_TRANSITIONS[order.status] || [];
              return (
                <div key={order.id}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 cursor-pointer active:scale-[0.99] transition-all hover:border-white/10"
                  onClick={() => setSelectedOrder(order)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <button onClick={e => { e.stopPropagation(); toggleSelect(order.id); }}
                        className="mt-0.5 text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
                        {selectedIds.has(order.id)
                          ? <CheckSquare className="w-4 h-4" style={{ color: ORANGE }} />
                          : <Square className="w-4 h-4" />}
                      </button>
                      <div>
                        <p className="font-mono text-[10px] text-white/30">#{order.id.slice(-6).toUpperCase()}</p>
                        <p className="font-mono text-sm font-semibold text-white mt-0.5">{order.contactName || order.contactId || '—'}</p>
                        {order.contactPhone && <p className="font-mono text-xs text-white/30 mt-0.5">{order.contactPhone}</p>}
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-white/30">{order.items.length} article{order.items.length > 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' })}</p>
                    <p className="font-mono text-base font-bold" style={{ color: ORANGE }}>{order.totalAmount ? `${order.totalAmount.toLocaleString()} DA` : '—'}</p>
                  </div>
                  {transitions.length > 0 && (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      {transitions.map(tr => (
                        <button key={tr.next} onClick={() => updateStatus(order.id, tr.next)}
                          disabled={loadingAction === `${order.id}-${tr.next}`}
                          className="flex-1 py-2 rounded-xl font-mono text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40 flex items-center justify-center gap-1"
                          style={{ background: `${tr.color}18`, color: tr.color, border: `1px solid ${tr.color}30` }}>
                          {loadingAction === `${order.id}-${tr.next}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <th className="px-4 py-3 w-8">
                    <button onClick={toggleSelectAll} className="text-white/30 hover:text-white/60 transition-colors">
                      {selectedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-3.5 h-3.5" style={{ color: ORANGE }} />
                        : <Square className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  {[t('table.order'), t('table.client'), t('table.bot'), t('table.amount'), t('table.status'), t('table.date'), t('table.actions')].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-mono text-[10px] font-semibold text-white/25 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, idx) => {
                  const transitions = STATUS_TRANSITIONS[order.status] || [];
                  const isSelected = selectedIds.has(order.id);
                  const tracking = order.ecotrackTracking || order.trackingCode;
                  return (
                    <tr key={order.id}
                      className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02] cursor-pointer"
                      style={isSelected ? { background: `${ORANGE}07` } : {}}>
                      <td className="px-4 py-3.5">
                        <button onClick={() => toggleSelect(order.id)} className="text-white/30 hover:text-white/60 transition-colors">
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5" style={{ color: ORANGE }} /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                        {tracking && (
                          <p className="font-mono text-[9px] text-white/20 mt-0.5 flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" />{tracking}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5" onClick={() => setSelectedOrder(order)}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-bold"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                            {(order.contactName || order.contactId || '?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-mono text-sm text-white font-medium">{order.contactName || order.contactId || '—'}</p>
                            {order.contactPhone && <p className="font-mono text-[10px] text-white/30 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{order.contactPhone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                          <span className="font-mono text-xs text-white/40 truncate max-w-[80px]">{order.connection.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-sm font-semibold text-white">{order.totalAmount ? `${order.totalAmount.toLocaleString('fr-DZ')} DA` : '—'}</span>
                        {order.deliveryFee && order.deliveryFee > 0 && (
                          <p className="font-mono text-[9px] text-white/25 mt-0.5">livraison: {order.deliveryFee.toLocaleString()} DA</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={order.status} />
                          {order.scheduledConfirmAt && order.status === 'PENDING' && !order.confirmationSentAt && (
                            <span className="font-mono text-[9px] text-purple-400/70 flex items-center gap-1">
                              <CalendarClock className="w-2.5 h-2.5" />
                              Auto {new Date(order.scheduledConfirmAt).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {order.confirmationSentAt && order.status === 'PENDING' && (
                            <span className="font-mono text-[9px] text-blue-400/60 flex items-center gap-1">
                              <Send className="w-2.5 h-2.5" />En attente réponse
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-white/25">{new Date(order.createdAt).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {transitions.map(tr => (
                            <button key={tr.next} onClick={() => updateStatus(order.id, tr.next)}
                              disabled={loadingAction === `${order.id}-${tr.next}`}
                              className="px-2.5 py-1 rounded-lg font-mono text-[10px] font-semibold transition-all hover:opacity-80 disabled:opacity-40 flex items-center gap-1"
                              style={{ background: `${tr.color}18`, color: tr.color, border: `1px solid ${tr.color}30` }}>
                              {loadingAction === `${order.id}-${tr.next}` ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                              {tr.label}
                            </button>
                          ))}
                          {order.status === 'PENDING' && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => sendConfirmRequest(order.id)} disabled={confirmRequestLoading === order.id}
                                className="px-2.5 py-1 rounded-lg font-mono text-[10px] font-semibold transition-all hover:opacity-80 disabled:opacity-40 flex items-center gap-1"
                                style={{ background: '#8B5CF618', color: '#8B5CF6', border: '1px solid #8B5CF630' }}>
                                {confirmRequestLoading === order.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Send className="w-2.5 h-2.5" />}
                                {order.confirmationSentAt ? 'Renvoyer' : 'Confirmer'}
                              </button>
                              {order.scheduledConfirmAt ? (
                                <button onClick={() => cancelSchedule(order.id)} disabled={scheduleLoading === order.id} title="Annuler confirmation auto"
                                  className="p-1 rounded-lg text-yellow-400/70 hover:text-yellow-400 transition-colors"
                                  style={{ background: '#F59E0B15' }}>
                                  <CalendarClock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="relative">
                                  <button onClick={() => setScheduleMenuId(scheduleMenuId === order.id ? null : order.id)} title="Confirmation automatique"
                                    className="p-1 rounded-lg text-white/25 hover:text-white/50 transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    <CalendarClock className="w-3.5 h-3.5" />
                                  </button>
                                  {scheduleMenuId === order.id && (
                                    <div className="absolute right-0 top-8 z-50 rounded-xl border p-2 shadow-xl min-w-[150px]"
                                      style={{ background: '#1a1a2e', borderColor: 'rgba(255,255,255,0.1)' }}>
                                      {[5, 10, 24, 48].map(h => (
                                        <button key={h} onClick={() => scheduleConfirm(order.id, h)}
                                          className="w-full text-left px-3 py-1.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/[0.06] rounded-lg">
                                          Dans {h < 24 ? `${h}h` : `${h/24}j`}
                                        </button>
                                      ))}
                                      <div className="flex gap-1 mt-1 px-1">
                                        <input value={customDelay} onChange={e => setCustomDelay(e.target.value.replace(/\D/g, ''))} placeholder="Xh"
                                          className="w-12 text-xs font-mono bg-white/[0.05] border border-white/10 rounded px-1.5 py-1 text-white/70" />
                                        <button onClick={() => { if (customDelay) { scheduleConfirm(order.id, Number(customDelay)); setCustomDelay(''); }}}
                                          className="text-xs font-mono px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">OK</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <button onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/[0.06] transition-all">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteOrder(order.id)} disabled={deletingId === order.id}
                            className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                            {deletingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <p className="font-mono text-[10px] text-white/20">
                {filtered.length} commande{filtered.length > 1 ? 's' : ''}{statusFilter !== 'ALL' ? ` · filtre: ${STATUS_STYLES[statusFilter]?.label}` : ''}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #131320 0%, #0e0e1a 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Modal header */}
            <div className="sticky top-0 px-5 pt-5 pb-4 border-b border-white/[0.07] flex items-start justify-between"
              style={{ background: 'linear-gradient(180deg, #131320 0%, #13132000 100%)' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-mono font-bold text-white text-lg">#{selectedOrder.id.slice(-6).toUpperCase()}</h2>
                  <StatusBadge status={selectedOrder.status} size="md" />
                </div>
                <p className="font-mono text-xs text-white/30">{new Date(selectedOrder.createdAt).toLocaleString('fr-DZ')} · via {selectedOrder.connection.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => deleteOrder(selectedOrder.id)} disabled={deletingId === selectedOrder.id}
                  className="p-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  {deletingId === selectedOrder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.07] transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Client card */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider font-semibold">{t('modal.client')}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm flex-shrink-0"
                    style={{ background: `${ORANGE}20`, color: ORANGE }}>
                    {(selectedOrder.contactName || selectedOrder.contactId || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-mono text-base font-semibold text-white">{selectedOrder.contactName || selectedOrder.contactId || '—'}</p>
                    {selectedOrder.contactPhone && (
                      <p className="font-mono text-xs text-white/40 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{selectedOrder.contactPhone}</p>
                    )}
                  </div>
                </div>
                {selectedOrder.notes && (
                  <div className="flex items-start gap-2 pt-2 border-t border-white/[0.06]">
                    <MapPin className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                    <p className="font-mono text-xs text-white/40">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">{t('modal.items')}</p>
                <div className="space-y-2.5">
                  {selectedOrder.items.length === 0 ? (
                    <p className="font-mono text-xs text-white/20">{t('modal.noItems')}</p>
                  ) : selectedOrder.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm text-white">{item.name}</p>
                        <p className="font-mono text-[10px] text-white/30">{t('modal.qty')}: {item.quantity}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-white">{(item.price * item.quantity).toLocaleString('fr-DZ')} DA</span>
                    </div>
                  ))}
                </div>
                {selectedOrder.totalAmount != null && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06]">
                    <div>
                      <span className="font-mono text-sm font-bold text-white">{t('modal.total')}</span>
                      {selectedOrder.deliveryFee != null && selectedOrder.deliveryFee > 0 && (
                        <p className="font-mono text-[10px] text-white/30 mt-0.5">dont livraison: {selectedOrder.deliveryFee.toLocaleString()} DA</p>
                      )}
                    </div>
                    <span className="font-mono text-lg font-bold" style={{ color: ORANGE }}>{selectedOrder.totalAmount.toLocaleString('fr-DZ')} DA</span>
                  </div>
                )}
              </div>

              {/* Tracking */}
              {(selectedOrder.ecotrackTracking || selectedOrder.trackingCode) && (
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,107,44,0.06)', border: '1px solid rgba(255,107,44,0.2)' }}>
                  <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">{t('modal.tracking')}</p>
                  <p className="font-mono text-base font-bold" style={{ color: ORANGE }}>{selectedOrder.ecotrackTracking || selectedOrder.trackingCode}</p>
                </div>
              )}

              {/* Actions */}
              {(STATUS_TRANSITIONS[selectedOrder.status] || []).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(STATUS_TRANSITIONS[selectedOrder.status] || []).map(tr => (
                    <button key={tr.next} onClick={() => updateStatus(selectedOrder.id, tr.next)}
                      disabled={loadingAction === `${selectedOrder.id}-${tr.next}`}
                      className="flex-1 py-3 rounded-xl font-mono text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: `${tr.color}18`, color: tr.color, border: `1px solid ${tr.color}30` }}>
                      {loadingAction === `${selectedOrder.id}-${tr.next}` && <Loader2 className="w-4 h-4 animate-spin" />}
                      {tr.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Confirm request */}
              {selectedOrder.status === 'PENDING' && (
                <div className="space-y-3 pt-1">
                  {selectedOrder.confirmationSentAt && (
                    <p className="font-mono text-xs text-blue-400/70 flex items-center gap-1.5">
                      <Send className="w-3 h-3" />Demande envoyée — en attente de réponse client
                    </p>
                  )}
                  {selectedOrder.scheduledConfirmAt && !selectedOrder.confirmationSentAt && (
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-purple-400 flex items-center gap-1.5">
                        <CalendarClock className="w-3 h-3" />
                        Auto le {new Date(selectedOrder.scheduledConfirmAt).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button onClick={() => cancelSchedule(selectedOrder.id)} className="text-[10px] font-mono text-red-400/70 hover:text-red-400">Annuler</button>
                    </div>
                  )}
                  <button onClick={() => sendConfirmRequest(selectedOrder.id)} disabled={confirmRequestLoading === selectedOrder.id}
                    className="w-full py-3 rounded-xl font-mono text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: '#8B5CF618', color: '#8B5CF6', border: '1px solid #8B5CF630' }}>
                    {confirmRequestLoading === selectedOrder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {selectedOrder.confirmationSentAt ? 'Renvoyer la demande' : t('confirmRequestBtn')}
                  </button>
                  {!selectedOrder.scheduledConfirmAt && !selectedOrder.confirmationSentAt && (
                    <div>
                      <p className="font-mono text-[10px] text-white/25 mb-2">Confirmation automatique dans :</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[5, 10, 24, 48].map(h => (
                          <button key={h} onClick={() => scheduleConfirm(selectedOrder.id, h)}
                            disabled={scheduleLoading === selectedOrder.id}
                            className="px-3 py-1.5 rounded-xl font-mono text-[11px] font-semibold text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all">
                            {h < 24 ? `${h}h` : `${h/24}j`}
                          </button>
                        ))}
                        <div className="flex gap-1">
                          <input value={customDelay} onChange={e => setCustomDelay(e.target.value.replace(/\D/g, ''))} placeholder="Xh"
                            className="w-12 text-xs font-mono bg-white/[0.05] border border-white/10 rounded-xl px-2 py-1.5 text-white/70" />
                          <button onClick={() => { if (customDelay) { scheduleConfirm(selectedOrder.id, Number(customDelay)); setCustomDelay(''); }}}
                            className="text-xs font-mono px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">OK</button>
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
