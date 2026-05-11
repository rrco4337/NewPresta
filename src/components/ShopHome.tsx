import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import {
  fetchShopProducts,
  formatPrice,
  stockStatus,
  type ShopProduct,
} from '../services/shopService';
import './ShopHome.css';

// ── Image avec fallback ───────────────────────────────────────────────────────

const ProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="card-img-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} className="card-img" onError={() => setError(true)} />;
};

// ── Badge stock ───────────────────────────────────────────────────────────────

const StockBadge: React.FC<{ qty: number }> = ({ qty }) => {
  const { label, level } = stockStatus(qty);
  return <span className={`stock-badge stock-badge--${level}`}>{label}</span>;
};

// ── Skeleton card ─────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="product-card product-card--skeleton">
    <div className="card-img-placeholder skeleton-img" />
    <div className="card-body">
      <div className="skeleton-line skeleton-line--name" />
      <div className="skeleton-line skeleton-line--price" />
      <div className="skeleton-line skeleton-line--btn" />
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

  return (
    <div className="shop-home">
      {/* ── En-tête ── */}
      <div className="shop-hero">
        <h1 className="shop-hero-title">Notre boutique</h1>
        <p className="shop-hero-sub">{products.length} produit{products.length !== 1 ? 's' : ''} disponible{products.length !== 1 ? 's' : ''}</p>
        <div className="shop-search">
          <svg className="shop-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="shop-search-input"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="shop-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* ── États ── */}
      {error && <div className="shop-error">{error}</div>}

      {/* ── Grille produits ── */}
      <div className="products-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
            ? <p className="shop-empty">Aucun produit trouvé{search ? ` pour "${search}"` : ''}.</p>
            : filtered.map(product => (
                <div key={product.id} className="product-card">
                  <Link to={`/shop/${product.id}`} className="card-img-link">
                    <ProductImage src={product.imageUrl} alt={product.name} />
                    <div className="card-overlay">Voir le produit</div>
                  </Link>

                  <div className="card-body">
                    <h2 className="card-name" title={product.name}>{product.name}</h2>
                    {product.reference && (
                      <span className="card-ref">Réf : {product.reference}</span>
                    )}

                    <div className="card-price-row">
                      <span className="card-price">{formatPrice(product.priceTtc)}</span>
                      <StockBadge qty={product.quantity} />
                    </div>

                    <div className="card-actions">
                      <Link to={`/shop/${product.id}`} className="btn-outline">
                        Voir le produit
                      </Link>
                      <button
                        className={`btn-cart${added === product.id ? ' btn-cart--added' : ''}`}
                        disabled={product.quantity === 0}
                        onClick={() => handleAddToCart(product)}
                      >
                        {added === product.id ? '✓ Ajouté !' : (
                          <>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              ))
        }
      </div>
    </div>
  );
};

export default ShopHome;
