import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import {
  fetchShopCategories,
  fetchShopProducts,
  formatPrice,
  stockStatus,
  type ShopCategory,
  type ShopProduct,
} from '../services/shopService';
import ProductBadge from './ProductBadge';
import { getProductBadge, parseAvailabilityDate } from '../utils/productBadges';

type BadgeFilter = 'all' | 'hot' | 'new';
type SortKey = 'default' | 'price-asc' | 'price-desc' | 'newest';

// ── Image avec fallback ───────────────────────────────────────────────────────

const ProductImage: React.FC<{ src?: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-100 text-slate-400 ${className ?? ''}`}>
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} className={`h-full w-full object-cover ${className ?? ''}`} onError={() => setError(true)} />;
};

// ── Badge stock ───────────────────────────────────────────────────────────────

const StockBadge: React.FC<{ qty: number }> = ({ qty }) => {
  const { label, level } = stockStatus(qty);
  const styles = { ok: 'border-emerald-200 bg-emerald-50 text-emerald-700', low: 'border-amber-200 bg-amber-50 text-amber-700', out: 'border-slate-200 bg-slate-100 text-slate-500' };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles[level]}`}>{label}</span>;
};

// ── Skeleton card ─────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="aspect-[4/3] rounded-2xl bg-slate-100" />
    <div className="mt-4 space-y-3">
      <div className="h-4 w-2/3 rounded-full bg-slate-100" />
      <div className="h-3 w-1/3 rounded-full bg-slate-100" />
      <div className="h-10 w-full rounded-full bg-slate-100" />
    </div>
  </div>
);

// ── Chip filtre actif ─────────────────────────────────────────────────────────

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
    {label}
    <button type="button" onClick={onRemove} className="text-slate-400 transition hover:text-slate-700">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </span>
);

// ── Page principale ───────────────────────────────────────────────────────────

const ShopHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State produits & catégories ──
  const [allProducts, setAllProducts]   = useState<ShopProduct[]>([]);
  const [categories, setCategories]     = useState<ShopCategory[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [added, setAdded]               = useState<string | null>(null);

  // ── State filtres (initialisés depuis l'URL) ──
  const [searchInput, setSearchInput]   = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearch, setDebSearch] = useState(() => searchParams.get('q') ?? '');
  const [categoryId, setCategoryId]     = useState<number | null>(() =>
    searchParams.get('cat') ? Number(searchParams.get('cat')) : null
  );
  const [priceMin, setPriceMin]         = useState(() => searchParams.get('pmin') ?? '');
  const [priceMax, setPriceMax]         = useState(() => searchParams.get('pmax') ?? '');
  const [sortBy, setSortBy]             = useState<SortKey>(() =>
    (searchParams.get('sort') as SortKey) ?? 'default'
  );
  const [badgeFilter, setBadgeFilter]   = useState<BadgeFilter>(() =>
    (searchParams.get('badge') as BadgeFilter) ?? 'all'
  );
  const [dateRef, setDateRef]           = useState(() => searchParams.get('date') ?? '');

  const { addItem } = useCart();

  // ── Debounce recherche (300ms) ──
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Sync URL ──
  useEffect(() => {
    const p: Record<string, string> = {};
    if (searchInput)          p.q     = searchInput;
    if (categoryId)           p.cat   = String(categoryId);
    if (priceMin)             p.pmin  = priceMin;
    if (priceMax)             p.pmax  = priceMax;
    if (sortBy !== 'default') p.sort  = sortBy;
    if (badgeFilter !== 'all') p.badge = badgeFilter;
    if (dateRef)              p.date  = dateRef;
    setSearchParams(p, { replace: true });
  }, [searchInput, categoryId, priceMin, priceMax, sortBy, badgeFilter, dateRef]); // eslint-disable-line

  // ── Chargement produits (refetch si catégorie change) ──
  useEffect(() => {
    setLoading(true);
    fetchShopProducts(categoryId ? { categoryId } : {})
      .then(setAllProducts)
      .catch(() => setError('Impossible de charger les produits.'))
      .finally(() => setLoading(false));
  }, [categoryId]);

  // ── Chargement catégories (une seule fois) ──
  useEffect(() => {
    fetchShopCategories().then(setCategories);
  }, []);

  // ── Panier ──
  const handleAddToCart = (product: ShopProduct) => {
    if (product.quantity === 0) return;
    addItem({ id: product.id, name: product.name, priceHt: product.priceHt, priceTtc: product.priceTtc, taxRate: product.taxRate, imageUrl: product.imageUrl });
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1500);
  };

  // ── Date de référence ──
  const nowMs = useMemo(() => {
    if (!dateRef) return Date.now();
    const d = new Date(dateRef);
    d.setHours(23, 59, 59, 0);
    return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
  }, [dateRef]);

  const isSimulated = dateRef !== '';

  // ── Validation prix ──
  const priceMinNum = priceMin !== '' ? parseFloat(priceMin.replace(',', '.')) : null;
  const priceMaxNum = priceMax !== '' ? parseFloat(priceMax.replace(',', '.')) : null;
  const priceError  = priceMinNum !== null && priceMaxNum !== null && priceMinNum > priceMaxNum;

  // ── Filtrage + tri client-side ──
  const filtered = useMemo(() => {
    let result = allProducts;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q));
    }
    if (priceMinNum !== null && !Number.isNaN(priceMinNum)) {
      result = result.filter(p => p.priceTtc >= priceMinNum);
    }
    if (priceMaxNum !== null && !Number.isNaN(priceMaxNum) && !priceError) {
      result = result.filter(p => p.priceTtc <= priceMaxNum);
    }
    if (badgeFilter !== 'all') {
      result = result.filter(p => getProductBadge(p.date_availability_produit, nowMs) === badgeFilter.toUpperCase());
    }

    switch (sortBy) {
      case 'price-asc':  return [...result].sort((a, b) => a.priceTtc - b.priceTtc);
      case 'price-desc': return [...result].sort((a, b) => b.priceTtc - a.priceTtc);
      case 'newest':     return [...result].sort((a, b) => {
        const da = parseAvailabilityDate(a.date_availability_produit)?.getTime() ?? 0;
        const db = parseAvailabilityDate(b.date_availability_produit)?.getTime() ?? 0;
        return db - da;
      });
      default: return result;
    }
  }, [allProducts, debouncedSearch, priceMinNum, priceMaxNum, priceError, badgeFilter, nowMs, sortBy]);

  const hotCount = useMemo(() => allProducts.filter(p => getProductBadge(p.date_availability_produit, nowMs) === 'HOT').length, [allProducts, nowMs]);
  const newCount = useMemo(() => allProducts.filter(p => getProductBadge(p.date_availability_produit, nowMs) === 'NEW').length, [allProducts, nowMs]);

  // ── Filtres actifs ──
  const hasActiveFilters = !!(debouncedSearch || categoryId || priceMin || priceMax || badgeFilter !== 'all' || dateRef || sortBy !== 'default');
  const selectedCategoryName = categories.find(c => c.id === categoryId)?.name;

  const resetFilters = () => {
    setSearchInput(''); setDebSearch(''); setCategoryId(null);
    setPriceMin(''); setPriceMax(''); setSortBy('default');
    setBadgeFilter('all'); setDateRef('');
  };

  return (
    <div className="space-y-12 pb-20 pt-10">

      {/* ── Hero ── */}
      <section id="collection" className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-8 shadow-sm">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold text-emerald-700">Nouvelle collection</span>
            <h1 className="font-display text-4xl leading-tight text-slate-900 sm:text-5xl">Une boutique moderne pour vos essentiels du quotidien.</h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">Des pièces sélectionnées, une navigation rapide, et une expérience d'achat fluide sur tous vos écrans.</p>
            <div className="flex flex-wrap gap-3">
              <a href="#essentiels" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Voir le catalogue</a>
              <Link to="/shop/cart" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900">Mon panier</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[{ label: 'Livraison', value: '48h' }, { label: 'Retours', value: '30 jours' }, { label: 'Support', value: '7j/7' }].map(item => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="font-display text-base text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Produits', value: loading ? '…' : String(allProducts.length) },
                { label: 'Catégories', value: loading ? '…' : String(categories.length) },
                { label: 'Nouveautés', value: loading ? '…' : String(newCount) },
                { label: 'Tendances', value: loading ? '…' : String(hotCount) },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="mt-1 font-display text-3xl text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
              Catalogue mis à jour · Édition 2026
            </div>
          </div>
        </div>
      </section>

      {/* ── Panneau de filtres ── */}
      <section id="essentiels" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">

        {/* Ligne 1 : recherche + tri */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Rechercher un produit, une référence…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/10"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10 sm:w-52"
          >
            <option value="default">Tri par défaut</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="newest">Nouveautés d'abord</option>
          </select>
        </div>

        {/* Ligne 2 : catégorie + prix + badges */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Catégorie */}
          <select
            value={categoryId ?? ''}
            onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
          >
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Prix min / max */}
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${priceError ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-xs text-slate-400">€</span>
            <input
              type="number"
              min="0"
              value={priceMin}
              onChange={e => setPriceMin(e.target.value)}
              placeholder="Min"
              className="w-16 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            <span className="text-slate-300">—</span>
            <input
              type="number"
              min="0"
              value={priceMax}
              onChange={e => setPriceMax(e.target.value)}
              placeholder="Max"
              className="w-16 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* Séparateur */}
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />

          {/* Badges HOT / NEW */}
          <div className="flex gap-2">
            {([
              { key: 'all' as BadgeFilter, label: 'Tout',    count: allProducts.length },
              { key: 'hot' as BadgeFilter, label: '🔥 HOT',  count: hotCount },
              { key: 'new' as BadgeFilter, label: '✨ NEW',  count: newCount },
            ]).map(({ key, label, count }) => {
              const active = badgeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBadgeFilter(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-900'}`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Erreur prix */}
        {priceError && (
          <p className="flex items-center gap-1.5 text-xs text-rose-600">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Le prix minimum ne peut pas être supérieur au prix maximum.
          </p>
        )}

        {/* Ligne 3 : chips actifs + compteur + reset */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {debouncedSearch && <FilterChip label={`"${debouncedSearch}"`} onRemove={() => setSearchInput('')} />}
            {selectedCategoryName && <FilterChip label={selectedCategoryName} onRemove={() => setCategoryId(null)} />}
            {priceMin && !priceError && <FilterChip label={`≥ ${priceMin} €`} onRemove={() => setPriceMin('')} />}
            {priceMax && !priceError && <FilterChip label={`≤ ${priceMax} €`} onRemove={() => setPriceMax('')} />}
            {badgeFilter !== 'all' && <FilterChip label={badgeFilter === 'hot' ? '🔥 HOT' : '✨ NEW'} onRemove={() => setBadgeFilter('all')} />}
            {sortBy !== 'default' && <FilterChip label={sortBy === 'price-asc' ? 'Prix ↑' : sortBy === 'price-desc' ? 'Prix ↓' : 'Nouveautés'} onRemove={() => setSortBy('default')} />}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900">
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Ligne 4 : date de référence (simulation badges) */}
        <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${isSimulated ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
          <svg className={`h-4 w-4 shrink-0 ${isSimulated ? 'text-amber-500' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className={`text-xs font-medium ${isSimulated ? 'text-amber-700' : 'text-slate-500'}`}>Simuler une date</span>
          <input
            type="date"
            value={dateRef}
            onChange={e => { setDateRef(e.target.value); setBadgeFilter('all'); }}
            className={`rounded-lg border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 ${isSimulated ? 'border-amber-300 bg-white text-amber-800 focus:ring-amber-300' : 'border-slate-200 bg-white text-slate-700 focus:ring-slate-300'}`}
          />
          {isSimulated ? (
            <>
              <span className="text-xs text-amber-600">Badges calculés à cette date</span>
              <button type="button" onClick={() => { setDateRef(''); setBadgeFilter('all'); }} className="ml-auto rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
                Aujourd'hui
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">Modifie la date pour tester les badges HOT/NEW à n'importe quelle époque</span>
          )}
        </div>
      </section>

      {/* ── Promo ── */}
      <section id="promos" className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Offres du moment</p>
          <h2 className="mt-2 font-display text-2xl text-slate-900">Jusqu'à -20% sur les essentiels urbains</h2>
          <p className="mt-2 text-sm text-slate-600">Valable cette semaine sur une sélection de produits phares.</p>
        </div>
        <a href="#essentiels" className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400">Voir les offres</a>
      </section>

      {/* ── Erreur ── */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* ── En-tête grille ── */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalogue</p>
          <h2 className="font-display text-2xl text-slate-900">
            {selectedCategoryName ?? 'Les collections du moment'}
          </h2>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {filtered.length} référence{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Grille produits ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
            ? (
              <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <svg className="h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p className="text-sm font-medium text-slate-500">
                  {badgeFilter === 'hot' ? 'Aucun produit HOT en ce moment (moins de 24h).'
                  : badgeFilter === 'new' ? 'Aucun produit NEW en ce moment (moins de 7 jours).'
                  : hasActiveFilters ? 'Aucun résultat pour ces filtres.'
                  : 'Aucun produit disponible.'}
                </p>
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400">
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )
            : filtered.map(product => {
                const isAdded    = added === product.id;
                const isDisabled = product.quantity === 0;
                const btnCls     = isDisabled
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  : isAdded
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800';

                return (
                  <div key={product.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <Link to={`/shop/${product.id}`} className="relative">
                      <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-200 bg-slate-100">
                        <ProductBadge dateAvailability={product.date_availability_produit} className="availability-badge--corner" />
                        <ProductImage src={product.imageUrl} alt={product.name} className="transition duration-500 group-hover:scale-105" />
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                        <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white">Voir le produit</span>
                      </div>
                    </Link>

                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {product.reference ? `Réf · ${product.reference}` : 'Sélection'}
                      </p>
                      <h3 className="font-display text-lg leading-snug text-slate-900" title={product.name}>{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">{formatPrice(product.priceTtc)}</span>
                        <StockBadge qty={product.quantity} />
                      </div>
                      <div className="mt-auto flex flex-wrap gap-3">
                        <Link to={`/shop/${product.id}`} className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900">
                          Détails
                        </Link>
                        <button
                          className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${btnCls}`}
                          disabled={isDisabled}
                          onClick={() => handleAddToCart(product)}
                        >
                          {isAdded ? 'Ajouté' : (
                            <>
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                              </svg>
                              Ajouter
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
        }
      </div>
    </div>
  );
};

export default ShopHome;
