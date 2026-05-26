import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/produitApi';
import type { Product, ProductFilters } from '../services/produitApi';
import ProductBadge from './ProductBadge';

interface Filters {
  idMin: string; idMax: string; name: string; reference: string;
  category: string; priceMin: string; priceMax: string;
  quantityMin: string; quantityMax: string;
  status: 'all' | 'active' | 'inactive';
}

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filters, setFilters]   = useState<Filters>({
    idMin: '', idMax: '', name: '', reference: '', category: '',
    priceMin: '', priceMax: '', quantityMin: '', quantityMax: '', status: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>({});
  const navigate = useNavigate();

  const loadProducts = async (filtersToApply: ProductFilters) => {
    try {
      setLoading(true);
      const data = await productService.getAllProducts(filtersToApply);
      setProducts(data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des produits : ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts({}); }, []);

  const toNumber = (v: string) => { const n = Number(v.trim()); return v.trim() && !isNaN(n) ? n : undefined; };
  const toText   = (v: string) => v.trim() || undefined;

  const buildPayload = (): ProductFilters => ({
    idMin: toNumber(filters.idMin), idMax: toNumber(filters.idMax),
    name: toText(filters.name), reference: toText(filters.reference),
    categoryId: toNumber(filters.category),
    priceMin: toNumber(filters.priceMin), priceMax: toNumber(filters.priceMax),
    quantityMin: toNumber(filters.quantityMin), quantityMax: toNumber(filters.quantityMax),
    active: filters.status === 'all' ? undefined : filters.status === 'active',
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce produit ?')) return;
    try {
      await productService.deleteProduct(id);
      loadProducts(appliedFilters);
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    setAppliedFilters(payload);
    loadProducts(payload);
  };

  const formatPrice = (p: Product) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(p.price);

  // ── Champ filtre réutilisable ──
  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1.5px solid #d0d7e1', borderRadius: '8px',
    fontSize: '0.82rem', color: '#0f1620', background: '#f1f4f9',
    outline: 'none', width: '100%', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, background 0.15s',
  };

  const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '80px 0' }}>
        <div style={{
          width: '48px', height: '48px', border: '3px solid #ecedf5',
          borderTopColor: '#4361ee', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7a99', fontWeight: 600 }}>Chargement des produits…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        padding: '48px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#dc2626', fontSize: '1.2rem',
        }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <p style={{ margin: 0, color: '#dc2626', fontSize: '0.875rem', fontWeight: 600 }}>{error}</p>
        <button
          onClick={() => loadProducts(appliedFilters)}
          style={{
            padding: '9px 20px', borderRadius: '999px',
            background: '#4361ee', color: '#fff', border: 'none',
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <i className="fa-solid fa-rotate-right" style={{ marginRight: '6px' }}></i>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'slide-up 0.22s ease' }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(67,97,238,0.3)',
          }}>
            <i className="fa-solid fa-box"></i>
          </div>
          <div>
            <h1 style={{
              margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '1.3rem', fontWeight: 800, color: '#0f1620', letterSpacing: '-0.3px',
            }}>
              Produits
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#a3b0c8' }}>
              {products.length} produit{products.length !== 1 ? 's' : ''} trouvé{products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadProducts(appliedFilters)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', background: '#fff',
              border: '1.5px solid #d0d7e1', borderRadius: '10px',
              fontSize: '0.82rem', fontWeight: 600, color: '#4a5568',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#4361ee'; el.style.color = '#4361ee'; el.style.background = '#eef1fd'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#d0d7e1'; el.style.color = '#4a5568'; el.style.background = '#fff'; }}
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: '0.78rem' }}></i>
            Actualiser
          </button>
          <button
            onClick={() => navigate('/products/add')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px',
              background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
              border: 'none', borderRadius: '10px',
              fontSize: '0.82rem', fontWeight: 700, color: '#fff',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 12px rgba(67,97,238,0.3)',
              transition: 'box-shadow 0.15s, transform 0.1s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 16px rgba(67,97,238,0.4)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 12px rgba(67,97,238,0.3)'; }}
          >
            <i className="fa-solid fa-plus" style={{ fontSize: '0.78rem' }}></i>
            Ajouter un produit
          </button>
        </div>

      </div>

      {/* ── Formulaire filtres ── */}
      <form
        onSubmit={handleSearch}
        style={{
          background: '#fff', border: '1px solid #d0d7e1',
          borderRadius: '14px', padding: '20px',
          boxShadow: '0 2px 8px rgba(15,22,40,0.05)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
        }}>
          <i className="fa-solid fa-filter" style={{ color: '#4361ee', fontSize: '0.85rem' }}></i>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Filtres
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px', marginBottom: '16px',
        }}>
          {/* ID range */}
          <FilterField label="ID (min – max)">
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="number" placeholder="Min" value={filters.idMin}
                onChange={e => setFilters(p => ({ ...p, idMin: e.target.value }))}
                style={{ ...inputStyle, width: '50%' }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
              />
              <input type="number" placeholder="Max" value={filters.idMax}
                onChange={e => setFilters(p => ({ ...p, idMax: e.target.value }))}
                style={{ ...inputStyle, width: '50%' }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
              />
            </div>
          </FilterField>

          <FilterField label="Nom">
            <input type="text" placeholder="Recherche…" value={filters.name}
              onChange={e => setFilters(p => ({ ...p, name: e.target.value }))}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
            />
          </FilterField>

          <FilterField label="Référence">
            <input type="text" placeholder="Référence…" value={filters.reference}
              onChange={e => setFilters(p => ({ ...p, reference: e.target.value }))}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
            />
          </FilterField>

          <FilterField label="Catégorie (ID)">
            <input type="number" placeholder="ID catégorie" value={filters.category}
              onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
            />
          </FilterField>

          <FilterField label="Prix HT (min – max)">
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="number" min="0" step="0.01" placeholder="Min" value={filters.priceMin}
                onChange={e => setFilters(p => ({ ...p, priceMin: e.target.value }))}
                style={{ ...inputStyle, width: '50%' }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
              />
              <input type="number" min="0" step="0.01" placeholder="Max" value={filters.priceMax}
                onChange={e => setFilters(p => ({ ...p, priceMax: e.target.value }))}
                style={{ ...inputStyle, width: '50%' }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
              />
            </div>
          </FilterField>

          <FilterField label="Quantité (min – max)">
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="number" min="0" placeholder="Min" value={filters.quantityMin}
                onChange={e => setFilters(p => ({ ...p, quantityMin: e.target.value }))}
                style={{ ...inputStyle, width: '50%' }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
              />
              <input type="number" min="0" placeholder="Max" value={filters.quantityMax}
                onChange={e => setFilters(p => ({ ...p, quantityMax: e.target.value }))}
                style={{ ...inputStyle, width: '50%' }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
              />
            </div>
          </FilterField>

          <FilterField label="État">
            <select
              value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value as Filters['status'] }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = '#4361ee'; (e.target as HTMLElement).style.background = '#fff'; }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = '#d0d7e1'; (e.target as HTMLElement).style.background = '#f1f4f9'; }}
            >
              <option value="all">Tous</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </FilterField>
        </div>

        <button type="submit" style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          padding: '9px 20px',
          background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
          border: 'none', borderRadius: '9px',
          fontSize: '0.82rem', fontWeight: 700, color: '#fff',
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          boxShadow: '0 3px 10px rgba(67,97,238,0.3)',
        }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.78rem' }}></i>
          Rechercher
        </button>
      </form>

      {/* ── Résultats ── */}
      {products.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
          border: '2px dashed #d0d7e1', borderRadius: '16px',
          padding: '60px 24px', textAlign: 'center', background: '#fff',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: '#ecedf5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#a3b0c8', fontSize: '1.3rem',
          }}>
            <i className="fa-solid fa-box-open"></i>
          </div>
          <p style={{ margin: 0, fontWeight: 700, color: '#4a5568', fontSize: '0.95rem' }}>
            Aucun produit trouvé
          </p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#a3b0c8' }}>Modifiez vos filtres ou ajoutez un produit.</p>
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid #d0d7e1',
          borderRadius: '14px', overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15,22,40,0.05)',
        }}>
          {/* Table header */}
          <div style={{
            padding: '14px 24px', borderBottom: '1px solid #f1f4f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#f2f5fa',
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <i className="fa-solid fa-table" style={{ marginRight: '6px', color: '#4361ee' }}></i>
              {products.length} produit{products.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f2f5fa' }}>
                  {['#', 'Image', 'Nom', 'Référence', 'Prix HT', 'Quantité', 'État', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: h === 'Actions' ? 'right' : 'left',
                      fontSize: '0.65rem', fontWeight: 700, color: '#6b7a99',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      borderBottom: '1px solid #d0d7e1', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product, idx) => (
                  <tr
                    key={product.id}
                    style={{
                      borderBottom: idx < products.length - 1 ? '1px solid #f1f4f9' : 'none',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f2f5fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {/* ID */}
                    <td style={{ padding: '12px 16px', color: '#a3b0c8', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      #{product.id}
                    </td>

                    {/* Image */}
                    <td style={{ padding: '8px 16px' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '10px',
                        overflow: 'hidden', background: '#f1f4f9',
                        border: '1px solid #ecedf5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                      }}>
                        <ProductBadge
                          dateAvailability={product.date_availability_produit}
                          className="availability-badge--corner"
                        />
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                              (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                            }}
                          />
                        ) : null}
                        <div style={{
                          display: product.imageUrl ? 'none' : 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          width: '100%', height: '100%', color: '#d0d7e1',
                        }}>
                          <i className="fa-regular fa-image"></i>
                        </div>
                      </div>
                    </td>

                    {/* Nom */}
                    <td style={{ padding: '12px 16px', maxWidth: '220px' }}>
                      <span style={{
                        fontWeight: 600, color: '#0f1620', fontSize: '0.84rem',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {product.name}
                      </span>
                    </td>

                    {/* Référence */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600, color: '#6b7a99',
                        background: '#f1f4f9', padding: '3px 9px',
                        borderRadius: '6px', border: '1px solid #ecedf5',
                      }}>
                        {product.reference || '—'}
                      </span>
                    </td>

                    {/* Prix */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#0f1620', fontSize: '0.88rem' }}>
                        {formatPrice(product)}
                      </span>
                    </td>

                    {/* Quantité */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.75rem', fontWeight: 700,
                        padding: '3px 10px', borderRadius: '999px',
                        background: (product.quantity ?? 0) > 10 ? '#d1fae5' : (product.quantity ?? 0) > 0 ? '#fef3c7' : '#fee2e2',
                        color: (product.quantity ?? 0) > 10 ? '#065f46' : (product.quantity ?? 0) > 0 ? '#92400e' : '#9b1c1c',
                      }}>
                        <i className={`fa-solid fa-${(product.quantity ?? 0) > 10 ? 'circle-check' : (product.quantity ?? 0) > 0 ? 'circle-exclamation' : 'circle-xmark'}`} style={{ fontSize: '0.65rem' }}></i>
                        {product.quantity ?? 0}
                      </span>
                    </td>

                    {/* État */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.72rem', fontWeight: 700,
                        padding: '4px 10px', borderRadius: '999px',
                        background: product.active ? '#d1fae5' : '#fee2e2',
                        color: product.active ? '#065f46' : '#9b1c1c',
                      }}>
                        <i className={`fa-solid fa-${product.active ? 'circle-check' : 'circle-xmark'}`} style={{ fontSize: '0.65rem' }}></i>
                        {product.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => navigate(`/products/${product.id}`)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '6px 12px', borderRadius: '8px',
                            border: '1.5px solid #d0d7e1', background: '#f1f4f9',
                            fontSize: '0.75rem', fontWeight: 600, color: '#4a5568',
                            cursor: 'pointer', transition: 'all 0.12s',
                            fontFamily: 'Inter, sans-serif',
                          }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#4361ee'; el.style.color = '#4361ee'; el.style.background = '#eef1fd'; }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#d0d7e1'; el.style.color = '#4a5568'; el.style.background = '#f1f4f9'; }}
                        >
                          <i className="fa-regular fa-pen-to-square"></i>
                          Éditer
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '6px 12px', borderRadius: '8px',
                            border: '1.5px solid #fecaca', background: '#fff5f5',
                            fontSize: '0.75rem', fontWeight: 600, color: '#dc2626',
                            cursor: 'pointer', transition: 'all 0.12s',
                            fontFamily: 'Inter, sans-serif',
                          }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fee2e2'; el.style.borderColor = '#f87171'; }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff5f5'; el.style.borderColor = '#fecaca'; }}
                        >
                          <i className="fa-regular fa-trash-can"></i>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
