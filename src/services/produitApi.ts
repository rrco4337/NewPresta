import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ==========================================
// 1. TYPES
// ==========================================
export interface Product {
  id: string;
  name: string;
  reference: string;
  ean13: string;
  price: number; // Prix de vente HT
  wholesale_price: number; // Prix d'achat
  active: boolean;
  quantity: number;
  description: string;
  description_short: string;
  meta_title: string;
  id_category_default: number;
  id_tax_rules_group: number;
  date_availability_produit?: string;
  imageUrl?: string;
}

export interface ProductFilters {
  idMin?: number;
  idMax?: number;
  name?: string;
  reference?: string;
  categoryId?: number;
  priceMin?: number;
  priceMax?: number;
  quantityMin?: number;
  quantityMax?: number;
  active?: boolean;
}

// ==========================================
// 2. CONFIGURATION AXIOS
// ==========================================
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  }
});

// ==========================================
// 3. LOGIQUE DE TRANSFORMATION (MAPPER)
// ==========================================
const PrestashopMapper = {
  getLangValue: (field: any): string => {
    if (!field) return '';
    const lang = field.language;
    if (!lang) return '';
    const target = Array.isArray(lang) ? lang[0] : lang;
    return target._cdata || target._text || (typeof target === 'string' ? target : '');
  },

  mapToFrontend: (p: any): Product => {
    const id = p.id?.toString() || '';
    const imageAssoc = p.associations?.images?.image;
    const firstImage = Array.isArray(imageAssoc) ? imageAssoc[0] : imageAssoc;
    const imageId = firstImage?.id;
    const imageUrl = id && imageId ? `/api/images/products/${id}/${imageId}` : undefined;
    const dateAvailability =
      p.date_availability_produit || p.date_available || '';

    return {
      id,
      name: PrestashopMapper.getLangValue(p.name),
      reference: p.reference || '',
      ean13: p.ean13 || '',
      price: parseFloat(p.price || '0'),
      wholesale_price: parseFloat(p.wholesale_price || '0'),
      active: p.active === '1',
      quantity: 0,
      description: PrestashopMapper.getLangValue(p.description),
      description_short: PrestashopMapper.getLangValue(p.description_short),
      meta_title: PrestashopMapper.getLangValue(p.meta_title),
      id_category_default: parseInt(p.id_category_default || '2'),
      id_tax_rules_group: parseInt(p.id_tax_rules_group || '1'),
      date_availability_produit: dateAvailability ? String(dateAvailability) : undefined,
      imageUrl,
    };
  },

 // Dans PrestashopMapper (produitApi.ts)
buildXml: (product: Partial<Product>): string => {
  const linkRewrite = (product.name || 'product')
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '-');
  
  // On ne génère la balise EAN que si elle est valide (13 chiffres)
  const eanTag = (product.ean13 && /^\d{13}$/.test(product.ean13)) 
    ? `<ean13><![CDATA[${product.ean13}]]></ean13>` 
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
  <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <product>
      <active><![CDATA[${product.active ? 1 : 0}]]></active>
      <state><![CDATA[1]]></state>
      <id_category_default><![CDATA[${product.id_category_default || 2}]]></id_category_default>
      <id_tax_rules_group><![CDATA[${product.id_tax_rules_group || 1}]]></id_tax_rules_group>
      <type><![CDATA[simple]]></type>
      <price><![CDATA[${product.price || 0}]]></price>
      <wholesale_price><![CDATA[${product.wholesale_price || 0}]]></wholesale_price>
      <reference><![CDATA[${product.reference || ''}]]></reference>
      ${eanTag}
      ${product.date_availability_produit ? `<date_availability_produit><![CDATA[${product.date_availability_produit}]]></date_availability_produit>` : ''}
      <name><language id="1"><![CDATA[${product.name || ''}]]></language></name>
      <link_rewrite><language id="1"><![CDATA[${linkRewrite}]]></language></link_rewrite>
      <meta_title><language id="1"><![CDATA[${product.meta_title || ''}]]></language></meta_title>
      <description><language id="1"><![CDATA[${product.description || ''}]]></language></description>
      <description_short><language id="1"><![CDATA[${product.description_short || ''}]]></language></description_short>
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

  getAllProducts: async (filters: ProductFilters = {}): Promise<Product[]> => {
    try {
      const params = new URLSearchParams();
      params.set('display', 'full');

      const nameFilter = normalizeText(filters.name);
      if (nameFilter) params.set('filter[name]', `%[${nameFilter}]%`);

      const referenceFilter = normalizeText(filters.reference);
      if (referenceFilter) params.set('filter[reference]', `%[${referenceFilter}]%`);

      if (typeof filters.categoryId === 'number') {
        params.set('filter[id_category_default]', String(filters.categoryId));
      }

      if (typeof filters.active === 'boolean') {
        params.set('filter[active]', filters.active ? '1' : '0');
      }

      const priceRange = buildRange(filters.priceMin, filters.priceMax);
      if (priceRange) params.set('filter[price]', priceRange);

      const quantityIds = await getProductIdsByStockRange(filters.quantityMin, filters.quantityMax);
      const idRange = buildRange(filters.idMin, filters.idMax);

      if (quantityIds) {
        const narrowedIds = applyIdRange(quantityIds, filters.idMin, filters.idMax);
        if (narrowedIds.length === 0) return [];
        params.set('filter[id]', `[${narrowedIds.join('|')}]`);
      } else if (idRange) {
        params.set('filter[id]', idRange);
      }

      const response = await api.get(`/products?${params.toString()}`);
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const productsContainer = root && isRecord(root.products) ? root.products : null;
      const rawProducts = productsContainer?.product;

      if (!rawProducts) return [];
      const productsArray = Array.isArray(rawProducts) ? rawProducts : [rawProducts];
      return productsArray
        .filter(isRecord)
        .map(PrestashopMapper.mapToFrontend);
    } catch (error) {
      console.error("Erreur getAll:", error);
      return [];
    }
  },

 create: async (data: Partial<Product>): Promise<Product | null> => {
    try {
      const xml = PrestashopMapper.buildXml(data);
      const response = await api.post('/products', xml);
      
      // On parse la réponse de succès de PrestaShop
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const rawProduct = root?.product;

      if (!rawProduct || !isRecord(rawProduct)) {
        console.error("Structure de réponse inattendue :", xmlData);
        throw new Error("Le produit a été créé mais la réponse est illisible");
      }

      const createdProduct = PrestashopMapper.mapToFrontend(rawProduct);

      // Mise à jour du stock
      if (data.quantity && data.quantity > 0) {
        // Chemin sécurisé pour l'ID du stock_available
        const associations = isRecord(rawProduct.associations) ? rawProduct.associations : null;
        const stockAvailables = associations && isRecord(associations.stock_availables)
          ? associations.stock_availables
          : null;
        const stockInfo = stockAvailables ? stockAvailables.stock_available : null;
        const stockId = extractId(stockInfo);

        if (stockId) {
          await productService.updateStock(stockId, createdProduct.id, data.quantity);
          createdProduct.quantity = data.quantity;
        }
      }

      return createdProduct;
    } catch (error: any) {
      if (error.response) {
        console.error("Détails erreur API:", error.response.data);
      }
      throw error;
    }
  },

 // Dans produitApi.ts, modifiez la méthode updateStock :

  updateStock: async (stockId: string, productId: string, quantity: number) => {
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
    
    return api.put(`/stock_availables/${stockId}`, stockXml);
  },

  getProduct: async (id: string): Promise<Product | null> => {
    try {
      const response = await api.get(`/products/${id}?display=full`);
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const rawProduct = root?.product;

      if (!rawProduct || !isRecord(rawProduct)) return null;

      return PrestashopMapper.mapToFrontend(rawProduct);
    } catch (error) {
      console.error("Erreur getProduct:", error);
      return null;
    }
  },

  update: async (id: string, data: Partial<Product>): Promise<Product | null> => {
    try {
      const xml = PrestashopMapper.buildXml(data);
      // Ajouter l'ID au XML pour la mise à jour
      const xmlWithId = xml.replace('<product>', `<product><id><![CDATA[${id}]]></id>`);
      
      const response = await api.put(`/products/${id}`, xmlWithId);
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const rawProduct = root?.product;

      if (!rawProduct || !isRecord(rawProduct)) {
        throw new Error("Impossible de lire la réponse du serveur");
      }

      const updatedProduct = PrestashopMapper.mapToFrontend(rawProduct);
      
      // Mise à jour du stock si nécessaire
      if (data.quantity && data.quantity > 0) {
        const associations = isRecord(rawProduct.associations) ? rawProduct.associations : null;
        const stockAvailables = associations && isRecord(associations.stock_availables)
          ? associations.stock_availables
          : null;
        const stockInfo = stockAvailables ? stockAvailables.stock_available : null;
        const stockId = extractId(stockInfo);
        
        if (stockId) {
          await productService.updateStock(stockId, id, data.quantity);
          updatedProduct.quantity = data.quantity;
        }
      }

      return updatedProduct;
    } catch (error: any) {
      if (error.response) {
        console.error("Détails erreur API:", error.response.data);
      }
      throw error;
    }
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    try {
      // PrestaShop utilise la méthode DELETE sur l'endpoint du produit spécifique
      await api.delete(`/products/${id}`);
      return true;
    } catch (error: any) {
      if (error.response) {
        console.error("Erreur lors de la suppression PrestaShop:", error.response.data);
      } else {
        console.error("Erreur de connexion lors de la suppression:", error);
      }
      return false;
    }
  },

  
};

// ==========================================
// 5. PARSER DOM
// ==========================================
function parseXMLToJSON(xmlString: string): unknown {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  function parseNode(node: Element): unknown {
    if (node.children.length === 0) return node.textContent || "";
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const nodeName = child.nodeName;
      const value = parseNode(child);
      if (obj[nodeName]) {
        const current = obj[nodeName];
        if (!Array.isArray(current)) obj[nodeName] = [current];
        (obj[nodeName] as unknown[]).push(value);
      } else {
        obj[nodeName] = value;
      }
    }
    return obj;
  }
  return parseNode(xmlDoc.documentElement);
}

// ==========================================
// 6. HELPERS FILTRES
// ==========================================
const MAX_RANGE_VALUE = 99999999;

function getPrestashopRoot(xmlData: unknown): Record<string, unknown> | null {
  if (!isRecord(xmlData)) return null;
  const root = isRecord(xmlData.prestashop) ? xmlData.prestashop : xmlData;
  return isRecord(root) ? root : null;
}

function normalizeText(value?: string): string {
  return value?.trim() ?? '';
}

function buildRange(min?: number, max?: number): string | null {
  if (min == null && max == null) return null;
  const start = typeof min === 'number' ? min : 0;
  const end = typeof max === 'number' ? max : MAX_RANGE_VALUE;
  return `[${start},${end}]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractId(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? extractId(value[0]) : null;
  }
  if (!isRecord(value)) return null;
  const id = value.id;
  if (typeof id === 'string' || typeof id === 'number') {
    return String(id);
  }
  return null;
}

function applyIdRange(ids: string[], min?: number, max?: number): string[] {
  if (min == null && max == null) return ids;
  return ids.filter((id) => {
    const idValue = Number(id);
    if (Number.isNaN(idValue)) return false;
    if (typeof min === 'number' && idValue < min) return false;
    if (typeof max === 'number' && idValue > max) return false;
    return true;
  });
}

async function getProductIdsByStockRange(
  min?: number,
  max?: number
): Promise<string[] | null> {
  const range = buildRange(min, max);
  if (!range) return null;

  const params = new URLSearchParams();
  params.set('display', '[id_product]');
  params.set('filter[quantity]', range);

  const response = await api.get(`/stock_availables?${params.toString()}`);
  const xmlData = parseXMLToJSON(response.data);
  const root = isRecord(xmlData) ? xmlData.prestashop ?? xmlData : null;
  const stockRoot = isRecord(root) ? root.stock_availables : null;
  const rawStock = isRecord(stockRoot) ? stockRoot.stock_available : null;

  if (!rawStock) return [];

  const stockArray = Array.isArray(rawStock) ? rawStock : [rawStock];
  return stockArray
    .map((item) => {
      if (!isRecord(item)) return null;
      const idProduct = item.id_product;
      if (typeof idProduct === 'string' || typeof idProduct === 'number') {
        return String(idProduct);
      }
      return null;
    })
    .filter((id): id is string => Boolean(id));
}
