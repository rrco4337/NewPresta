import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, type Product } from '../services/produitApi';
import './ProductDetails.css';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'description'>('details');

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const data = await productService.getProduct(id!);
      if (data) {
        setProduct(data);
        setSelectedImage(data.imageUrl || null);
      } else {
        setError("Produit non trouvé");
      }
    } catch (err) {
      setError("Erreur lors du chargement du produit");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setQuantity(value);
    }
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddToCart = () => {
    // À implémenter avec votre logique panier
    console.log(`Ajout au panier: ${product?.name}, Quantité: ${quantity}`);
    alert(`Ajouté au panier: ${product?.name} x${quantity}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="product-details-loading">
        <div className="spinner"></div>
        <p>Chargement du produit...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-details-error">
        <h2>Erreur</h2>
        <p>{error || "Produit introuvable"}</p>
        <button onClick={() => navigate('/products')} className="btn-back">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="product-details-container">
      <button onClick={() => navigate('/products')} className="btn-back">
        ← Retour aux produits
      </button>

      <div className="product-details-content">
        {/* Section Image */}
        <div className="product-image-section">
          <div className="main-image">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} />
            ) : (
              <div className="no-image">
                <span>📷</span>
                <p>Pas d'image disponible</p>
              </div>
            )}
          </div>
          
          {/* Miniatures - à étendre si plusieurs images */}
          {product.imageUrl && (
            <div className="thumbnail-list">
              <div 
                className={`thumbnail ${selectedImage === product.imageUrl ? 'active' : ''}`}
                onClick={() => setSelectedImage(product.imageUrl)}
              >
                <img src={product.imageUrl} alt="Miniature" />
              </div>
            </div>
          )}
        </div>

        {/* Section Informations */}
        <div className="product-info-section">
          <h1 className="product-title">{product.name}</h1>
          
          <div className="product-meta">
            {product.reference && (
              <span className="product-ref">Réf: {product.reference}</span>
            )}
            {product.ean13 && (
              <span className="product-ean">EAN: {product.ean13}</span>
            )}
          </div>

          <div className="product-prices">
            <div className="price-sale">
              {formatPrice(product.price)}
              <span className="price-tax">HT</span>
            </div>
            {product.wholesale_price > 0 && product.wholesale_price !== product.price && (
              <div className="price-wholesale">
                Prix d'achat: {formatPrice(product.wholesale_price)}
              </div>
            )}
          </div>

          <div className="product-stock">
            {product.quantity > 0 ? (
              <span className="stock in-stock">
                ✓ En stock ({product.quantity} disponibles)
              </span>
            ) : (
              <span className="stock out-of-stock">
                ✗ Rupture de stock
              </span>
            )}
          </div>

          {/* Sélecteur quantité */}
          {product.quantity > 0 && (
            <div className="product-quantity">
              <label>Quantité :</label>
              <div className="quantity-selector">
                <button onClick={decrementQuantity} disabled={quantity <= 1}>
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={handleQuantityChange}
                  min="1"
                  max={product.quantity}
                />
                <button onClick={incrementQuantity} disabled={quantity >= product.quantity}>
                  +
                </button>
              </div>
            </div>
          )}

          {/* Bouton ajout panier */}
          <button 
            className="btn-add-to-cart"
            onClick={handleAddToCart}
            disabled={product.quantity === 0}
          >
            {product.quantity > 0 ? 'Ajouter au panier' : 'Indisponible'}
          </button>

          {/* Onglets */}
          <div className="product-tabs">
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Détails
              </button>
              <button 
                className={`tab-btn ${activeTab === 'description' ? 'active' : ''}`}
                onClick={() => setActiveTab('description')}
              >
                Description
              </button>
            </div>
            
            <div className="tab-content">
              {activeTab === 'details' && (
                <div className="details-tab">
                  <table className="details-table">
                    <tbody>
                      <tr>
                        <th>Référence</th>
                        <td>{product.reference || '-'}</td>
                      </tr>
                      <tr>
                        <th>EAN13</th>
                        <td>{product.ean13 || '-'}</td>
                      </tr>
                      <tr>
                        <th>Catégorie</th>
                        <td>{product.id_category_default}</td>
                      </tr>
                      <tr>
                        <th>Statut</th>
                        <td className={product.active ? 'active' : 'inactive'}>
                          {product.active ? 'Actif' : 'Inactif'}
                        </td>
                      </tr>
                      <tr>
                        <th>Description courte</th>
                        <td>{product.description_short || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              
              {activeTab === 'description' && (
                <div className="description-tab">
                  <div 
                    className="product-description"
                    dangerouslySetInnerHTML={{ __html: product.description || 'Aucune description disponible' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;