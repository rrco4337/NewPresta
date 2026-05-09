// ProductCreateSimplified.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, type Product } from '../services/produitApi';
import { CreateProductData } from '../hooks/CreateProductData';
import { slugify } from '../utils/CreateProductValidation';
import ImageUpload from '../components/ImageUpload';
import { imageService } from '../services/imageApi';
import { usePriceCalculation } from '../hooks/TaxedPrice';
import { useTaxes } from '../hooks/UseTaxe';
import TaxSelector from '../components/TaxSelector';
import './ProductCreate.css';

const ProductCreate: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { categories, manufacturers, loading: loadingData } = CreateProductData();
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // État du formulaire simplifié
  const [formData, setFormData] = useState({
    // Générale
    name: '',
    description_short: '',
    description: '',
    reference: '',
    id_category_default: 2,
    id_manufacturer: 0,
    // Prix
    price: 0,
    wholesale_price: 0,
    id_tax_rules_group: 1,
    // Stock
    quantity: 0,
    minimal_quantity: 1,
    // Livraison
    width: 0,
    height: 0,
    depth: 0,
    weight: 0,
    additional_shipping_cost: 0,
    // Toujours actif
    active: true,
    visibility: 'both',
    available_for_order: true,
    show_price: true,
    condition: 'new' as const,
  });

  // Sections accordéon
  const [openSections, setOpenSections] = useState({
    general: true,
    pricing: false,
    stock: false,
    shipping: false
  });


  const { taxGroups } = useTaxes();
  const { 
    setPriceHT,   
    taxRate, 
    setTaxRate,
    result 
  } = usePriceCalculation(formData.price || 0, 20);

  useEffect(() => {
    if (id) loadProductData(id);
  }, [id]);

  const loadProductData = async (productId: string) => {
    const product = await productService.getProduct(productId);
    if (product) {
      setFormData({
        name: product.name || '',
        description_short: product.description_short || '',
        description: product.description || '',
        reference: product.reference || '',
        id_category_default: product.id_category_default || 2,
        id_manufacturer: product.id_manufacturer || 0,
        price: product.price || 0,
        wholesale_price: product.wholesale_price || 0,
        id_tax_rules_group: product.id_tax_rules_group || 1,
        quantity: product.quantity || 0,
        minimal_quantity: product.minimal_quantity || 1,
        width: product.width || 0,
        height: product.height || 0,
        depth: product.depth || 0,
        weight: product.weight || 0,
        additional_shipping_cost: product.additional_shipping_cost || 0,
        active: true,
        visibility: 'both',
        available_for_order: true,
        show_price: true,
        condition: 'new' as const,
      });
      setPriceHT(product.price || 0);
    }
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'number' ? parseFloat(value) || 0 : value;
    setFormData(prev => ({ ...prev, [name]: val }));
    if (name === 'price') setPriceHT(val as number);

  };

  const handleTaxChange = (groupId: string, rate: number) => {
    setFormData(prev => ({ ...prev, id_tax_rules_group: parseInt(groupId) }));
    setTaxRate(rate);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const productData: Partial<Product> = {
        ...formData,

        visibility: formData.visibility as 'both' | 'catalog' | 'search' | 'none'
      };
      
      let createdProduct;
      
      if (id) {
        await productService.update(id, productData);
        if(imageFiles.length > 0){
          for (const image of imageFiles) {
            await imageService.upload(id, image);
        }
        }
    
      } else {
        createdProduct = await productService.create(productData);
        
        if (createdProduct && imageFiles.length > 0) {
          for (const image of imageFiles) {
            await imageService.upload(createdProduct.id, image);
          }
        }
        
        if (createdProduct && formData.quantity > 0) {
          await productService.updateStock(createdProduct.id, formData.quantity);
        }
      }
      navigate('/');
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <div className="loader">Chargement...</div>;

  return (
    <div className="product-form-container">
      <h2>{id ? '✏️ Modifier le produit' : '➕ Nouveau produit'}</h2>
      
      <form onSubmit={handleSubmit} className="product-form">
        
        {/* SECTION 1: GÉNÉRALE */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('general')}>
            <span>📝 Générale</span>
            <span className={`accordion-icon ${openSections.general ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.general ? 'open' : ''}`}>
            
            {/* Images */}
            <div className="form-group">
              <label>🖼️ Images</label>
              <ImageUpload onImagesSelected={setImageFiles} maxImages={5} />
            </div>
            
            {/* Nom */}
            <div className="form-group">
              <label>Nom du produit *</label>
              <input name="name" value={formData.name} onChange={handleChange} required />
            </div>
            
            {/* Descriptions */}
            <div className="form-group">
              <label>Description courte (résumé)</label>
              <textarea name="description_short" rows={2} value={formData.description_short} onChange={handleChange} />
            </div>
            
            <div className="form-group">
              <label>Description complète</label>
              <textarea name="description" rows={4} value={formData.description} onChange={handleChange} />
            </div>
            
            {/* Référence */}
            <div className="form-group">
              <label>Référence *</label>
              <input name="reference" value={formData.reference} onChange={handleChange} required />
            </div>
            
            {/* Catégorie & Marque */}
            <div className="form-row">
              <div className="form-group">
                <label>Catégorie</label>
                <select name="id_category_default" value={formData.id_category_default} onChange={handleChange}>
                  <option value={0}>-- Sélectionner --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Marque</label>
                <select name="id_manufacturer" value={formData.id_manufacturer} onChange={handleChange}>
                  <option value={0}>-- Aucune --</option>
                  {manufacturers.map(man => (
                    <option key={man.id} value={man.id}>{man.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRIX */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('pricing')}>
            <span>💰 Prix</span>
            <span className={`accordion-icon ${openSections.pricing ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.pricing ? 'open' : ''}`}>
            
            <div className="form-row">
              <div className="form-group">
                <label>Prix HT (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="price" 
                  value={formData.price} 
                  onChange={handleChange} 
                />
              </div>
              
              <div className="form-group">
                <label>Prix d'achat HT (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="wholesale_price" 
                  value={formData.wholesale_price} 
                  onChange={handleChange} 
                />
              </div>
            </div>

            {/* Sélecteur TVA */}
            <TaxSelector 
              taxGroups={taxGroups}
              selectedId={formData.id_tax_rules_group?.toString() || '1'}
              onChange={handleTaxChange}
            />

            {/* Prix TTC calculé */}
            <div className="price-calculation">
              <div className="price-line total">
                <span>💰 Prix TTC :</span>
                <strong>{result.priceTTC} €</strong>
              </div>
              <small>TVA ({taxRate}%) = {result.taxAmount} €</small>

            </div>
          </div>
        </div>

        {/* SECTION 3: STOCK */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('stock')}>
            <span>📦 Stock</span>
            <span className={`accordion-icon ${openSections.stock ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.stock ? 'open' : ''}`}>
            
            <div className="form-row">
              <div className="form-group">
                <label>Quantité</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} />
              </div>
              
              <div className="form-group">
                <label>Quantité minimale de vente</label>
                <input type="number" name="minimal_quantity" value={formData.minimal_quantity} onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: LIVRAISON */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('shipping')}>
            <span>🚚 Livraison</span>
            <span className={`accordion-icon ${openSections.shipping ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.shipping ? 'open' : ''}`}>
            
            <div className="form-grid-4">
              <div className="form-group">
                <label>Longueur (cm)</label>
                <input type="number" step="0.1" name="width" value={formData.width} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Largeur (cm)</label>
                <input type="number" step="0.1" name="height" value={formData.height} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Profondeur (cm)</label>
                <input type="number" step="0.1" name="depth" value={formData.depth} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Poids (kg)</label>
                <input type="number" step="0.001" name="weight" value={formData.weight} onChange={handleChange} />
              </div>
            </div>
            
            <div className="form-group">
              <label>Frais de livraison supplémentaires (€)</label>
              <input type="number" step="0.01" name="additional_shipping_cost" value={formData.additional_shipping_cost} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={() => navigate('/')}>
            Annuler
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Enregistrement...' : (id ? '💾 Mettre à jour' : '➕ Créer le produit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductCreate;