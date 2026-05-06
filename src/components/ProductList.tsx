

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/produitApi';
import type { Product } from '../services/produitApi';
import './ProductList.css';

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();

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
        loadProducts(); // Recharger la liste des produits
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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <button onClick={loadProducts} className="refresh-button">
            🔄 Actualiser
          </button>

          <button onClick={handleAddProduct} className="add-button">
            ➕ Ajouter un produit
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>

      <div className="stats">
        <p>
          {filteredProducts.length} produit(s) trouvé(s)
          {searchTerm && ` pour "${searchTerm}"`}
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