import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/produitApi';
import type { Product } from '../services/produitApi';
import { useAuth } from '../contexts/AuthContext';
import './ProductList.css';

interface Filters {
  name: string;
  priceMin: number | '';
  priceMax: number | '';
  statusFilter: 'all' | 'active' | 'inactive';
  stockFilter: 'all' | 'inStock' | 'outOfStock';
  sortBy: 'name' | 'price' | 'reference';
  sortOrder: 'asc' | 'desc';
}

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    name: '',
    priceMin: '',
    priceMax: '',
    statusFilter: 'all',
    stockFilter: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsData = await productService.getAllProducts();
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

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      try {
        await productService.deleteProduct(productId);
        loadProducts();
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

  const applyFilters = (productsToFilter: Product[]): Product[] => {
    let filtered = productsToFilter;

    // Filtrer par nom
    if (filters.name) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(filters.name.toLowerCase()) ||
        product.reference.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    // Filtrer par prix
    if (filters.priceMin !== '') {
      filtered = filtered.filter((product) => product.price >= filters.priceMin);
    }
    if (filters.priceMax !== '') {
      filtered = filtered.filter((product) => product.price <= filters.priceMax);
    }

    // Filtrer par statut
    if (filters.statusFilter === 'active') {
      filtered = filtered.filter((product) => product.active);
    } else if (filters.statusFilter === 'inactive') {
      filtered = filtered.filter((product) => !product.active);
    }

    // Filtrer par stock
    if (filters.stockFilter === 'inStock') {
      filtered = filtered.filter((product) => product.quantity > 0);
    } else if (filters.stockFilter === 'outOfStock') {
      filtered = filtered.filter((product) => product.quantity === 0);
    }

    // Appliquer le tri
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'reference':
          comparison = a.reference.localeCompare(b.reference);
          break;
        default:
          comparison = 0;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredProducts = applyFilters(products);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      name: '',
      priceMin: '',
      priceMax: '',
      statusFilter: 'all',
      stockFilter: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    });
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
        <button onClick={loadProducts} className="retry-button">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="product-list-container">
      <div className="products-header">
        <h1>Liste des Produits ({filteredProducts.length})</h1>

        <div className="header-actions">
          <span className="header-user">{user?.email}</span>

          <button onClick={loadProducts} className="refresh-button">
            🔄 Actualiser
          </button>

          <button onClick={handleAddProduct} className="add-button">
            ➕ Ajouter un produit
          </button>

          <button onClick={handleLogout} className="logout-button">
            Déconnexion
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={filters.name}
          onChange={(e) => handleFilterChange('name', e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>

      {/* Bouton pour afficher/masquer les filtres */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="filters-toggle"
      >
        {showFilters ? '▼' : '▶'} 🔧 Filtres avancés
      </button>

      {/* Panneau de filtres */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            {/* Filtres de prix */}
            <div className="filter-group">
              <label htmlFor="priceMin">Prix minimum (€)</label>
              <input
                id="priceMin"
                type="number"
                min="0"
                step="0.01"
                placeholder="Min"
                value={filters.priceMin}
                onChange={(e) => handleFilterChange('priceMin', e.target.value ? parseFloat(e.target.value) : '')}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="priceMax">Prix maximum (€)</label>
              <input
                id="priceMax"
                type="number"
                min="0"
                step="0.01"
                placeholder="Max"
                value={filters.priceMax}
                onChange={(e) => handleFilterChange('priceMax', e.target.value ? parseFloat(e.target.value) : '')}
              />
            </div>

            {/* Filtre de statut */}
            <div className="filter-group">
              <label htmlFor="statusFilter">Statut</label>
              <select
                id="statusFilter"
                value={filters.statusFilter}
                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
              >
                <option value="all">Tous les statuts</option>
                <option value="active">✓ Actifs</option>
                <option value="inactive">✗ Inactifs</option>
              </select>
            </div>

            {/* Filtre de stock */}
            <div className="filter-group">
              <label htmlFor="stockFilter">Stock</label>
              <select
                id="stockFilter"
                value={filters.stockFilter}
                onChange={(e) => handleFilterChange('stockFilter', e.target.value)}
              >
                <option value="all">Tous</option>
                <option value="inStock">📦 En stock</option>
                <option value="outOfStock">❌ Rupture</option>
              </select>
            </div>

            {/* Tri */}
            <div className="filter-group">
              <label htmlFor="sortBy">Trier par</label>
              <select
                id="sortBy"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                <option value="name">Nom</option>
                <option value="price">Prix</option>
                <option value="reference">Référence</option>
              </select>
            </div>

            {/* Ordre de tri */}
            <div className="filter-group">
              <label htmlFor="sortOrder">Ordre</label>
              <select
                id="sortOrder"
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              >
                <option value="asc">Croissant ↑</option>
                <option value="desc">Décroissant ↓</option>
              </select>
            </div>
          </div>

          {/* Bouton pour réinitialiser les filtres */}
          <button onClick={resetFilters} className="reset-filters-btn">
            🔄 Réinitialiser les filtres
          </button>
        </div>
      )}

      <div className="stats">
        <p>
          {filteredProducts.length} produit(s) trouvé(s)
          {filters.name && ` pour "${filters.name}"`}
          {(filters.priceMin !== '' || filters.priceMax !== '') && ` • Prix: ${filters.priceMin || '0'}€ - ${filters.priceMax || '∞'}€`}
          {filters.statusFilter !== 'all' && ` • ${filters.statusFilter === 'active' ? 'Actifs' : 'Inactifs'}`}
          {filters.stockFilter !== 'all' && ` • ${filters.stockFilter === 'inStock' ? 'En stock' : 'Rupture'}`}
        </p>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <div key={product.id} className="product-card">
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