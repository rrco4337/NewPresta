import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import {
  fetchShopProductDetail,
  formatPrice,
  stockStatus,
  type ShopProduct,
  type ShopCombination,
} from '../services/shopService';
import { stockService } from '../services/stockApi'; // ← service stock
import ProductBadge from './ProductBadge';
import './ProductDetail.css';

// ── Image placeholder ─────────────────────────────────────────────────────────
const ImgPlaceholder = () => (
  <div className="detail-img-placeholder">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  </div>
);

// ── Galerie ───────────────────────────────────────────────────────────────────
const Gallery: React.FC<{ images: string[] }> = ({ images }) => {
  const [active, setActive] = useState(0);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});

  if (images.length === 0) {
    return (
      <div className="detail-gallery">
        <ImgPlaceholder />
      </div>
    );
  }

  return (
    <div className="detail-gallery">
      <div className="detail-main-img-wrap">
        {imgError[active] ? (
          <ImgPlaceholder />
        ) : (
          <img
            src={images[active]}
            alt="Produit"
            className="detail-main-img"
            onError={() => setImgError(p => ({ ...p, [active]: true }))}
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="detail-thumbnails">
          {images.map((url, i) => (
            <button
              key={i}
              className={`detail-thumb${active === i ? ' detail-thumb--active' : ''}`}
              onClick={() => setActive(i)}
            >
              {imgError[i] ? (
                <div className="detail-thumb-placeholder" />
              ) : (
                <img
                  src={url}
                  alt={`Vue ${i + 1}`}
                  onError={() => setImgError(p => ({ ...p, [i]: true }))}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sélecteur de quantité ─────────────────────────────────────────────────────
interface QtyProps {
  value: number;
  max: number;
  onChange: (n: number) => void;
}

const QtySelector: React.FC<QtyProps> = ({ value, max, onChange }) => (
  <div className="qty-selector">
    <button
      className="qty-btn"
      onClick={() => onChange(Math.max(1, value - 1))}
      disabled={value <= 1}
    >−</button>
    <input
      type="number"
      className="qty-input"
      value={value}
      min={1}
      max={max}
      onChange={e => {
        const n = parseInt(e.target.value, 10);
        if (!isNaN(n)) onChange(Math.min(max, Math.max(1, n)));
      }}
    />
    <button
      className="qty-btn"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
    >+</button>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct]           = useState<ShopProduct | null>(null);
  const [images, setImages]             = useState<string[]>([]);
  const [combinations, setCombinations] = useState<ShopCombination[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<ShopCombination | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [qty, setQty]                   = useState(1);
  const [added, setAdded]               = useState(false);

  // États pour le stock réel
  const [realStock, setRealStock]       = useState(0);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError]     = useState<string | null>(null);

  // 1. Chargement des infos produit
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchShopProductDetail(id)
      .then(data => {
        if (!data) { setError('Produit introuvable.'); return; }
        setProduct(data.product);
        setImages(data.images);
        setCombinations(data.combinations);
        setSelectedCombo(null);
        setQty(1);
      })
      .catch(() => setError('Impossible de charger ce produit.'))
      .finally(() => setLoading(false));
  }, [id]);

  // 2. Chargement du stock réel (dépend du produit et de la combinaison sélectionnée)
 useEffect(() => {
  if (!id) return;
  setStockLoading(true);
  const attributeId = selectedCombo ? String(selectedCombo.id) : '0';
  stockService.getStockQuantity(id, attributeId)
    .then(qty => setRealStock(qty))
    .catch(err => {
      console.error(err);
      setRealStock(0);
    })
    .finally(() => setStockLoading(false));
}, [id, selectedCombo]);

  // Calculs de prix
  const effectivePriceHt = product ? product.priceHt + (selectedCombo?.priceImpact ?? 0) : 0;
  const effectivePriceTtc = product ? effectivePriceHt * (1 + product.taxRate) : 0;
  // On utilise le stock réel pour la quantité disponible
  const effectiveQty = realStock;
  const hasCombinations = combinations.length > 0;
const canAdd = !stockLoading && effectiveQty > 0 && (!hasCombinations || selectedCombo !== null);
const maxQty = Math.max(1, Math.min(effectiveQty, 99));

  const handleAddToCart = () => {
    if (!product || !canAdd) return;
    addItem({
      id: product.id,
      attributeId: selectedCombo?.id,
      variantLabel: selectedCombo?.label,
      name: product.name,
      priceHt: effectivePriceHt,
      priceTtc: effectivePriceTtc,
      taxRate: product.taxRate,
      imageUrl: images[0],
    }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // ── Affichage ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-skeleton">
          <div className="detail-skeleton-img" />
          <div className="detail-skeleton-info">
            <div className="sk-line sk-line--title" />
            <div className="sk-line sk-line--price" />
            <div className="sk-line sk-line--desc" />
            <div className="sk-line sk-line--desc" />
            <div className="sk-line sk-line--btn" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="detail-page">
        <div className="detail-error">
          <p>{error ?? 'Produit introuvable.'}</p>
          <button className="btn-back" onClick={() => navigate('/shop')}>
            ← Retour à la boutique
          </button>
        </div>
      </div>
    );
  }

  const { label: stockLabel, level: stockLevel } = stockStatus(effectiveQty);
  const taxPct = Math.round(product.taxRate * 10000) / 100;

  return (
    <div className="detail-page">
      {/* ── Fil d'Ariane ── */}
      <nav className="detail-breadcrumb">
        <Link to="/shop">Boutique</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>

      <div className="detail-layout">
        <Gallery images={images} />

        <div className="detail-info">
          <div className="detail-info-top">
            <h1 className="detail-name">{product.name}</h1>
            {product.reference && (
              <p className="detail-ref">Réf : {product.reference}</p>
            )}
            <ProductBadge
              dateAvailability={product.date_availability_produit}
              className="availability-badge--inline"
            />
          </div>

          <div className="detail-price">{formatPrice(effectivePriceTtc)}</div>
          <div className="detail-tax">TVA: {taxPct}%</div>

          {/* Affichage du stock réel avec gestion du chargement */}
          {stockLoading ? (
            <span className="stock-badge stock-badge--loading">Vérification du stock...</span>
          ) : stockError ? (
            <span className="stock-badge stock-badge--error">⚠️ Stock indisponible</span>
          ) : (
            <>
              <span className={`stock-badge stock-badge--${stockLevel}`}>{stockLabel}</span>
              {effectiveQty > 0 && (
                <div className="detail-stock-count">Stock: {effectiveQty} disponible(s)</div>
              )}
            </>
          )}

          {hasCombinations && (
            <div className="detail-combinations">
              <p className="detail-combo-label">Déclinaison</p>
              <div className="detail-combo-options">
                {combinations.map(combo => {
                  // Désactiver les déclinaisons dont le stock réel est 0
                  // Pour ne pas faire un appel API par bouton, on pourrait précharger tous les stocks,
                  // mais ici on se contente d'afficher le stock de la sélection courante.
                  // Le bouton reste cliquable même si stock 0 ? On peut le désactiver visuellement.
                  const isOut = combo.quantity === 0; // Note: combo.quantity vient de shopService, pas du stock réel
                  return (
                    <button
                      key={combo.id}
                      type="button"
                      className={[
                        'detail-combo-btn',
                        selectedCombo?.id === combo.id ? 'detail-combo-btn--selected' : '',
                        isOut ? 'detail-combo-btn--out' : '',
                      ].join(' ').trim()}
                      onClick={() => setSelectedCombo(combo)}
                    >
                      {combo.label}
                      {combo.priceImpact > 0 && (
                        <span className="detail-combo-delta">
                          {` +${formatPrice(combo.priceImpact * (1 + product.taxRate))}`}
                        </span>
                      )}
                      {combo.priceImpact < 0 && (
                        <span className="detail-combo-delta detail-combo-delta--neg">
                          {` ${formatPrice(combo.priceImpact * (1 + product.taxRate))}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!selectedCombo && (
                <p className="detail-combo-hint">Veuillez sélectionner une déclinaison.</p>
              )}
            </div>
          )}

          {product.description_short && (
            <div
              className="detail-desc-short"
              dangerouslySetInnerHTML={{ __html: product.description_short }}
            />
          )}

          <div className="detail-purchase">
            {canAdd && !stockLoading && !stockError && (
              <div className="detail-qty-row">
                <label className="detail-qty-label">Quantité</label>
                <QtySelector value={qty} max={maxQty} onChange={setQty} />
              </div>
            )}

            <button
              className={`btn-add-cart${added ? ' btn-add-cart--added' : ''}`}
              disabled={!canAdd || stockLoading}
              onClick={handleAddToCart}
            >
              {added ? (
                '✓ Ajouté au panier !'
              ) : stockLoading ? (
                'Vérification...'
              ) : effectiveQty === 0 ? (
                'Rupture de stock'
              ) : hasCombinations && !selectedCombo ? (
                'Choisissez une déclinaison'
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
                  </svg>
                  Ajouter au panier
                </>
              )}
            </button>
          </div>

          {product.description && (
            <div className="detail-desc">
              <h3 className="detail-desc-title">Description</h3>
              <div
                className="detail-desc-body"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;