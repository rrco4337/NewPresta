// ProductCreateOptimized.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, type Product } from '../services/produitApi';
import { CreateProductData } from '../hooks/CreateProductData';
import { useFormValidation, productValidationSchema } from '../hooks/CreateProductValidation';
import { slugify } from '../utils/CreateProductValidation';
import ImageUpload from '../components/ImageUpload';
import { imageService } from '../services/imageApi';
import './ProductCreate.css';

const ProductCreateOptimized: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { categories, manufacturers, loading: loadingData } = CreateProductData();
  const [loading, setLoading] = useState(false);
  const [openSections, setOpenSections] = useState({
    general: true,
    description: false,
    pricing: false,
    shipping: false,
    seo: false,
    images: false
  });

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    reference: '',
    ean13: '',
    isbn: '',
    upc: '',
    mpn: '',
    price: 0,
    wholesale_price: 0,
    quantity: 0,
    minimal_quantity: 1,
    active: true,
    description: '',
    description_short: '',
    meta_title: '',
    meta_description: '',
    id_category_default: 2,
    id_manufacturer: 0,
    id_tax_rules_group: 1,
    width: 0,
    height: 0,
    depth: 0,
    weight: 0,
    additional_shipping_cost: 0,
    condition: 'new',
    visibility: 'both',
    available_for_order: true,
    show_price: true,
  });

  const { errors, touched, isValid, onTouch } = useFormValidation(formData, productValidationSchema);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  useEffect(() => {
    if (id) loadProductData(id);
  }, [id]);

  const loadProductData = async (productId: string) => {
    const product = await productService.getProduct(productId);
    if (product) setFormData(product);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
    onTouch(name);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const productData = { ...formData, link_rewrite: slugify(formData.name || '') };
      let createdProduct;
      
      if (id) {
        await productService.update(id, productData);
      } else {
        createdProduct = await productService.create(productData);
        
        // Upload des images après création
        if (createdProduct && imageFiles.length > 0) {
          for (const image of imageFiles) {
           // Au lieu de productService.uploadImage
            await imageService.upload(createdProduct.id, image);
          }
        }
        
        if (createdProduct && formData.quantity && formData.quantity > 0) {
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

  if (loadingData) return <div className="loader">Chargement des données...</div>;

  return (
    <div className="product-form-container">
      <h2>{id ? '✏️ Modifier le produit' : '➕ Nouveau produit'}</h2>
      
      <form onSubmit={handleSubmit} className="product-form">
        
        {/* Section 1: Informations générales */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('general')}>
            <span>📝 Informations générales</span>
            <span className={`accordion-icon ${openSections.general ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.general ? 'open' : ''}`}>
            <div className={`form-group ${touched.name && errors.name ? 'error' : touched.name ? 'valid' : ''}`}>
              <label>Nom du produit *</label>
              <input name="name" value={formData.name} onChange={handleChange} onBlur={() => onTouch('name')} />
              {errors.name && <span className="error-message">{errors.name}</span>}
              <small>URL générée : {slugify(formData.name || '')}</small>
            </div>
            
            <div className="form-row">
              <div className={`form-group ${touched.id_category_default && errors.id_category_default ? 'error' : ''}`}>
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
            
            <div className={`form-group ${touched.reference && errors.reference ? 'error' : touched.reference ? 'valid' : ''}`}>
              <label>Référence *</label>
              <input name="reference" value={formData.reference} onChange={handleChange} onBlur={() => onTouch('reference')} />
              {errors.reference && <span className="error-message">{errors.reference}</span>}
            </div>
          </div>
        </div>

        {/* Section 2: Images */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('images')}>
            <span>🖼️ Images</span>
            <span className={`accordion-icon ${openSections.images ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.images ? 'open' : ''}`}>
            <ImageUpload onImagesSelected={setImageFiles} maxImages={5} />
          </div>
        </div>

        {/* Section 3: Descriptions */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('description')}>
            <span>📄 Descriptions</span>
            <span className={`accordion-icon ${openSections.description ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.description ? 'open' : ''}`}>
            <div className="form-group">
              <label>Résumé (description courte)</label>
              <textarea name="description_short" rows={2} value={formData.description_short} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Description complète</label>
              <textarea name="description" rows={5} value={formData.description} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Section 4: Prix & Stock */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('pricing')}>
            <span>💰 Prix & Stock</span>
            <span className={`accordion-icon ${openSections.pricing ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.pricing ? 'open' : ''}`}>
            <div className="form-row">
              <div className={`form-group ${touched.price && errors.price ? 'error' : touched.price ? 'valid' : ''}`}>
                <label>Prix HT (€)</label>
                <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} onBlur={() => onTouch('price')} />
                {errors.price && <span className="error-message">{errors.price}</span>}
              </div>
              <div className={`form-group ${touched.quantity && errors.quantity ? 'error' : ''}`}>
                <label>Quantité</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} />
                {errors.quantity && <span className="error-message">{errors.quantity}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Livraison */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('shipping')}>
            <span>🚚 Livraison</span>
            <span className={`accordion-icon ${openSections.shipping ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.shipping ? 'open' : ''}`}>
            <div className="form-grid-4">
              <div className="form-group"><label>Largeur (cm)</label><input type="number" name="width" value={formData.width} onChange={handleChange} /></div>
              <div className="form-group"><label>Hauteur (cm)</label><input type="number" name="height" value={formData.height} onChange={handleChange} /></div>
              <div className="form-group"><label>Profondeur (cm)</label><input type="number" name="depth" value={formData.depth} onChange={handleChange} /></div>
              <div className="form-group"><label>Poids (kg)</label><input type="number" step="0.001" name="weight" value={formData.weight} onChange={handleChange} /></div>
            </div>
          </div>
        </div>

        {/* Section 6: SEO */}
        <div className="accordion-section">
          <div className="accordion-header" onClick={() => toggleSection('seo')}>
            <span>🔍 Référencement SEO</span>
            <span className={`accordion-icon ${openSections.seo ? 'open' : ''}`}>▼</span>
          </div>
          <div className={`accordion-content ${openSections.seo ? 'open' : ''}`}>
            <div className={`form-group ${touched.meta_title && errors.meta_title ? 'error' : ''}`}>
              <label>Meta title ({formData.meta_title?.length || 0}/70)</label>
              <input name="meta_title" value={formData.meta_title} onChange={handleChange} />
              {errors.meta_title && <span className="error-message">{errors.meta_title}</span>}
            </div>
            <div className={`form-group ${touched.meta_description && errors.meta_description ? 'error' : ''}`}>
              <label>Meta description ({formData.meta_description?.length || 0}/160)</label>
              <textarea name="meta_description" rows={2} value={formData.meta_description} onChange={handleChange} />
              {errors.meta_description && <span className="error-message">{errors.meta_description}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={() => navigate('/')}>Annuler</button>
          <button type="submit" className="btn-submit" disabled={loading || !isValid}>
            {loading ? 'Enregistrement...' : (id ? '💾 Mettre à jour' : '➕ Créer le produit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductCreateOptimized;