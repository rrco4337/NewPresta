import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService } from '../services/produitApi';
import './ProductCreate.css';

const ProductCreate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!!id);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | '', msg: string }>({ type: '', msg: '' });

  // État initial basé sur votre structure XML
  const [formData, setFormData] = useState({
    name: '',
    reference: '',
    ean13: '',
    price: 0, // Prix de vente HT
    wholesale_price: 0, // Prix d'achat
    quantity: 0,
    description: '',
    description_short: '',
    meta_title: '',
    active: true,
    id_category_default: 2,
    id_tax_rules_group: 1
  });

  // Charger les données du produit si on est en mode édition
  useEffect(() => {
    if (id) {
      loadProductData(id);
    }
  }, [id]);

  const loadProductData = async (productId: string) => {
    try {
      setLoadingProduct(true);
      const product = await productService.getProduct(productId);
      if (product) {
        setFormData({
          name: product.name,
          reference: product.reference,
          ean13: product.ean13,
          price: product.price,
          wholesale_price: product.wholesale_price,
          quantity: product.quantity,
          description: product.description,
          description_short: product.description_short,
          meta_title: product.meta_title,
          active: product.active,
          id_category_default: product.id_category_default,
          id_tax_rules_group: product.id_tax_rules_group
        });
      } else {
        setStatus({ type: 'error', msg: 'Impossible de charger le produit' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Erreur lors du chargement du produit' });
      console.error(err);
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      let result;
      if (id) {
        // Mode édition
        result = await productService.update(id, formData);
        if (result) {
          setStatus({ type: 'success', msg: `Produit "${result.name}" modifié avec succès!` });
          setTimeout(() => navigate('/'), 2000);
        }
      } else {
        // Mode création
        result = await productService.create(formData);
        if (result) {
          setStatus({ type: 'success', msg: `Produit "${result.name}" créé avec succès (ID: ${result.id})` });
          setTimeout(() => navigate('/'), 2000);
        }
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Erreur lors de la communication avec PrestaShop.' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="product-form-container">
        <div className="form-loading">
          <p>
            <span className="loading-spinner"></span>
            Chargement du produit...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="product-form-container">
      <div className="form-header">
        <h2>{id ? '✏️ Éditer le produit' : '➕ Créer un produit PrestaShop'}</h2>
        {id && (
          <button type="button" onClick={() => navigate('/')} className="btn-back">
            ← Retour
          </button>
        )}
      </div>

      {status.msg && (
        <div className={`form-status ${status.type}`}>
          {status.type === 'success' ? '✓' : '⚠️'} {status.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="product-form">
        {/* Section Informations de base */}
        <div className="section-title">📝 Informations de base</div>

        <div className="form-group full">
          <label htmlFor="name">Nom du produit *</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Ex: Chemise bleue"
          />
        </div>

        <div className="form-group">
          <label htmlFor="reference">Référence</label>
          <input
            id="reference"
            type="text"
            name="reference"
            value={formData.reference}
            onChange={handleChange}
            placeholder="Ex: SKU-001"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ean13">Code EAN13</label>
          <input
            id="ean13"
            type="text"
            name="ean13"
            value={formData.ean13}
            onChange={handleChange}
            placeholder="13 chiffres"
          />
        </div>

        {/* Section Tarifs */}
        <div className="section-title">💰 Tarifs</div>

        <div className="form-group">
          <label htmlFor="price">Prix de vente HT (€) *</label>
          <input
            id="price"
            type="number"
            step="0.01"
            name="price"
            value={formData.price}
            onChange={handleChange}
            required
            placeholder="0.00"
          />
        </div>

        <div className="form-group">
          <label htmlFor="wholesale_price">Prix d'achat (€)</label>
          <input
            id="wholesale_price"
            type="number"
            step="0.01"
            name="wholesale_price"
            value={formData.wholesale_price}
            onChange={handleChange}
            placeholder="0.00"
          />
        </div>

        {/* Section Stock */}
        <div className="section-title">📦 Stock</div>

        <div className="form-group">
          <label htmlFor="quantity">Quantité initiale *</label>
          <input
            id="quantity"
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            placeholder="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="id_category_default">ID Catégorie par défaut</label>
          <input
            id="id_category_default"
            type="number"
            name="id_category_default"
            value={formData.id_category_default}
            onChange={handleChange}
            placeholder="2"
          />
        </div>

        {/* Section SEO & Descriptions */}
        <div className="section-title">🔍 SEO & Descriptions</div>

        <div className="form-group full">
          <label htmlFor="meta_title">Titre SEO (Meta Title)</label>
          <input
            id="meta_title"
            type="text"
            name="meta_title"
            value={formData.meta_title}
            onChange={handleChange}
            placeholder="Titre pour les moteurs de recherche"
          />
        </div>

        <div className="form-group full">
          <label htmlFor="description_short">Résumé (Description courte)</label>
          <textarea
            id="description_short"
            name="description_short"
            value={formData.description_short}
            onChange={handleChange}
            rows={3}
            placeholder="Brève description du produit..."
          />
        </div>

        <div className="form-group full">
          <label htmlFor="description">Description complète</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={5}
            placeholder="Description détaillée (peut contenir du HTML)..."
          />
        </div>

        {/* Boutons d'action */}
        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Connexion à PrestaShop...
              </>
            ) : id ? (
              '💾 METTRE À JOUR LE PRODUIT'
            ) : (
              '➕ CRÉER LE PRODUIT'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductCreate;