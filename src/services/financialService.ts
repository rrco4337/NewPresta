import axios from 'axios';
import { productService } from './produitApi';
import type { CategoryStats, FinancialFilters, FinancialGlobal } from '../types/financial.types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// États valides : payé (2) + livré (5) — exclut panier (1) et annulé (6)
const VALID_ORDER_STATES = new Set([2, 5]);

async function fetchCategoryNames(): Promise<Map<number, string>> {
  try {
    const res = await api.get('/categories?display=[id,name]');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const map = new Map<number, string>();
    doc.querySelectorAll('category').forEach(el => {
      const id = parseInt(el.querySelector('id')?.textContent ?? '0', 10);
      // PrestaShop : <name><language id="1"><![CDATA[Nom]]></language></name>
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
): Promise<Array<{ productId: number; quantity: number; unitPriceHT: number }>> {
  try {
    const res = await api.get(`/order_details?filter[id_order]=${orderId}&display=full`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const rows: Array<{ productId: number; quantity: number; unitPriceHT: number }> = [];
    doc.querySelectorAll('order_detail').forEach(el => {
      const productId = parseInt(el.querySelector('product_id')?.textContent ?? '0', 10);
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

export const financialService = {
  async getFinancialData(
    filters: FinancialFilters,
  ): Promise<{ global: FinancialGlobal; byCategory: CategoryStats[] }> {
    const { dateFrom, dateTo } = computeDateRange(filters);

    const [categoryNameMap, products, orderIds] = await Promise.all([
      fetchCategoryNames(),
      productService.getAllProducts(),
      fetchValidatedOrderIds(dateFrom, dateTo),
    ]);
    const productMap = new Map<number, any>(products.map(p => [Number(p.id), p]));

    console.log('[financialService] Produits chargés:', products.length, '| Commandes valides:', orderIds.length);

    // Agrégation ventes HT et COGS par produit
    const salesByProduct = new Map<number, number>();
    const cogsByProduct = new Map<number, number>();

    for (const orderId of orderIds) {
      console.log(`[financialService] Traitement commande ${orderId}...`);
      const rows = await fetchOrderDetailRows(orderId);
      for (const row of rows) {
        const product = productMap.get(row.productId);
        const salesValue = row.quantity * row.unitPriceHT;
        const wholesalePrice = product?.wholesale_price ?? 0;
        const cogsValue = row.quantity * wholesalePrice;
        if (!product) {
          console.warn(`[financialService]   productId=${row.productId} INTROUVABLE dans le catalogue (produit supprimé ?)`);
        } else {
          console.log(`[financialService]   productId=${row.productId} wholesale_price=${wholesalePrice} → ventes=${salesValue.toFixed(2)} COGS=${cogsValue.toFixed(2)}`);
        }
        salesByProduct.set(row.productId, (salesByProduct.get(row.productId) ?? 0) + salesValue);
        cogsByProduct.set(row.productId, (cogsByProduct.get(row.productId) ?? 0) + cogsValue);
      }
    }

    console.log('[financialService] RÉSUMÉ salesByProduct:', Object.fromEntries(salesByProduct));
    console.log('[financialService] RÉSUMÉ cogsByProduct:', Object.fromEntries(cogsByProduct));

    // Agrégation par catégorie (toutes catégories présentes dans le catalogue)
    const catMap = new Map<number, { name: string; sales: number; purchases: number }>();

    for (const prod of products) {
      const catId = prod.id_category_default;
      if (!catId) continue;
      const productId = Number(prod.id);
      const sales = salesByProduct.get(productId) ?? 0;
      const cogs = cogsByProduct.get(productId) ?? 0;

      if (!catMap.has(catId)) {
        catMap.set(catId, {
          name: categoryNameMap.get(catId) ?? `Catégorie ${catId}`,
          sales: 0,
          purchases: 0,
        });
      }
      const entry = catMap.get(catId)!;
      entry.sales += sales;
      entry.purchases += cogs;
    }

    const byCategory: CategoryStats[] = Array.from(catMap.entries())
      .map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        sales: data.sales,
        purchases: data.purchases,
        profit: data.sales - data.purchases,
      }))
      .sort((a, b) => b.sales - a.sales);

    const totalSales = byCategory.reduce((s, c) => s + c.sales, 0);
    const totalPurchases = byCategory.reduce((s, c) => s + c.purchases, 0);

    return {
      global: { totalSales, totalPurchases, profit: totalSales - totalPurchases },
      byCategory,
    };
  },
};
