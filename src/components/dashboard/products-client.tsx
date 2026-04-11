'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Package, Plus, Search, Edit2, Trash2, Lock,
  ShoppingBag, Tag, Layers, AlertCircle, X, Check,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const ORANGE = '#FF6B2C';

type Product = {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  description: string | null;
  stock: number | null;
  isActive: boolean;
  source: string;
  createdAt: Date;
};

const EMPTY_FORM = {
  name: '',
  brand: '',
  price: '',
  description: '',
  stock: '',
};

export default function ProductsClient({
  initialProducts,
  canImport,
}: {
  initialProducts: Product[];
  canImport: boolean;
}) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [importModal, setImportModal] = useState<'woocommerce' | 'shopify' | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importKey, setImportKey] = useState('');
  const [importSecret, setImportSecret] = useState('');

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      brand: p.brand || '',
      price: String(p.price),
      description: p.description || '',
      stock: p.stock != null ? String(p.stock) : '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setError(t('errors.nameRequired')); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setError(t('errors.priceRequired'));
      return;
    }
    setError('');

    startTransition(async () => {
      const body = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        price: Number(form.price),
        description: form.description.trim() || null,
        stock: form.stock !== '' ? Number(form.stock) : null,
        ...(editProduct ? { id: editProduct.id } : {}),
      };

      const res = await fetch('/api/products', {
        method: editProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || tCommon('error'));
        return;
      }

      const saved = await res.json();
      if (editProduct) {
        setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setProducts((prev) => [saved, ...prev]);
      }
      setShowForm(false);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    });
  };

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !current }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Import buttons */}
          <div className="relative group">
            <button
              onClick={() => canImport ? setImportModal('woocommerce') : null}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold border transition-all ${
                canImport
                  ? 'border-white/15 text-white/60 hover:border-white/30 hover:text-white'
                  : 'border-white/[0.06] text-white/20 cursor-not-allowed'
              }`}
            >
              {!canImport && <Lock className="w-3 h-3" />}
              WooCommerce
            </button>
            {!canImport && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1a1a20] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {t('importAvailable')}
              </div>
            )}
          </div>

          <div className="relative group">
            <button
              onClick={() => canImport ? setImportModal('shopify') : null}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold border transition-all ${
                canImport
                  ? 'border-white/15 text-white/60 hover:border-white/30 hover:text-white'
                  : 'border-white/[0.06] text-white/20 cursor-not-allowed'
              }`}
            >
              {!canImport && <Lock className="w-3 h-3" />}
              Shopify
            </button>
            {!canImport && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1a1a20] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {t('importAvailable')}
              </div>
            )}
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: ORANGE }}
          >
            <Plus className="w-4 h-4" />
            {t('add')}
          </button>
        </div>
      </div>

      {/* Product list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${ORANGE}15` }}
          >
            <ShoppingBag className="w-7 h-7" style={{ color: ORANGE }} />
          </div>
          <h3 className="font-mono font-bold text-white mb-2">{t('empty')}</h3>
          <p className="font-mono text-sm text-white/30 mb-6">
            {t('emptyDesc')}
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: ORANGE }}
          >
            <Plus className="w-4 h-4" />
            {t('addProduct')}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                {[
                  t('table.product'),
                  t('table.price'),
                  t('table.stock'),
                  t('table.source'),
                  t('table.status'),
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
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-mono text-sm text-white font-medium">{p.name}</p>
                      {p.brand && <p className="font-mono text-xs text-white/30">{p.brand}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-white">
                      {p.price.toLocaleString('fr-DZ')} DA
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono text-xs px-2 py-1 rounded-full ${
                        p.stock == null
                          ? 'text-white/20 bg-white/[0.04]'
                          : p.stock === 0
                          ? 'text-red-400 bg-red-500/10'
                          : 'text-green-400 bg-green-500/10'
                      }`}
                    >
                      {p.stock == null ? t('stockUnlimited') : p.stock === 0 ? t('stockOut') : p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-white/30 capitalize">{p.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(p.id, p.isActive)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        p.isActive ? '' : 'bg-white/10'
                      }`}
                      style={p.isActive ? { background: ORANGE } : {}}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          p.isActive ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
            <p className="font-mono text-xs text-white/20">
              {filtered.length > 1 ? t('countPlural', { count: filtered.length }) : t('count', { count: filtered.length })}
            </p>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono font-bold text-white text-lg">
                {editProduct ? t('form.editTitle') : t('form.newTitle')}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  {t('form.nameLabel')} <span style={{ color: ORANGE }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('form.namePlaceholder')}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>

              {/* Brand + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs text-white/50 mb-1.5">{t('form.brandLabel')}</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder={t('form.brandPlaceholder')}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-white/50 mb-1.5">
                    {t('form.priceLabel')} <span style={{ color: ORANGE }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="3500"
                    min="0"
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">{t('form.descriptionLabel')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                />
              </div>

              {/* Stock */}
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  {t('form.stockLabel')}{' '}
                  <span className="text-white/20">{t('form.stockHint')}</span>
                </label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="Ex: 50"
                  min="0"
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono text-xs">{error}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: ORANGE }}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editProduct ? t('form.save') : t('form.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setImportModal(null)}
          />
          <div className="relative w-full max-w-md bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono font-bold text-white text-lg">
                {t('importFrom', { platform: importModal === 'woocommerce' ? 'WooCommerce' : 'Shopify' })}
              </h2>
              <button
                onClick={() => setImportModal(null)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  {t('importStoreUrl')}
                </label>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder={
                    importModal === 'woocommerce'
                      ? 'https://maboutique.com'
                      : 'maboutique.myshopify.com'
                  }
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">
                  {importModal === 'woocommerce' ? t('importKey') : t('importApiKey')}
                </label>
                <input
                  type="text"
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  placeholder="ck_..."
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              {importModal === 'woocommerce' && (
                <div>
                  <label className="block font-mono text-xs text-white/50 mb-1.5">{t('importSecret')}</label>
                  <input
                    type="text"
                    value={importSecret}
                    onChange={(e) => setImportSecret(e.target.value)}
                    placeholder="cs_..."
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                  />
                </div>
              )}

              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                <p className="font-mono text-xs text-white/40 leading-relaxed">
                  ℹ️ {t('importSecurityNote')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setImportModal(null)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => {
                  // TODO: implement import API
                  alert('Import en cours de développement');
                  setImportModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: ORANGE }}
              >
                <Package className="w-4 h-4" />
                {t('import')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
