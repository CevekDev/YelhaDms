'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Package, Plus, Search, Edit2, Trash2, Lock,
  ShoppingBag, AlertCircle, X, Check, Tag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFeatureGate } from './upgrade-modal';

const ORANGE = '#FF6B2C';

type Category = {
  id: string;
  name: string;
  description: string | null;
};

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
  sizes: string[];
  models: string[];
  colors: string[];
  categoryId: string | null;
  category: { id: string; name: string } | null;
};

const EMPTY_FORM = {
  name: '',
  brand: '',
  price: '',
  description: '',
  stock: '',
  sizes: [] as string[],
  models: [] as string[],
  colors: [] as string[],
  categoryId: '',
};

/** Simple tag-input: type a value then press Enter or comma */
function TagInput({
  label, tags, onChange, placeholder,
}: {
  label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState('');
  const add = (raw: string) => {
    const val = raw.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  };
  const remove = (t: string) => onChange(tags.filter(x => x !== t));
  return (
    <div>
      <label className="block font-mono text-xs text-white/50 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 min-h-[40px] w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-orange-500/40 transition-colors">
        {tags.map(t => (
          <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono text-white/80 bg-white/[0.08]">
            {t}
            <button type="button" onClick={() => remove(t)} className="text-white/30 hover:text-white/70"><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
            if (e.key === 'Backspace' && !input && tags.length > 0) remove(tags[tags.length - 1]);
          }}
          onBlur={() => { if (input.trim()) add(input); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm font-mono text-white placeholder-white/20 focus:outline-none"
        />
      </div>
    </div>
  );
}

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
  const { gate, modal } = useFeatureGate();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // null = "Toutes"
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
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState<{ imported: number; total: number; skipped: number } | null>(null);

  // Category management modal states
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDesc, setEditCategoryDesc] = useState('');

  // Load categories on mount
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
  }, []);

  const closeImportModal = () => {
    setImportModal(null);
    setImportUrl('');
    setImportKey('');
    setImportSecret('');
    setImportError('');
    setImportSuccess(null);
  };

  const handleImport = async () => {
    if (!importUrl.trim()) { setImportError("L'URL de la boutique est requise"); return; }
    if (!importKey.trim()) { setImportError('La clé API est requise'); return; }
    if (importModal === 'woocommerce' && !importSecret.trim()) {
      setImportError('Le Consumer Secret est requis');
      return;
    }
    setImportError('');
    setImportSuccess(null);
    setImporting(true);
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: importModal,
          url: importUrl.trim(),
          key: importKey.trim(),
          secret: importSecret.trim(),
        }),
      });
      const data = await res.json().catch(() => ({ error: 'Réponse invalide du serveur' }));
      if (!res.ok) {
        setImportError(data.error || "Erreur lors de l'import");
        return;
      }
      setImportSuccess(data);
      // Refresh product list
      const updated = await fetch('/api/products').then(r => r.json()).catch(() => null);
      if (Array.isArray(updated)) setProducts(updated);
    } catch {
      setImportError('Erreur réseau, veuillez réessayer');
    } finally {
      setImporting(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === null || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
      sizes: p.sizes || [],
      models: p.models || [],
      colors: p.colors || [],
      categoryId: p.categoryId || '',
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
        sizes: form.sizes,
        models: form.models,
        colors: form.colors,
        categoryId: form.categoryId || null,
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

  // Category CRUD
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) { setCategoryError('Le nom est obligatoire'); return; }
    setCategoryError('');
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.trim(), description: newCategoryDesc.trim() || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setCategoryError(d.error || 'Erreur');
      return;
    }
    const created = await res.json();
    setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCategoryName('');
    setNewCategoryDesc('');
    setShowNewCategoryModal(false);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Supprimer la catégorie "${name}" ? Les produits associés perdront leur catégorie.`)) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== id));
      // Remove category from products in local state
      setProducts(prev => prev.map(p => p.categoryId === id ? { ...p, categoryId: null, category: null } : p));
      if (selectedCategory === id) setSelectedCategory(null);
    }
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setEditCategoryDesc(cat.description || '');
    setCategoryError('');
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    if (!editCategoryName.trim()) { setCategoryError('Le nom est obligatoire'); return; }
    setCategoryError('');
    const res = await fetch(`/api/categories/${editingCategory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editCategoryName.trim(), description: editCategoryDesc.trim() || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setCategoryError(d.error || 'Erreur');
      return;
    }
    const updated = await res.json();
    setCategories(prev => prev.map(c => c.id === updated.id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)));
    // Update local product states
    setProducts(prev => prev.map(p =>
      p.categoryId === updated.id ? { ...p, category: { id: updated.id, name: updated.name } } : p
    ));
    setEditingCategory(null);
  };

  return (
    <div className="space-y-5">
      {modal}

      {/* Categories section */}
      <div className="flex flex-wrap items-center gap-2">
        <Tag className="w-4 h-4 text-white/30 flex-shrink-0" />
        {/* "Toutes" pill */}
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full font-mono text-xs font-semibold transition-all border ${
            selectedCategory === null
              ? 'text-white border-transparent'
              : 'text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/70'
          }`}
          style={selectedCategory === null ? { background: ORANGE, borderColor: ORANGE } : {}}
        >
          Toutes
        </button>

        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-0.5 group">
            <button
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-mono text-xs font-semibold transition-all border ${
                selectedCategory === cat.id
                  ? 'text-white border-transparent'
                  : 'text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/70'
              }`}
              style={selectedCategory === cat.id ? { background: ORANGE, borderColor: ORANGE } : {}}
            >
              {cat.name}
            </button>
            {/* Edit category name inline */}
            <button
              onClick={() => openEditCategory(cat)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full text-white/30 hover:text-white/70 transition-all"
              title="Renommer"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => handleDeleteCategory(cat.id, cat.name)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full text-white/30 hover:text-red-400 transition-all"
              title="Supprimer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}

        <button
          onClick={() => { setShowNewCategoryModal(true); setCategoryError(''); setNewCategoryName(''); setNewCategoryDesc(''); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs text-white/30 border border-white/[0.08] hover:border-white/20 hover:text-white/50 transition-all"
        >
          <Plus className="w-3 h-3" />
          Catégorie
        </button>
      </div>

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
          <button
            onClick={() => canImport ? setImportModal('woocommerce') : gate('BUSINESS', 'Import WooCommerce')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold border transition-all ${
              canImport
                ? 'border-white/15 text-white/60 hover:border-white/30 hover:text-white'
                : 'border-white/[0.06] text-white/20'
            }`}
          >
            {!canImport && <Lock className="w-3 h-3" />}
            WooCommerce
          </button>

          <button
            onClick={() => canImport ? setImportModal('shopify') : gate('BUSINESS', 'Import Shopify')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold border transition-all ${
              canImport
                ? 'border-white/15 text-white/60 hover:border-white/30 hover:text-white'
                : 'border-white/[0.06] text-white/20'
            }`}
          >
            {!canImport && <Lock className="w-3 h-3" />}
            Shopify
          </button>

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
                      {p.category && (
                        <span
                          className="inline-block mt-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold"
                          style={{ background: `${ORANGE}20`, color: ORANGE }}
                        >
                          {p.category.name}
                        </span>
                      )}
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
          <div className="relative w-full max-w-lg bg-[#0D0D10] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
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

            <div className="overflow-y-auto flex-1 px-6 pb-2">
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

              {/* Category */}
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">Catégorie</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500/40 appearance-none"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <option value="">Aucune catégorie</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
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

              {/* Variants */}
              <TagInput
                label="Tailles (optionnel)"
                tags={form.sizes}
                onChange={(v) => setForm({ ...form, sizes: v })}
                placeholder="S, M, L, XL…"
              />
              <TagInput
                label="Modèles / Références (optionnel)"
                tags={form.models}
                onChange={(v) => setForm({ ...form, models: v })}
                placeholder="Pro, Lite, Classic…"
              />
              <TagInput
                label="Couleurs (optionnel)"
                tags={form.colors}
                onChange={(v) => setForm({ ...form, colors: v })}
                placeholder="Rouge, Bleu, Noir…"
              />

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono text-xs">{error}</span>
                </div>
              )}
            </div>
            </div>

            <div className="flex gap-3 p-6 pt-4 border-t border-white/[0.06] flex-shrink-0">
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

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowNewCategoryModal(false)}
          />
          <div className="relative w-full max-w-sm bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-mono font-bold text-white">Nouvelle catégorie</h2>
              <button
                onClick={() => setShowNewCategoryModal(false)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">Nom <span style={{ color: ORANGE }}>*</span></label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); }}
                  placeholder="Ex: Chaussures, Électronique…"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">Description (optionnel)</label>
                <input
                  type="text"
                  value={newCategoryDesc}
                  onChange={e => setNewCategoryDesc(e.target.value)}
                  placeholder="Description courte…"
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              {categoryError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono text-xs">{categoryError}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowNewCategoryModal(false)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateCategory}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: ORANGE }}
              >
                <Check className="w-4 h-4" />
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setEditingCategory(null)}
          />
          <div className="relative w-full max-w-sm bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-mono font-bold text-white">Modifier la catégorie</h2>
              <button
                onClick={() => setEditingCategory(null)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">Nom <span style={{ color: ORANGE }}>*</span></label>
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={e => setEditCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdateCategory(); }}
                  autoFocus
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-white/50 mb-1.5">Description (optionnel)</label>
                <input
                  type="text"
                  value={editCategoryDesc}
                  onChange={e => setEditCategoryDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              {categoryError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono text-xs">{categoryError}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditingCategory(null)}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateCategory}
                className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: ORANGE }}
              >
                <Check className="w-4 h-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!importing ? closeImportModal : undefined} />
          <div className="relative w-full max-w-md bg-[#0D0D10] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono font-bold text-white text-lg">
                {t('importFrom', { platform: importModal === 'woocommerce' ? 'WooCommerce' : 'Shopify' })}
              </h2>
              <button
                onClick={closeImportModal}
                disabled={importing}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importSuccess ? (
              /* ── Success state ── */
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="font-mono font-semibold text-white mb-1">
                  {importSuccess.imported} produit{importSuccess.imported > 1 ? 's' : ''} importé{importSuccess.imported > 1 ? 's' : ''} !
                </p>
                <p className="font-mono text-xs text-white/40">
                  {importSuccess.total} trouvés · {importSuccess.skipped} déjà présents
                </p>
                <button
                  onClick={closeImportModal}
                  className="mt-6 w-full py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: ORANGE }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-xs text-white/50 mb-1.5">
                      {t('importStoreUrl')}
                    </label>
                    <input
                      type="url"
                      value={importUrl}
                      onChange={(e) => { setImportUrl(e.target.value); setImportError(''); }}
                      placeholder={importModal === 'woocommerce' ? 'https://maboutique.com' : 'maboutique.myshopify.com'}
                      disabled={importing}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-white/50 mb-1.5">
                      {importModal === 'woocommerce' ? t('importKey') : t('importApiKey')}
                    </label>
                    <input
                      type="text"
                      value={importKey}
                      onChange={(e) => { setImportKey(e.target.value); setImportError(''); }}
                      placeholder={importModal === 'woocommerce' ? 'ck_...' : 'shpat_...'}
                      disabled={importing}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 disabled:opacity-50"
                    />
                  </div>
                  {importModal === 'woocommerce' && (
                    <div>
                      <label className="block font-mono text-xs text-white/50 mb-1.5">{t('importSecret')}</label>
                      <input
                        type="text"
                        value={importSecret}
                        onChange={(e) => { setImportSecret(e.target.value); setImportError(''); }}
                        placeholder="cs_..."
                        disabled={importing}
                        className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 disabled:opacity-50"
                      />
                    </div>
                  )}

                  {importError && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="font-mono text-xs text-red-400 leading-relaxed">{importError}</p>
                    </div>
                  )}

                  <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                    <p className="font-mono text-xs text-white/40 leading-relaxed">
                      {t('importSecurityNote')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={closeImportModal}
                    disabled={importing}
                    className="flex-1 py-2.5 rounded-xl font-mono text-sm text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-all disabled:opacity-30"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 py-2.5 rounded-xl font-mono text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: ORANGE }}
                  >
                    {importing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Import en cours…
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        {t('import')}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
