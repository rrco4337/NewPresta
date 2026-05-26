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
const ProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#f1f4f9', color: '#a3b0c8',
      }}>
        <i className="fa-regular fa-image" style={{ fontSize: '2rem' }}></i>
      </div>
    );
  }
  return (
    <img
      src={src} alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.45s ease' }}
      onError={() => setError(true)}
      className="product-img-scale"
    />
  );
};

// ── Badge stock ───────────────────────────────────────────────────────────────
const StockBadge: React.FC<{ qty: number }> = ({ qty }) => {
  const { label, level } = stockStatus(qty);
  const styles = {
    ok:  { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' },
    low: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
    out: { background: '#f1f4f9', color: '#6b7a99', border: '1px solid #d0d7e1' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      ...styles[level], borderRadius: '999px',
      padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      <i className={level === 'ok' ? 'fa-solid fa-circle-check' : level === 'low' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-xmark'}
        style={{ fontSize: '0.65rem' }}></i>
      {label}
    </span>
  );
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div style={{
    borderRadius: '16px', border: '1px solid #d0d7e1',
    background: '#fff', overflow: 'hidden',
  }}>
    <div style={{
      height: '210px',
      background: 'linear-gradient(90deg, #f2f5fa 0%, #ecedf5 50%, #f2f5fa 100%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-loading 1.5s ease-in-out infinite',
    }} />
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ height: '12px', width: '55%', borderRadius: '6px', background: 'linear-gradient(90deg, #f2f5fa 0%, #ecedf5 50%, #f2f5fa 100%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s ease-in-out infinite' }} />
      <div style={{ height: '16px', width: '80%', borderRadius: '6px', background: 'linear-gradient(90deg, #f2f5fa 0%, #ecedf5 50%, #f2f5fa 100%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s ease-in-out infinite' }} />
      <div style={{ height: '36px', width: '100%', borderRadius: '999px', marginTop: '4px', background: 'linear-gradient(90deg, #f2f5fa 0%, #ecedf5 50%, #f2f5fa 100%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s ease-in-out infinite' }} />
    </div>
  </div>
);

// ── Chip filtre actif ─────────────────────────────────────────────────────────
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: '#ecedf5', border: '1px solid #d0d7e1',
    borderRadius: '999px', padding: '4px 12px',
    fontSize: '0.78rem', fontWeight: 600, color: '#4a5568',
  }}>
    {label}
    <button type="button" onClick={onRemove} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#a3b0c8', display: 'flex', padding: '0',
    }}>
      <i className="fa-solid fa-xmark" style={{ fontSize: '0.7rem' }}></i>
    </button>
  </span>
);

// ── Page principale ───────────────────────────────────────────────────────────
const ShopHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [allProducts, setAllProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories]   = useState<ShopCategory[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [added, setAdded]             = useState<string | null>(null);

  const [searchInput, setSearchInput]   = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearch, setDebSearch] = useState(() => searchParams.get('q') ?? '');
  const [categoryId, setCategoryId]     = useState<number | null>(() =>
    searchParams.get('cat') ? Number(searchParams.get('cat')) : null
  );
  const [priceMin, setPriceMin] = useState(() => searchParams.get('pmin') ?? '');
  const [priceMax, setPriceMax] = useState(() => searchParams.get('pmax') ?? '');
  const [sortBy, setSortBy]     = useState<SortKey>(() => (searchParams.get('sort') as SortKey) ?? 'default');
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>(() => (searchParams.get('badge') as BadgeFilter) ?? 'all');
  const [dateRef, setDateRef]   = useState(() => searchParams.get('date') ?? '');

  const { addItem } = useCart();

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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

  useEffect(() => {
    setLoading(true);
    fetchShopProducts(categoryId ? { categoryId } : {})
      .then(setAllProducts)
      .catch(() => setError('Impossible de charger les produits.'))
      .finally(() => setLoading(false));
  }, [categoryId]);

  useEffect(() => { fetchShopCategories().then(setCategories); }, []);

  const handleAddToCart = (product: ShopProduct) => {
    if (product.quantity === 0) return;
    addItem({ id: product.id, name: product.name, priceHt: product.priceHt, priceTtc: product.priceTtc, taxRate: product.taxRate, imageUrl: product.imageUrl });
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1500);
  };

  const nowMs = useMemo(() => {
    if (!dateRef) return Date.now();
    const d = new Date(dateRef);
    d.setHours(23, 59, 59, 0);
    return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
  }, [dateRef]);

  const isSimulated = dateRef !== '';
  const priceMinNum = priceMin !== '' ? parseFloat(priceMin.replace(',', '.')) : null;
  const priceMaxNum = priceMax !== '' ? parseFloat(priceMax.replace(',', '.')) : null;
  const priceError  = priceMinNum !== null && priceMaxNum !== null && priceMinNum > priceMaxNum;

  const filtered = useMemo(() => {
    let result = allProducts;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q));
    }
    if (priceMinNum !== null && !Number.isNaN(priceMinNum)) result = result.filter(p => p.priceTtc >= priceMinNum);
    if (priceMaxNum !== null && !Number.isNaN(priceMaxNum) && !priceError) result = result.filter(p => p.priceTtc <= priceMaxNum);
    if (badgeFilter !== 'all') result = result.filter(p => getProductBadge(p.date_availability_produit, nowMs) === badgeFilter.toUpperCase());
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

  const hasActiveFilters = !!(debouncedSearch || categoryId || priceMin || priceMax || badgeFilter !== 'all' || dateRef || sortBy !== 'default');
  const selectedCategoryName = categories.find(c => c.id === categoryId)?.name;

  const resetFilters = () => {
    setSearchInput(''); setDebSearch(''); setCategoryId(null);
    setPriceMin(''); setPriceMax(''); setSortBy('default');
    setBadgeFilter('all'); setDateRef('');
  };

  return (
    <div style={{ paddingBottom: '80px' }}>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section id="collection" style={{
        marginTop: '32px', marginBottom: '48px',
        borderRadius: '24px', overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #0f1620 0%, #1e2f7a 50%, #2c47c0 100%)',
        boxShadow: '0 16px 48px rgba(67,97,238,0.25)',
      }}>
        {/* Motif de fond */}
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '380px', height: '380px', borderRadius: '50%', background: 'rgba(67,97,238,0.15)' }} />
          <div style={{ position: 'absolute', bottom: '-60px', left: '30%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(124,58,237,0.12)' }} />
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />
        </div>

        <div style={{
          position: 'relative', zIndex: 1,
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '40px', padding: '52px 52px',
          alignItems: 'center',
        }}
          className="shop-hero-grid"
        >
          {/* Left */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(67,97,238,0.3)', border: '1px solid rgba(67,97,238,0.5)',
              borderRadius: '999px', padding: '5px 14px',
              fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc',
              letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '20px',
            }}>
              <i className="fa-solid fa-sparkles" style={{ fontSize: '0.7rem' }}></i>
              Nouvelle collection 2026
            </div>
            <h1 style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
              fontWeight: 800, color: '#fff', lineHeight: 1.12,
              letterSpacing: '-0.5px', marginBottom: '16px',
            }}>
              Des essentiels<br />
              <span style={{ color: '#a5b4fc' }}>pensés pour vous</span>
            </h1>
            <p style={{
              fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.65, maxWidth: '380px', marginBottom: '28px',
            }}>
              Catalogue premium, navigation ultra-rapide et expérience d'achat fluide sur tous vos écrans.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="#essentiels" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '999px',
                background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                color: '#fff', fontSize: '0.875rem', fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 4px 16px rgba(67,97,238,0.4)',
              }}>
                <i className="fa-solid fa-arrow-right"></i>
                Voir le catalogue
              </a>
              <Link to="/shop/cart" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '999px',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: '0.875rem', fontWeight: 600,
                textDecoration: 'none', backdropFilter: 'blur(8px)',
              }}>
                <i className="fa-solid fa-cart-shopping"></i>
                Mon panier
              </Link>
            </div>

            {/* Features */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '32px', flexWrap: 'wrap' }}>
              {[
                { icon: 'fa-solid fa-truck-fast', label: 'Livraison 48h' },
                { icon: 'fa-solid fa-shield-halved', label: 'Paiement sécurisé' },
                { icon: 'fa-solid fa-rotate-left', label: 'Retours 30j' },
              ].map(f => (
                <div key={f.label} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)',
                }}>
                  <i className={f.icon} style={{ color: '#818cf8', fontSize: '0.85rem' }}></i>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              { icon: 'fa-solid fa-box', label: 'Produits',    val: loading ? '…' : String(allProducts.length), color: '#818cf8' },
              { icon: 'fa-solid fa-tag', label: 'Catégories',  val: loading ? '…' : String(categories.length), color: '#a78bfa' },
              { icon: 'fa-solid fa-star', label: 'Nouveautés', val: loading ? '…' : String(newCount),          color: '#34d399' },
              { icon: 'fa-solid fa-fire', label: 'Tendances',  val: loading ? '…' : String(hotCount),          color: '#fb923c' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '14px', padding: '20px',
                backdropFilter: 'blur(8px)',
              }}>
                <i className={stat.icon} style={{ color: stat.color, fontSize: '1.1rem', marginBottom: '10px', display: 'block' }}></i>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1,
                }}>{stat.val}</div>
                <div style={{
                  fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)',
                  fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginTop: '4px',
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bande promo ─────────────────────────────────────────────── */}
      <section id="promos" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '20px', flexWrap: 'wrap',
        background: '#fff', border: '1px solid #d0d7e1',
        borderRadius: '16px', padding: '24px 32px',
        marginBottom: '36px',
        boxShadow: '0 2px 8px rgba(15,22,40,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '1.1rem',
            boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
          }}>
            <i className="fa-solid fa-bolt"></i>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#a3b0c8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Offres du moment</p>
            <h2 style={{ margin: '4px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.15rem', fontWeight: 800, color: '#0f1620' }}>
              Jusqu'à -20% sur les essentiels urbains
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7a99' }}>Valable cette semaine sur une sélection de produits phares.</p>
          </div>
        </div>
        <a href="#essentiels" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 22px', borderRadius: '999px',
          background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
          color: '#fff', fontSize: '0.82rem', fontWeight: 700,
          textDecoration: 'none', boxShadow: '0 4px 12px rgba(67,97,238,0.3)',
          flexShrink: 0,
        }}>
          <i className="fa-solid fa-tag"></i>
          Voir les offres
        </a>
      </section>

      {/* ── Panneau filtres ─────────────────────────────────────────── */}
      <section id="essentiels" style={{
        background: '#fff', border: '1px solid #d0d7e1',
        borderRadius: '16px', padding: '20px',
        marginBottom: '32px',
        boxShadow: '0 2px 8px rgba(15,22,40,0.06)',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>

        {/* Ligne 1 : search + tri */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute', left: '13px', top: '50%',
              transform: 'translateY(-50%)', color: '#a3b0c8', fontSize: '0.82rem',
            }}></i>
            <input
              type="text" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Rechercher un produit, une référence…"
              style={{
                width: '100%', padding: '10px 36px 10px 36px',
                border: '1.5px solid #d0d7e1', borderRadius: '999px',
                background: '#f1f4f9', fontSize: '0.85rem', color: '#0f1620',
                outline: 'none', transition: 'border-color 0.15s, background 0.15s',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', background: 'none', border: 'none',
                cursor: 'pointer', color: '#a3b0c8', padding: '0',
              }}>
                <i className="fa-solid fa-xmark" style={{ fontSize: '0.82rem' }}></i>
              </button>
            )}
          </div>
          <select
            value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
            style={{
              padding: '10px 16px', border: '1.5px solid #d0d7e1', borderRadius: '999px',
              background: '#f1f4f9', fontSize: '0.83rem', fontWeight: 600, color: '#4a5568',
              outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            <option value="default">Tri par défaut</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="newest">Nouveautés d'abord</option>
          </select>
        </div>

        {/* Ligne 2 : catégorie + prix + badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <select
            value={categoryId ?? ''} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            style={{
              padding: '8px 14px', border: '1.5px solid #d0d7e1', borderRadius: '999px',
              background: '#f1f4f9', fontSize: '0.82rem', fontWeight: 600, color: '#4a5568',
              outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Prix */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            border: `1.5px solid ${priceError ? '#fca5a5' : '#d0d7e1'}`,
            background: priceError ? '#fef2f2' : '#f1f4f9',
            borderRadius: '999px', padding: '6px 14px',
          }}>
            <i className="fa-solid fa-euro-sign" style={{ fontSize: '0.75rem', color: '#a3b0c8' }}></i>
            <input type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)}
              placeholder="Min" style={{ width: '52px', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#4a5568', fontFamily: 'Inter, sans-serif' }} />
            <span style={{ color: '#d0d7e1' }}>—</span>
            <input type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)}
              placeholder="Max" style={{ width: '52px', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#4a5568', fontFamily: 'Inter, sans-serif' }} />
          </div>

          <div style={{ width: '1px', height: '24px', background: '#d0d7e1' }} />

          {/* Badges HOT/NEW */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { key: 'all' as BadgeFilter, label: 'Tout',    icon: 'fa-solid fa-border-all', count: allProducts.length },
              { key: 'hot' as BadgeFilter, label: 'HOT',     icon: 'fa-solid fa-fire',       count: hotCount },
              { key: 'new' as BadgeFilter, label: 'NEW',     icon: 'fa-solid fa-star',        count: newCount },
            ]).map(({ key, label, icon, count }) => {
              const active = badgeFilter === key;
              return (
                <button key={key} type="button" onClick={() => setBadgeFilter(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '7px 14px', borderRadius: '999px',
                  border: `1.5px solid ${active ? '#4361ee' : '#d0d7e1'}`,
                  background: active ? '#4361ee' : '#fff',
                  color: active ? '#fff' : '#6b7a99',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
                }}>
                  <i className={icon} style={{ fontSize: '0.72rem' }}></i>
                  {label}
                  {count > 0 && (
                    <span style={{
                      padding: '1px 7px', borderRadius: '999px',
                      background: active ? 'rgba(255,255,255,0.25)' : '#ecedf5',
                      color: active ? '#fff' : '#6b7a99',
                      fontSize: '0.68rem', fontWeight: 700,
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Erreur prix */}
        {priceError && (
          <p style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.78rem', color: '#dc2626', margin: 0,
          }}>
            <i className="fa-solid fa-circle-exclamation"></i>
            Le prix minimum ne peut pas être supérieur au prix maximum.
          </p>
        )}

        {/* Ligne 3 : chips actifs + compteur */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {debouncedSearch && <FilterChip label={`"${debouncedSearch}"`} onRemove={() => setSearchInput('')} />}
            {selectedCategoryName && <FilterChip label={selectedCategoryName} onRemove={() => setCategoryId(null)} />}
            {priceMin && !priceError && <FilterChip label={`≥ ${priceMin} €`} onRemove={() => setPriceMin('')} />}
            {priceMax && !priceError && <FilterChip label={`≤ ${priceMax} €`} onRemove={() => setPriceMax('')} />}
            {badgeFilter !== 'all' && <FilterChip label={badgeFilter === 'hot' ? '🔥 HOT' : '✨ NEW'} onRemove={() => setBadgeFilter('all')} />}
            {sortBy !== 'default' && <FilterChip label={sortBy === 'price-asc' ? 'Prix ↑' : sortBy === 'price-desc' ? 'Prix ↓' : 'Nouveautés'} onRemove={() => setSortBy('default')} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: '#a3b0c8', fontWeight: 600 }}>
              <i className="fa-solid fa-layer-group" style={{ marginRight: '5px' }}></i>
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </span>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} style={{
                padding: '5px 14px', borderRadius: '999px',
                border: '1.5px solid #d0d7e1', background: '#fff',
                fontSize: '0.78rem', fontWeight: 600, color: '#6b7a99',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                <i className="fa-solid fa-rotate-left" style={{ marginRight: '5px' }}></i>
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Simulation date */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
          borderRadius: '10px', padding: '10px 14px',
          background: isSimulated ? '#fffbeb' : '#f1f4f9',
          border: `1px solid ${isSimulated ? '#fde68a' : '#ecedf5'}`,
          fontSize: '0.82rem',
        }}>
          <i className="fa-regular fa-calendar" style={{ color: isSimulated ? '#d97706' : '#a3b0c8' }}></i>
          <span style={{ fontWeight: 600, color: isSimulated ? '#92400e' : '#6b7a99' }}>Simuler une date</span>
          <input type="date" value={dateRef}
            onChange={e => { setDateRef(e.target.value); setBadgeFilter('all'); }}
            style={{
              padding: '5px 10px', borderRadius: '7px',
              border: `1.5px solid ${isSimulated ? '#fbbf24' : '#d0d7e1'}`,
              background: '#fff', fontSize: '0.8rem', color: '#0f1620',
              outline: 'none', fontFamily: 'Inter, sans-serif',
            }}
          />
          {isSimulated && (
            <>
              <span style={{ fontSize: '0.78rem', color: '#d97706' }}>Badges calculés à cette date</span>
              <button type="button" onClick={() => { setDateRef(''); setBadgeFilter('all'); }} style={{
                marginLeft: 'auto', padding: '4px 12px', borderRadius: '999px',
                border: '1.5px solid #fbbf24', background: '#fff',
                fontSize: '0.78rem', fontWeight: 600, color: '#d97706',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                <i className="fa-solid fa-calendar-day" style={{ marginRight: '5px' }}></i>
                Aujourd'hui
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── En-tête catalogue ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        borderBottom: '1px solid #d0d7e1', paddingBottom: '16px', marginBottom: '24px',
        gap: '12px', flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#a3b0c8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <i className="fa-solid fa-store" style={{ marginRight: '6px', color: '#4361ee' }}></i>
            Catalogue ITU Project
          </p>
          <h2 style={{
            margin: '4px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '1.3rem', fontWeight: 800, color: '#0f1620',
          }}>
            {selectedCategoryName ?? 'Les collections du moment'}
          </h2>
        </div>
        <span style={{
          padding: '4px 14px', borderRadius: '999px',
          background: '#ecedf5', border: '1px solid #d0d7e1',
          fontSize: '0.78rem', fontWeight: 700, color: '#6b7a99',
        }}>
          {filtered.length} référence{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Erreur ──────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '12px',
          padding: '14px 18px', color: '#dc2626', fontSize: '0.85rem',
          marginBottom: '24px',
        }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          {error}
        </div>
      )}

      {/* ── Grille produits ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
            ? (
              <div style={{
                gridColumn: '1 / -1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
                border: '2px dashed #d0d7e1', borderRadius: '20px',
                padding: '64px 24px', textAlign: 'center',
                background: '#fff',
              }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '16px',
                  background: '#ecedf5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#a3b0c8', fontSize: '1.5rem',
                }}>
                  <i className="fa-solid fa-magnifying-glass"></i>
                </div>
                <p style={{ margin: 0, fontWeight: 700, color: '#4a5568', fontSize: '0.95rem' }}>
                  {badgeFilter === 'hot' ? 'Aucun produit HOT en ce moment.'
                    : badgeFilter === 'new' ? 'Aucun produit NEW en ce moment.'
                      : hasActiveFilters ? 'Aucun résultat pour ces filtres.'
                        : 'Aucun produit disponible.'}
                </p>
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} style={{
                    padding: '9px 20px', borderRadius: '999px',
                    border: '1.5px solid #d0d7e1', background: '#fff',
                    fontSize: '0.82rem', fontWeight: 600, color: '#6b7a99',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )
            : filtered.map(product => {
              const isAdded    = added === product.id;
              const isDisabled = product.quantity === 0;

              return (
                <div
                  key={product.id}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    borderRadius: '16px', border: '1px solid #d0d7e1',
                    background: '#fff', overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(15,22,40,0.05)',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 36px rgba(15,22,40,0.12)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(15,22,40,0.05)'; }}
                >
                  {/* Image */}
                  <Link to={`/shop/${product.id}`} style={{ display: 'block', position: 'relative', textDecoration: 'none' }}>
                    <div style={{
                      height: '210px', overflow: 'hidden',
                      background: '#f1f4f9', position: 'relative',
                      borderBottom: '1px solid #ecedf5',
                    }}>
                      <ProductBadge dateAvailability={product.date_availability_produit} className="availability-badge--corner" nowMs={nowMs} />
                      <ProductImage src={product.imageUrl} alt={product.name} />
                    </div>
                    {/* Hover overlay */}
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'flex-end', justifyContent: 'flex-end',
                      padding: '12px', opacity: 0, transition: 'opacity 0.2s',
                      pointerEvents: 'none',
                    }}
                      className="product-hover-overlay"
                    >
                      <span style={{
                        background: 'rgba(15,22,40,0.85)', color: '#fff',
                        fontSize: '0.72rem', fontWeight: 700, padding: '5px 12px',
                        borderRadius: '999px', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        <i className="fa-solid fa-eye"></i>
                        Voir le produit
                      </span>
                    </div>
                  </Link>

                  {/* Infos */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
                    <p style={{
                      margin: 0, fontSize: '0.67rem', fontWeight: 700,
                      color: '#a3b0c8', textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {product.reference ? `Réf · ${product.reference}` : 'Sélection'}
                    </p>
                    <h3 style={{
                      margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.95rem', fontWeight: 700, color: '#0f1620',
                      lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }} title={product.name}>
                      {product.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '1.1rem', fontWeight: 800, color: '#0f1620',
                      }}>
                        {formatPrice(product.priceTtc)}
                      </span>
                      <StockBadge qty={product.quantity} />
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                      <Link to={`/shop/${product.id}`} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '6px', padding: '9px', borderRadius: '999px',
                        border: '1.5px solid #d0d7e1', background: '#f1f4f9',
                        fontSize: '0.78rem', fontWeight: 600, color: '#6b7a99',
                        textDecoration: 'none', transition: 'border-color 0.15s, background 0.15s',
                      }}>
                        <i className="fa-regular fa-eye"></i>
                        Détails
                      </Link>
                      <button
                        disabled={isDisabled}
                        onClick={() => handleAddToCart(product)}
                        style={{
                          flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '7px', padding: '9px', borderRadius: '999px',
                          border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
                          fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.15s',
                          fontFamily: 'Inter, sans-serif',
                          background: isDisabled
                            ? '#f1f4f9'
                            : isAdded
                              ? '#10b981'
                              : 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                          color: isDisabled ? '#a3b0c8' : '#fff',
                          boxShadow: isDisabled || isAdded ? 'none' : '0 3px 10px rgba(67,97,238,0.3)',
                        }}
                      >
                        {isAdded ? (
                          <><i className="fa-solid fa-check"></i> Ajouté</>
                        ) : isDisabled ? (
                          <><i className="fa-solid fa-ban"></i> Rupture</>
                        ) : (
                          <><i className="fa-solid fa-cart-plus"></i> Ajouter</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* CSS overrides */}
      <style>{`
        .product-img-scale { transition: transform 0.45s ease !important; }
        div:hover > * > .product-img-scale { transform: scale(1.05); }
        div:hover .product-hover-overlay { opacity: 1 !important; pointer-events: auto !important; }

        @media (max-width: 768px) {
          .shop-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default ShopHome;
