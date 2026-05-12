import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import {
  fetchShopProducts,
  formatPrice,
  stockStatus,
  type ShopProduct,
} from '../services/shopService';
import ProductBadge from './ProductBadge';

// ── Image avec fallback ───────────────────────────────────────────────────────

const ProductImage: React.FC<{ src?: string; alt: string; className?: string }> = ({
  src,
  alt,
  className,
}) => {
  const [error, setError] = useState(false);
  const imgClassName = `h-full w-full object-cover ${className ?? ''}`;
  const placeholderClassName = `flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-100 text-slate-400 ${className ?? ''}`;
  if (!src || error) {
    return (
      <div className={placeholderClassName}>
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} className={imgClassName} onError={() => setError(true)} />;
};

// ── Badge stock ───────────────────────────────────────────────────────────────

const StockBadge: React.FC<{ qty: number }> = ({ qty }) => {
  const { label, level } = stockStatus(qty);
  const levelStyles: Record<typeof level, string> = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    low: 'border-amber-200 bg-amber-50 text-amber-700',
    out: 'border-slate-200 bg-slate-100 text-slate-500',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${levelStyles[level]}`}
    >
      {label}
    </span>
  );
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

// ── Page principale ───────────────────────────────────────────────────────────

const ShopHome: React.FC = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [added, setAdded]       = useState<string | null>(null);

  const { addItem } = useCart();

  useEffect(() => {
    fetchShopProducts()
      .then(setProducts)
      .catch(() => setError('Impossible de charger les produits.'))
      .finally(() => setLoading(false));
  }, []);

  const handleAddToCart = (product: ShopProduct) => {
    if (product.quantity === 0) return;
    addItem({
      id: product.id,
      name: product.name,
      priceHt: product.priceHt,
      priceTtc: product.priceTtc,
      taxRate: product.taxRate,
      imageUrl: product.imageUrl,
    });
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1500);
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.reference.toLowerCase().includes(search.toLowerCase())
  );

  const featured = !loading && filtered.length > 0 ? filtered[0] : null;
  const gridProducts = featured ? filtered.slice(1) : filtered;

  return (
    <div className="space-y-16 pb-20 pt-10">
      {/* ── Hero ── */}
      <section
        id="collection"
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-8 shadow-sm"
      >
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold text-emerald-700">
              Nouvelle collection
            </span>
            <h1 className="font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
              Une boutique moderne pour vos essentiels du quotidien.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              Des pièces sélectionnées, une navigation rapide, et une expérience d'achat fluide sur tous vos écrans.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#essentiels"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Voir le catalogue
              </a>
              <Link
                to="/shop/cart"
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
              >
                Mon panier
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Livraison', value: '48h' },
                { label: 'Retours', value: '30 jours' },
                { label: 'Support', value: '7j/7' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="font-display text-base text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {loading ? (
              <div className="animate-pulse rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg">
                <div className="h-3 w-32 rounded-full bg-slate-100" />
                <div className="mt-4 aspect-[4/3] rounded-2xl bg-slate-100" />
                <div className="mt-4 h-5 w-2/3 rounded-full bg-slate-100" />
                <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-100" />
              </div>
            ) : featured ? (
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Produit phare</p>
                  <StockBadge qty={featured.quantity} />
                </div>
                <Link to={`/shop/${featured.id}`} className="group mt-4 block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <ProductBadge
                      dateAvailability={featured.date_availability_produit}
                      className="availability-badge--corner"
                    />
                    <ProductImage
                      src={featured.imageUrl}
                      alt={featured.name}
                      className="transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h2 className="mt-4 font-display text-2xl text-slate-900 transition group-hover:text-slate-700">
                    {featured.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {featured.reference || 'Collection exclusive'}
                  </p>
                </Link>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-900">{formatPrice(featured.priceTtc)}</span>
                  <Link
                    to={`/shop/${featured.id}`}
                    className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Details
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
              {products.length} produit{products.length !== 1 ? 's' : ''} disponibles · Édition 2026
            </div>
          </div>
        </div>
      </section>

      {/* ── Recherche ── */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-xl">
          <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="w-full rounded-full border border-slate-200 bg-white px-11 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-900"
              onClick={() => setSearch('')}
            >
              Effacer
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          {['Tout', 'Nouveautés', 'Best sellers', 'Accessoires', 'Maison'].map((label) => (
            <button
              key={label}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 transition hover:border-slate-400 hover:text-slate-900"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Promo ── */}
      <section
        id="promos"
        className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:flex-row md:items-center md:justify-between"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Offres du moment</p>
          <h2 className="mt-2 font-display text-2xl text-slate-900">Jusqu'à -20% sur les essentiels urbains</h2>
          <p className="mt-2 text-sm text-slate-600">Valable cette semaine sur une sélection de produits phares.</p>
        </div>
        <a
          href="#essentiels"
          className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
        >
          Voir les offres
        </a>
      </section>

      {/* ── États ── */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ── Grille produits ── */}
      <section id="essentiels" className="space-y-6">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Essentiels</p>
            <h2 className="font-display text-2xl text-slate-900">Les collections du moment</h2>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {filtered.length} référence{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-sm text-slate-500">
                  Aucun produit trouvé{search ? ` pour \"${search}\"` : ''}.
                </div>
              )
              : gridProducts.map(product => {
                  const isAdded = added === product.id;
                  const isDisabled = product.quantity === 0;
                  const addButtonClasses = isDisabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : isAdded
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800';

                  return (
                    <div key={product.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <Link to={`/shop/${product.id}`} className="relative">
                        <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-200 bg-slate-100">
                          <ProductBadge
                            dateAvailability={product.date_availability_produit}
                            className="availability-badge--corner"
                          />
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            className="transition duration-500 group-hover:scale-105"
                          />
                        </div>
                        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                          <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white">
                            Voir le produit
                          </span>
                        </div>
                      </Link>

                      <div className="flex flex-1 flex-col gap-3 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {product.reference ? `Réf · ${product.reference}` : 'Sélection'}
                        </p>

                        <h3 className="font-display text-lg leading-snug text-slate-900" title={product.name}>
                          {product.name}
                        </h3>

                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold">{formatPrice(product.priceTtc)}</span>
                          <StockBadge qty={product.quantity} />
                        </div>

                        <div className="mt-auto flex flex-wrap gap-3">
                          <Link
                            to={`/shop/${product.id}`}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                          >
                            Détails
                          </Link>
                          <button
                            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${addButtonClasses}`}
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
      </section>
    </div>
  );
};

export default ShopHome;
