import axios from 'axios';
import type { AxiosInstance } from 'axios';


export interface Product {
  id: string;
  name: string;
  reference: string;
  ean13: string;
  isbn: string; // Ajouté
  upc: string;  // Ajouté
  mpn: string;  // Ajouté
  price: number; 
  wholesale_price: number;
  active: boolean;
  quantity: number;
  description: string;
  description_short: string; // Ton "recap"
  meta_title: string;
  meta_description: string;
  id_category_default: number;
  id_tax_rules_group: number;
  id_manufacturer: number;
  // Livraison
  width: number;
  height: number;
  depth: number;
  weight: number;
  additional_shipping_cost: number;
  // Stock / Vente
  minimal_quantity: number; // Ajouté
  available_for_order: boolean; // Ajouté
  show_price: boolean; // Ajouté
  // SEO & Visibilité
  condition: 'new' | 'used' | 'refurbished';
  visibility: 'both' | 'catalog' | 'search' | 'none';
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  }
});

const PrestashopMapper = {
  getLangValue: (field: any): string => {
    if (!field) return '';
    const lang = field.language;
    const target = Array.isArray(lang) ? lang[0] : lang;
    return target?._cdata || target?._text || (typeof target === 'string' ? target : '');
  },

  mapToFrontend: (p: any): Product => ({
    id: p.id?.toString() || '',
    name: PrestashopMapper.getLangValue(p.name),
    reference: p.reference || '',
    ean13: p.ean13 || '',
    isbn: p.isbn || '',
    upc: p.upc || '',
    mpn: p.mpn || '',
    price: parseFloat(p.price || '0'),
    wholesale_price: parseFloat(p.wholesale_price || '0'),
    active: p.active === '1',
    quantity: 0, 
    description: PrestashopMapper.getLangValue(p.description),
    description_short: PrestashopMapper.getLangValue(p.description_short),
    meta_title: PrestashopMapper.getLangValue(p.meta_title),
    meta_description: PrestashopMapper.getLangValue(p.meta_description),
    id_category_default: parseInt(p.id_category_default || '2'),
    id_tax_rules_group: parseInt(p.id_tax_rules_group || '1'),
    id_manufacturer: parseInt(p.id_manufacturer || '1'),
    width: parseFloat(p.width || '0'),
    height: parseFloat(p.height || '0'),
    depth: parseFloat(p.depth || '0'),
    weight: parseFloat(p.weight || '0'),
    additional_shipping_cost: parseFloat(p.additional_shipping_cost || '0'),
    minimal_quantity: parseInt(p.minimal_quantity || '1'),
    condition: p.condition || 'new',
    visibility: p.visibility || 'both',
    available_for_order: p.available_for_order !== undefined ? p.available_for_order : true,
    show_price: p.show_price !== undefined ? p.show_price : true
  }),

 // Dans PrestashopMapper.buildXml
// Dans PrestashopMapper, remplace la fonction buildXml par celle-ci :

buildXml: (product: Partial<Product>): string => {
  const linkRewrite = (product.name || 'product')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '-');
  
  // Nettoyage des codes barres
  const cleanIsbn = product.isbn?.trim() || '';
  const cleanEan13 = product.ean13?.trim() || '';
  const cleanUpc = product.upc?.trim() || '';
  const cleanMpn = product.mpn?.trim() || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
  <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <product>
      <!-- INFOS BASE -->
      <active><![CDATA[${product.active ? 1 : 0}]]></active>
      <state><![CDATA[1]]></state>
      <id_category_default><![CDATA[${product.id_category_default || 2}]]></id_category_default>
      <id_tax_rules_group><![CDATA[${product.id_tax_rules_group || 1}]]></id_tax_rules_group>
      <type><![CDATA[simple]]></type>
      
      <!-- PRIX -->
      <price><![CDATA[${product.price || 0}]]></price>
      <wholesale_price><![CDATA[${product.wholesale_price || 0}]]></wholesale_price>
      
      <!-- RÉFÉRENCES -->
      <reference><![CDATA[${product.reference || ''}]]></reference>
      <mpn><![CDATA[${cleanMpn}]]></mpn>
      <ean13><![CDATA[${cleanEan13}]]></ean13>
      <isbn><![CDATA[${cleanIsbn}]]></isbn>
      <upc><![CDATA[${cleanUpc}]]></upc>
      <minimal_quantity><![CDATA[${product.minimal_quantity || 1}]]></minimal_quantity>
      
      <!-- DIMENSIONS LIVRAISON -->
      <width><![CDATA[${product.width || 0}]]></width>
      <height><![CDATA[${product.height || 0}]]></height>
      <depth><![CDATA[${product.depth || 0}]]></depth>
      <weight><![CDATA[${product.weight || 0}]]></weight>
      <additional_shipping_cost><![CDATA[${product.additional_shipping_cost || 0}]]></additional_shipping_cost>
      
      <!-- CATÉGORIE & MARQUE -->
      <id_manufacturer><![CDATA[${product.id_manufacturer || 1}]]></id_manufacturer>
      
      <!-- VISIBILITÉ -->
      <visibility><![CDATA[${product.visibility || 'both'}]]></visibility>
      <available_for_order><![CDATA[${product.available_for_order ? 1 : 0}]]></available_for_order>
      <show_price><![CDATA[${product.show_price ? 1 : 0}]]></show_price>
      <condition><![CDATA[${product.condition || 'new'}]]></condition>
      
      <!-- NOM & URL -->
      <name><language id="1"><![CDATA[${product.name || ''}]]></language></name>
      <link_rewrite><language id="1"><![CDATA[${linkRewrite}]]></language></link_rewrite>
      
      <!-- DESCRIPTIONS -->
      <description_short><language id="1"><![CDATA[${product.description_short || ''}]]></language></description_short>
      <description><language id="1"><![CDATA[${product.description || ''}]]></language></description>
      
      <!-- SEO -->
      <meta_title><language id="1"><![CDATA[${product.meta_title || ''}]]></language></meta_title>
      <meta_description><language id="1"><![CDATA[${product.meta_description || ''}]]></language></meta_description>
      
      <!-- ASSOCIATIONS -->
      <associations>
        <categories>
          <category><id><![CDATA[${product.id_category_default || 2}]]></id></category>
        </categories>
      </associations>
    </product>
  </prestashop>`;
}
};
// ==========================================
// 4. SERVICE API
// ==========================================
export const productService = {

  async getAllProducts(): Promise<Product[]> {
    try {
      const response = await api.get('/products?display=full');
      const xmlData = parseXMLToJSON(response.data);
      const productsRoot = xmlData.prestashop?.products ?? xmlData.products;
      const rawProducts = productsRoot?.product;
      if (!rawProducts) return [];
      const list = Array.isArray(rawProducts) ? rawProducts : [rawProducts];
      return list.map((p) => PrestashopMapper.mapToFrontend(p));
    } catch (error) {
      console.error('Erreur getAllProducts:', error);
      return [];
    }
  },

  async getProduct(id: string): Promise<Product | null> {
    try {
      const response = await api.get(`/products/${id}?display=full`);
      const xmlData = parseXMLToJSON(response.data);
      const rawProduct = xmlData.prestashop?.product ?? xmlData.product;
      if (!rawProduct) return null;
      return PrestashopMapper.mapToFrontend(rawProduct);
    } catch (error) {
      console.error('Erreur getProduct:', error);
      return null;
    }
  },

  async create(data: Partial<Product>): Promise<Product | null> {
    try {
      const xml = PrestashopMapper.buildXml(data);
      const response = await api.post('/products', xml);
      const xmlData = parseXMLToJSON(response.data);
      const rawProduct = (xmlData.prestashop ?? xmlData).product;

      if (!rawProduct) {
        console.error('Structure de réponse inattendue :', xmlData);
        throw new Error('Le produit a été créé mais la réponse est illisible');
      }

      const createdProduct = PrestashopMapper.mapToFrontend(rawProduct);

      if (data.quantity && data.quantity > 0) {
        const stockInfo = rawProduct.associations?.stock_availables?.stock_available;
        const stockId = Array.isArray(stockInfo) ? stockInfo[0].id : stockInfo?.id;
        if (stockId) {
          await this.updateStock( createdProduct.id, data.quantity);
          createdProduct.quantity = data.quantity;
        }
      }

      return createdProduct;
    } catch (error: any) {
      if (error.response) console.error('Détails erreur API (create):', error.response.data);
      throw error;
    }
  },

  async update(id: string, data: Partial<Product>): Promise<Product | null> {
    try {
      const xml = PrestashopMapper.buildXml(data);
      const xmlWithId = xml.replace('<product>', `<product><id><![CDATA[${id}]]></id>`);
      const response = await api.put(`/products/${id}`, xmlWithId);
      const xmlData = parseXMLToJSON(response.data);
      const rawProduct = xmlData.prestashop?.product ?? xmlData.product;

      if (!rawProduct) throw new Error('Impossible de lire la réponse du serveur');

      const updatedProduct = PrestashopMapper.mapToFrontend(rawProduct);

      if (data.quantity !== undefined) {
        const stockInfo = rawProduct.associations?.stock_availables?.stock_available;
        const stockId = Array.isArray(stockInfo) ? stockInfo[0].id : stockInfo?.id;
        if (stockId) {
          await this.updateStock( id, data.quantity);
          updatedProduct.quantity = data.quantity;
        }
      }

      return updatedProduct;
    } catch (error: any) {
      if (error.response) console.error('Détails erreur API (update):', error.response.data);
      throw error;
    }
  },



  async deleteProduct(id: string): Promise<boolean> {
    try {
      await api.delete(`/products/${id}`);
      return true;
    } catch (error: any) {
      if (error.response) {
        console.error('Erreur suppression PrestaShop:', error.response.data);
      } else {
        console.error('Erreur de connexion lors de la suppression:', error);
      }
      return false;
    }
  },

  async getStock(id_product: string): Promise<number> {
  try {
    const response = await api.get(`/stock_availables?filter[id_product]=[${id_product}]`);
    const xmlData = parseXMLToJSON(response.data);
    const stocks = xmlData.prestashop?.stock_availables?.stock_available;
    if (!stocks) return 0;
    const stock = Array.isArray(stocks) ? stocks[0] : stocks;
    return parseInt(stock.quantity || '0');
  } catch (error) {
    console.error('Erreur récupération stock:', error);
    return 0;
  }
},
// Dans produitApi.ts - CORRECTION

async updateStock(productId: string, quantity: number): Promise<void> {
  try {
    // 🔴 CRUCIAL : Récupérer le vrai ID du stock_available (pas l'ID produit)
    const stockId = await this.getRealStockId(productId);
    
    const stockXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${stockId}]]></id>
    <id_product><![CDATA[${productId}]]></id_product>
    <quantity><![CDATA[${quantity}]]></quantity>
    <id_product_attribute><![CDATA[0]]></id_product_attribute>
    <id_shop><![CDATA[1]]></id_shop>
    <id_shop_group><![CDATA[0]]></id_shop_group>
    <depends_on_stock><![CDATA[0]]></depends_on_stock>
    <out_of_stock><![CDATA[0]]></out_of_stock>
  </stock_available>
</prestashop>`;
    
    // Utiliser stockId (82) pas productId (43)
    await api.put(`/stock_availables/${stockId}`, stockXml);
    console.log(`✅ Stock mis à jour: produit ${productId} -> ${quantity}`);
    
  } catch (error: any) {
    console.error('❌ Erreur updateStock:', error.response?.data || error.message);
    throw error;
  }
},

// Nouvelle méthode pour récupérer le vrai stock_available ID
async getRealStockId(productId: string): Promise<string> {
  try {
    const response = await api.get(`/stock_availables?filter[id_product]=[${productId}]&display=full`);
    const xmlData = parseXMLToJSON(response.data);
    
    // 🔍 LOG DÉTAILLÉ
    console.log('Structure complète de la réponse:', JSON.stringify(xmlData, null, 2));
    
    // Explorer toutes les possibilités
    const prestashop = xmlData.prestashop || xmlData;
    console.log('prestashop keys:', Object.keys(prestashop));
    
    const stockAvailables = prestashop.stock_availables || prestashop;
    console.log('stockAvailables keys:', Object.keys(stockAvailables));
    
    let stock = stockAvailables?.stock_available;
    console.log('stock_available:', stock);
    
    if (stock) {
      if (Array.isArray(stock)) stock = stock[0];
      if (stock?.id) {
        return stock.id.toString();
      }
    }
    
    return productId;
  } catch (error) {
    console.error(`Erreur recherche stock pour ${productId}:`, error);
    return productId;
  }
}
};

// ==========================================
// 5. PARSER XML → JSON (DOM)
// ==========================================
function parseXMLToJSON(xmlString: string): any {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  function parseNode(node: Element): any {
    if (node.children.length === 0) return node.textContent ?? '';
    const obj: any = {};
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const key = child.nodeName;
      const value = parseNode(child);
      if (obj[key] !== undefined) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }

  return parseNode(xmlDoc.documentElement);
}