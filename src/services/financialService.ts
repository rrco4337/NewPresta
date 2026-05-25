import axios from 'axios';
import { productService } from './produitApi';
import type { CategoryStats, FinancialFilters, FinancialGlobal, ProductStockInfo } from '../types/financial.types';
import { stockService } from './stockService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

const VALID_ORDER_STATES = new Set([2, 5]);

interface ProductWithDetails {
  id: number;
  wholesale_price: number;
  quantity: number;
  id_category_default: number;
  combinations?: Array<{
    id: number;
    quantity: number;
    wholesale_price?: number;
  }>;
}

async function fetchCategoryNames(): Promise<Map<number, string>> {
  try {
    const res = await api.get('/categories?display=[id,name]');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const map = new Map<number, string>();
    doc.querySelectorAll('category').forEach(el => {
      const id = parseInt(el.querySelector('id')?.textContent ?? '0', 10);
      const name =
        el.querySelector('name language')?.textContent?.trim() ??
        el.querySelector('name')?.textContent?.trim() ??
        '';
      if (id && name) map.set(id, name);
    });
    return map;
  } catch {
    return new Map();
  }
}

function computeDateRange(filters: FinancialFilters): { dateFrom: string | null; dateTo: string | null } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (filters.period) {
    case 'day':
      return { dateFrom: fmt(today), dateTo: fmt(today) };
    case 'week': {
      const s = new Date(today);
      s.setDate(today.getDate() - 6);
      return { dateFrom: fmt(s), dateTo: fmt(today) };
    }
    case 'month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: fmt(s), dateTo: fmt(today) };
    }
    case 'year': {
      const s = new Date(today.getFullYear(), 0, 1);
      return { dateFrom: fmt(s), dateTo: fmt(today) };
    }
    case 'all':
      return { dateFrom: null, dateTo: null };
    case 'custom':
      return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
    default:
      return { dateFrom: null, dateTo: null };
  }
}

async function fetchValidatedOrderIds(
  dateFrom: string | null,
  dateTo: string | null,
): Promise<string[]> {
  const PAGE_SIZE = 100;
  const ids: string[] = [];
  const stateCounts: Record<number, number> = {};
  let page = 0;

  const baseParams = dateFrom && dateTo
    ? `&date=1&filter[date_add]=[${dateFrom} 00:00:00,${dateTo} 23:59:59]`
    : '';

  console.log('[financialService] fetchValidatedOrderIds — plage:', dateFrom, '→', dateTo);

  try {
    while (true) {
      const url = `/orders?display=[id,current_state,date_add]&limit=${PAGE_SIZE}&page=${page}${baseParams}`;
      console.log(`[financialService] Fetch page ${page}:`, url);
      const res = await api.get(url);

      const doc = new DOMParser().parseFromString(res.data, 'text/xml');
      const batch = doc.querySelectorAll('order');
      console.log(`[financialService] Page ${page}: ${batch.length} commande(s) retournée(s)`);

      if (batch.length === 0) break;

      batch.forEach(el => {
        const id = el.querySelector('id')?.textContent?.trim() ?? '';
        const stateRaw = el.querySelector('current_state')?.textContent?.trim() ?? '';
        const state = parseInt(stateRaw, 10);
        stateCounts[state] = (stateCounts[state] ?? 0) + 1;
        console.log(`[financialService]   id=${id} current_state="${stateRaw}" (parsed=${state}) → valide=${VALID_ORDER_STATES.has(state)}`);
        if (id && VALID_ORDER_STATES.has(state)) ids.push(id);
      });

      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    console.log('[financialService] Répartition des états:', stateCounts);
    console.log('[financialService] IDs retenus (états valides 2+5):', ids);
    return ids;
  } catch (err) {
    console.error('[financialService] Erreur fetchValidatedOrderIds:', err);
    return [];
  }
}

async function fetchOrderDetailRows(
  orderId: string,
): Promise<Array<{ productId: number; combinationId?: number; quantity: number; unitPriceHT: number }>> {
  try {
    const res = await api.get(`/order_details?filter[id_order]=${orderId}&display=full`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const rows: Array<{ productId: number; combinationId?: number; quantity: number; unitPriceHT: number }> = [];
    doc.querySelectorAll('order_detail').forEach(el => {
      const productId = parseInt(el.querySelector('product_id')?.textContent ?? '0', 10);
      const combinationId = parseInt(el.querySelector('product_attribute_id')?.textContent ?? '0', 10);
      const quantity = parseInt(el.querySelector('product_quantity')?.textContent ?? '0', 10);
      const htText = el.querySelector('unit_price_tax_excl')?.textContent;
      const ttcText = el.querySelector('unit_price_tax_incl')?.textContent;
      const unitPriceHT = parseFloat(htText || ttcText || '0');
      console.log(`[financialService]   Détail commande ${orderId}: productId=${productId} qty=${quantity} HT=${unitPriceHT} (htText="${htText}" ttcText="${ttcText}")`);
      if (productId && quantity > 0) rows.push({ productId, quantity, unitPriceHT });
    });
    if (rows.length === 0) {
      console.warn(`[financialService]   Commande ${orderId}: aucun order_detail retourné`);
    }
    return rows;
  } catch (err) {
    console.error(`[financialService] Erreur fetchOrderDetailRows commande ${orderId}:`, err);
    return [];
  }
}

async function fetchAllProductsStockInfo(): Promise<ProductStockInfo[]> {
  try {
    const [products, stockAvailables] = await Promise.all([
      productService.getAllProducts(),
      api.get('/stock_availables?display=full').then(res => {
        const doc = new DOMParser().parseFromString(res.data, 'text/xml');
        return Array.from(doc.querySelectorAll('stock_available')).map(el => ({
          productId: parseInt(el.querySelector('id_product')?.textContent ?? '0', 10),
          comboId:   parseInt(el.querySelector('id_product_attribute')?.textContent ?? '0', 10),
          physicalQty: parseInt(el.querySelector('quantity')?.textContent ?? '0', 10),
          reservedQty: parseInt(el.querySelector('reserved_quantity')?.textContent ?? '0', 10),
        }));
      }),
    ]);

    // ✅ Calcul correct du stock disponible
    const stockEntries = stockAvailables.map(sa => ({
      productId: sa.productId,
      comboId: sa.comboId,
      // Stock disponible = physique - réservé
      qty: sa.physicalQty - sa.reservedQty,
    }));

    // Séparer simples / combinaisons
    const simpleEntries = new Map<number, number>();
    const comboEntries = new Map<string, number>();
    const productsWithCombos = new Set<number>();

    for (const { productId, comboId, qty } of stockEntries) {
      if (!productId) continue;
      // ✅ On garde même les négatifs (pour valorisation correcte)
      if (comboId > 0) {
        productsWithCombos.add(productId);
        comboEntries.set(`${productId}_${comboId}`, qty);
      } else {
        simpleEntries.set(productId, qty);
      }
    }

    const allEntries: Array<{ productId: number; comboId: number; qty: number }> = [];
    
    // Produits simples (sans combinaisons)
    for (const [productId, qty] of simpleEntries) {
      if (!productsWithCombos.has(productId)) {
        allEntries.push({ productId, comboId: 0, qty });
      }
    }
    
    // Combinaisons
    for (const [key, qty] of comboEntries) {
      const [pid, cid] = key.split('_').map(Number);
      allEntries.push({ productId: pid, comboId: cid, qty });
    }

    // Récupérer les prix de gros des combinaisons
    const comboPriceMap = new Map<string, number>();
    try {
      const comboRes = await api.get('/combinations?display=[id,id_product,wholesale_price]');
      const comboDoc = new DOMParser().parseFromString(comboRes.data, 'text/xml');
      comboDoc.querySelectorAll('combination').forEach(el => {
        const id = parseInt(el.querySelector('id')?.textContent ?? '0', 10);
        const idProduct = parseInt(el.querySelector('id_product')?.textContent ?? '0', 10);
        const wholesalePrice = parseFloat(el.querySelector('wholesale_price')?.textContent ?? '0');
        if (idProduct && id && wholesalePrice > 0) {
          comboPriceMap.set(`${idProduct}_${id}`, wholesalePrice);
        }
      });
      console.log(`📦 Prix des combinaisons chargés : ${comboPriceMap.size}`);
    } catch (error) {
      console.warn('⚠️ Impossible de récupérer les prix des combinaisons', error);
    }

    const productMap = new Map(products.map(p => [Number(p.id), p]));
    const stockByCombo = new Map<string, { qty: number; wholesalePrice: number; categoryId: number }>();

    for (const entry of allEntries) {
      const key = `${entry.productId}_${entry.comboId}`;
      const product = productMap.get(entry.productId);
      if (!product) continue;

      let wholesalePrice = 0;
      if (entry.comboId > 0 && comboPriceMap.has(key)) {
        wholesalePrice = comboPriceMap.get(key)!;
      } else {
        wholesalePrice = parseFloat(product.wholesale_price) || 0;
      }

      const categoryId = parseInt(product.id_category_default as string, 10) || 0;

      if (wholesalePrice > 0) {
        if (stockByCombo.has(key)) {
          stockByCombo.get(key)!.qty += entry.qty;
        } else {
          stockByCombo.set(key, { 
            qty: entry.qty, 
            wholesalePrice, 
            categoryId 
          });
        }
      }
    }

    const stockInfo: ProductStockInfo[] = [];
    let totalValue = 0;

    console.log('📊 Détail du calcul du stock :');
    for (const [key, data] of stockByCombo.entries()) {
      const [productIdStr, comboIdStr] = key.split('_');
      const productId = parseInt(productIdStr, 10);
      const value = data.wholesalePrice * data.qty;
      totalValue += value;
      console.log(`ID ${productId} (combo ${comboIdStr || 'simple'}) : ${data.qty} × ${data.wholesalePrice} = ${value.toFixed(2)}`);
      stockInfo.push({
        id_product: productId,
        wholesale_price: data.wholesalePrice,
        quantity: data.qty,
        id_category_default: data.categoryId,
      });
    }

    console.log(`💰 Valeur totale du stock : ${totalValue.toFixed(2)}`);
    console.log(`📦 Nombre de lignes de stock : ${stockInfo.length}`);

    return stockInfo;
  } catch (error) {
    console.error('Erreur récupération stock:', error);
    return [];
  }
}
// Récupère tous les produits avec leurs infos de stock (incluant combinaisons)


function calculateTotalStockValue(stockInfo: ProductStockInfo[]): number {
  return stockInfo.reduce((total, product) => {
    const value = product.wholesale_price * product.quantity;
    return total + (isNaN(value) ? 0 : value);
  }, 0);
}

function calculateStockValueByCategory(stockInfo: ProductStockInfo[], categoryNameMap: Map<number, string>): CategoryStats[] {
  const categoryStockMap = new Map<number, { categoryName: string; totalStockValue: number }>();

  for (const product of stockInfo) {
    const catId = product.id_category_default;
    if (!catId || catId === 0) continue;

    const stockValue = product.wholesale_price * product.quantity;
    if (isNaN(stockValue) || stockValue === 0) continue;
    
    if (!categoryStockMap.has(catId)) {
      categoryStockMap.set(catId, {
        categoryName: categoryNameMap.get(catId) ?? `Catégorie ${catId}`,
        totalStockValue: 0,
      });
    }
    
    const entry = categoryStockMap.get(catId)!;
    entry.totalStockValue += stockValue;
  }

  return Array.from(categoryStockMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.categoryName,
      sales: 0,
      purchases: data.totalStockValue,
      profit: -data.totalStockValue,
    }))
    .sort((a, b) => b.purchases - a.purchases);
}



export const financialService = {
 async getFinancialData(
  filters: FinancialFilters,
): Promise<{ 
  global: FinancialGlobal; 
  byCategory: CategoryStats[];      // ← UNIQUEMENT les ventes de la période
  totalStockValue: number;
  stockByCategory: CategoryStats[];  // ← UNIQUEMENT le stock (sans les ventes)
}> {
  const { dateFrom, dateTo } = computeDateRange(filters);

  const [categoryNameMap, products, orderIds, allProductsStock] = await Promise.all([
    fetchCategoryNames(),
    productService.getAllProducts(),
    fetchValidatedOrderIds(dateFrom, dateTo),
    fetchAllProductsStockInfo(), // ← ta fonction corrigée avec physical - reserved
  ]);
  
  const totalStockValue = calculateTotalStockValue(allProductsStock);
  const stockByCategory = calculateStockValueByCategory(allProductsStock, categoryNameMap);
  
  const productMap = new Map(products.map(p => [Number(p.id), p]));

  // ==========================================
  // 1. AGRÉGATION DES VENTES UNIQUEMENT
  // ==========================================
  const salesByProduct = new Map<number, number>();    // CA HT vendu
  const cogsByProduct = new Map<number, number>();     // Prix d'achat des vendus

  for (const orderId of orderIds) {
    const rows = await fetchOrderDetailRows(orderId);
    for (const row of rows) {
      const product = productMap.get(row.productId);
      const salesValue = row.quantity * row.unitPriceHT;
      const wholesalePrice = product?.wholesale_price ?? 0;
      const cogsValue = row.quantity * wholesalePrice;
      
      salesByProduct.set(row.productId, (salesByProduct.get(row.productId) ?? 0) + salesValue);
      cogsByProduct.set(row.productId, (cogsByProduct.get(row.productId) ?? 0) + cogsValue);
    }
  }

  // ==========================================
  // 2. AGRÉGATION PAR CATÉGORIE (UNIQUEMENT VENTES)
  // ==========================================
  const catMap = new Map<number, { name: string; sales: number; purchases: number }>();

  for (const prod of products) {
    const catId = typeof prod.id_category_default === 'string' 
      ? parseInt(prod.id_category_default, 10) 
      : prod.id_category_default;
    if (!catId) continue;
    
    const productId = Number(prod.id);
    const sales = salesByProduct.get(productId) ?? 0;
    const cogs = cogsByProduct.get(productId) ?? 0;
    
    // ✅ On ignore les produits sans vente
    if (sales === 0 && cogs === 0) continue;
    
    if (!catMap.has(catId)) {
      catMap.set(catId, {
        name: categoryNameMap.get(catId) ?? `Catégorie ${catId}`,
        sales: 0,
        purchases: 0,
      });
    }
    const entry = catMap.get(catId)!;
    entry.sales += sales;
    entry.purchases += cogs;  // ← UNIQUEMENT le coût des vendus, PAS le stock
  }

  const soldByCategory: CategoryStats[] = Array.from(catMap.entries())
    .map(([id, data]) => ({
      categoryId: id,
      categoryName: data.name,
      sales: data.sales,
      purchases: data.purchases,  // = prix d'achat des produits vendus
      profit: data.sales - data.purchases,
    }))
    .sort((a, b) => b.sales - a.sales);

  const totalSales = soldByCategory.reduce((s, c) => s + c.sales, 0);
  const totalPurchases = soldByCategory.reduce((s, c) => s + c.purchases, 0);

  return {
    global: { totalSales, totalPurchases, profit: totalSales - totalPurchases },
    byCategory: soldByCategory,           // ← UNIQUEMENT les ventes
    totalStockValue,                       // ← Valeur totale du stock
    stockByCategory,                       // ← Stock par catégorie
  };
},
};