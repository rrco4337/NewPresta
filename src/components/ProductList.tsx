import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/produitApi';
import type { Product, ProductFilters } from '../services/produitApi';
import './ProductList.css';

interface Filters {
  idMin: string;
  idMax: string;
  name: string;
  reference: string;
  category: string;
  priceMin: string;
  priceMax: string;
  quantityMin: string;
  quantityMax: string;
  status: 'all' | 'active' | 'inactive';
}

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    idMin: '',
    idMax: '',
    name: '',
    reference: '',
    category: '',
    priceMin: '',
    priceMax: '',
    quantityMin: '',
    quantityMax: '',
    status: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>({});

  const navigate = useNavigate();

  const loadProducts = async (filtersToApply: ProductFilters) => {
    try {
      setLoading(true);
      const productsData = await productService.getAllProducts(filtersToApply);
      setProducts(productsData);
      setError(null);
    } catch (err) {
      setError(
        'Erreur lors du chargement des produits : ' +
          (err as Error).message
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts({});
  }, []);

  const toNumber = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const toText = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const buildFilterPayload = (): ProductFilters => ({
    idMin: toNumber(filters.idMin),
    idMax: toNumber(filters.idMax),
    name: toText(filters.name),
    reference: toText(filters.reference),
    categoryId: toNumber(filters.category),
    priceMin: toNumber(filters.priceMin),
    priceMax: toNumber(filters.priceMax),
    quantityMin: toNumber(filters.quantityMin),
    quantityMax: toNumber(filters.quantityMax),
    active: filters.status === 'all' ? undefined : filters.status === 'active',
  });

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      try {
        await productService.deleteProduct(productId);
        loadProducts(appliedFilters);
      } catch (error) {
        setError("Erreur lors de la suppression du produit.");
        console.error(error);
      }
    }
  };

  const formatPrice = (product: Product): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(product.price);
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildFilterPayload();
    setAppliedFilters(payload);
    loadProducts(payload);
  };

  const handleAddProduct = () => {
    navigate('/products/add');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement des produits...</p>
      </div>
    );
  }

  if (error) {
    return (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={() => loadProducts(appliedFilters)} className="retry-button">
            Réessayer
          </button>
        </div>
      );
  }

    return (
      <div className="product-list-container">
      <div className="products-header">
        <h1>Liste des Produits ({products.length})</h1>

        <div className="header-actions">
          <button onClick={() => loadProducts(appliedFilters)} className="refresh-button">
            Actualiser
          </button>

          <button onClick={handleAddProduct} className="add-button">
            Ajouter un produit
          </button>
        </div>
      </div>

      <form className="product-filters" onSubmit={handleSearch}>
        <div className="product-filters-row">
          <div className="filter-field filter-field--range">
            <label>ID</label>
            <div className="filter-range">
              <input
                type="number"
                placeholder="Min."
                value={filters.idMin}
                onChange={(e) => setFilters((prev) => ({ ...prev, idMin: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Max."
                value={filters.idMax}
                onChange={(e) => setFilters((prev) => ({ ...prev, idMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="filter-field">
            <label>Nom</label>
            <input
              type="text"
              placeholder="Chercher un nom"
              value={filters.name}
              onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="filter-field">
            <label>Référence</label>
            <input
              type="text"
              placeholder="Chercher une référence"
              value={filters.reference}
              onChange={(e) => setFilters((prev) => ({ ...prev, reference: e.target.value }))}
            />
          </div>

          <div className="filter-field">
            <label>Catégorie</label>
            <input
              type="number"
              placeholder="ID catégorie"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            />
          </div>

          <div className="filter-field filter-field--range">
            <label>Montant HT</label>
            <div className="filter-range">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Min."
                value={filters.priceMin}
                onChange={(e) => setFilters((prev) => ({ ...prev, priceMin: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Max."
                value={filters.priceMax}
                onChange={(e) => setFilters((prev) => ({ ...prev, priceMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="filter-field filter-field--range">
            <label>Quantité</label>
            <div className="filter-range">
              <input
                type="number"
                min="0"
                placeholder="Min."
                value={filters.quantityMin}
                onChange={(e) => setFilters((prev) => ({ ...prev, quantityMin: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                placeholder="Max."
                value={filters.quantityMax}
                onChange={(e) => setFilters((prev) => ({ ...prev, quantityMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="filter-field">
            <label>État</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as Filters['status'] }))}
            >
              <option value="all">Tous</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>

          <div className="filter-actions">
            <button type="submit" className="filter-search-btn">
              🔍 Rechercher
            </button>
          </div>
        </div>
      </form>

      <div className="stats">
        <p>{products.length} produit(s) trouvé(s)</p>
      </div>

      {products.length > 0 ? (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              <div className="product-image-wrapper">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="product-image"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                    }}
                  />
                ) : null}
                <div
                  className="product-image-placeholder"
                  style={{ display: product.imageUrl ? 'none' : 'flex' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              </div>

              <div className={`product-badge ${product.active ? 'active' : 'inactive'}`}>
                {product.active ? '✓ Actif' : '✗ Inactif'}
              </div>

              <div className="product-info">
                <h3 className="product-name">{product.name}</h3>

                <p className="product-reference">
                  Réf : {product.reference || 'Non renseignée'}
                </p>

                <p className="product-price">{formatPrice(product)}</p>

                <div className="product-actions">
                  <button
                    className="view-button"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    ✏️ Éditer
                  </button>
                  <button
                    className="view-button"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-results">
          <p>Aucun produit ne correspond à votre recherche.</p>
        </div>
      )}
    </div>
  );
};

export default ProductList;
