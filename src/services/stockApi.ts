// src/services/stockApi.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ==========================================
// 1. TYPES
// ==========================================
export interface StockAvailable {
  id: string;
  id_product: string;
  id_product_attribute: string;
  quantity: number;
  out_of_stock: number;       // 0 = interdire commande, 1 = autoriser, 2 = par défaut
  depends_on_stock: number;   // 0 = non, 1 = dépend du stock du produit parent
  id_shop: string;
  id_shop_group: string;
}

// ==========================================
// 2. CONFIGURATION AXIOS (identique à produitApi)
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
const StockMapper = {
  /**
   * Convertit un objet XML brut (issu du parsing) en StockAvailable typé.
   */
  mapToFrontend: (raw: any): StockAvailable => ({
    id: raw.id?.toString() || '',
    id_product: raw.id_product?.toString() || '',
    id_product_attribute: raw.id_product_attribute?.toString() || '0',
    quantity: parseInt(raw.quantity, 10) || 0,
    out_of_stock: parseInt(raw.out_of_stock, 10) || 0,
    depends_on_stock: parseInt(raw.depends_on_stock, 10) || 0,
    id_shop: raw.id_shop?.toString() || '1',
    id_shop_group: raw.id_shop_group?.toString() || '0',
  }),

  /**
   * Construit le XML pour mettre à jour une quantité (PUT sur stock_available).
   */
  buildStockUpdateXml: (stock: Partial<StockAvailable>): string => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${stock.id || ''}]]></id>
    <id_product><![CDATA[${stock.id_product || ''}]]></id_product>
    <id_product_attribute><![CDATA[${stock.id_product_attribute || '0'}]]></id_product_attribute>
    <quantity><![CDATA[${stock.quantity ?? 0}]]></quantity>
    <out_of_stock><![CDATA[${stock.out_of_stock ?? 0}]]></out_of_stock>
    <depends_on_stock><![CDATA[${stock.depends_on_stock ?? 0}]]></depends_on_stock>
    <id_shop><![CDATA[${stock.id_shop || '1'}]]></id_shop>
    <id_shop_group><![CDATA[${stock.id_shop_group || '0'}]]></id_shop_group>
  </stock_available>
</prestashop>`;
  }
};

// ==========================================
// 4. HELPERS (parsing XML, extraction)
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

function getPrestashopRoot(xmlData: unknown): Record<string, unknown> | null {
  if (typeof xmlData !== 'object' || xmlData === null) return null;
  const root = (xmlData as any).prestashop ?? xmlData;
  return typeof root === 'object' && root !== null ? root as Record<string, unknown> : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ==========================================
// 5. SERVICE API STOCK
// ==========================================
export const stockService = {

  /**
   * Récupère toutes les lignes de stock_available (optionnellement filtrées par produit).
   * @param productId - optionnel, filtre sur id_product
   * @returns tableau de StockAvailable
   */
  getStockAvailables: async (productId?: string): Promise<StockAvailable[]> => {
    try {
      const params = new URLSearchParams();
      params.set('display', 'full');
      if (productId) {
        params.set('filter[id_product]', `[${productId}]`);
      }
      const response = await api.get(`/stock_availables?${params.toString()}`);
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const stocksContainer = root?.stock_availables;
      if (!isRecord(stocksContainer)) return [];
      let rawStocks = stocksContainer.stock_available;
      if (!rawStocks) return [];
      const stockArray = Array.isArray(rawStocks) ? rawStocks : [rawStocks];
      return stockArray
        .filter(isRecord)
        .map(StockMapper.mapToFrontend);
    } catch (error) {
      console.error("Erreur getStockAvailables:", error);
      return [];
    }
  },

  /**
   * Récupère le stock pour un produit (et éventuellement une déclinaison).
   * @param productId - ID produit
   * @param attributeId - ID déclinaison (0 ou absent pour produit simple)
   * @returns quantité disponible (0 si non trouvé)
   */
  getStockQuantity: async (productId: string, attributeId: string = '0'): Promise<number> => {
    const stocks = await stockService.getStockAvailables(productId);
    const found = stocks.find(s => s.id_product === productId && s.id_product_attribute === attributeId);
    return found ? found.quantity : 0;
  },

  /**
   * Récupère le stock pour toutes les déclinaisons d'un produit sous forme de Map.
   * @param productId - ID produit
   * @returns Map (clé = id_product_attribute, valeur = quantité)
   */
  getStockMapByProduct: async (productId: string): Promise<Map<string, number>> => {
    const stocks = await stockService.getStockAvailables(productId);
    const map = new Map<string, number>();
    for (const s of stocks) {
      const key = s.id_product_attribute || '0';
      map.set(key, s.quantity);
    }
    return map;
  },

  /**
   * Met à jour la quantité d'un stock_available (produit simple ou déclinaison).
   * Nécessite l'ID du stock_available (récupérable via getStockAvailables).
   */
  updateStockQuantity: async (stockId: string, quantity: number): Promise<boolean> => {
    try {
      // D'abord récupérer l'objet complet pour ne pas perdre les autres champs
      const all = await stockService.getStockAvailables();
      const existing = all.find(s => s.id === stockId);
      if (!existing) {
        console.error("Stock introuvable avec l'ID", stockId);
        return false;
      }
      const updated = { ...existing, quantity };
      const xml = StockMapper.buildStockUpdateXml(updated);
      await api.put(`/stock_availables/${stockId}`, xml);
      return true;
    } catch (error) {
      console.error("Erreur updateStockQuantity:", error);
      return false;
    }
  },

  /**
   * Mise à jour directe par produit/déclinaison (recherche l'ID automatiquement).
   */
  setProductStock: async (productId: string, quantity: number, attributeId: string = '0'): Promise<boolean> => {
    const stocks = await stockService.getStockAvailables(productId);
    const target = stocks.find(s => s.id_product === productId && s.id_product_attribute === attributeId);
    if (!target) {
      console.warn(`Aucun stock trouvé pour produit ${productId} / attribut ${attributeId}`);
      return false;
    }
    return stockService.updateStockQuantity(target.id, quantity);
  }
};