// src/services/financialService.ts
import { productService } from './produitApi';
import { stockService } from './stockApi';
import { orderService } from './orderService';
import { categoryService } from './categoryService';
import type { CategoryStats, FinancialGlobal } from '../types/financial.types';

export const financialService = {
  async getFinancialData(): Promise<{ global: FinancialGlobal; byCategory: CategoryStats[] }> {
    // 1. Récupérer les catégories (pour les noms)
    const categories = await categoryService.getAllCategories();
    const categoryNameMap = new Map<number, string>();
    categories.forEach(cat => categoryNameMap.set(cat.id, cat.name));

    // 2. Récupérer tous les produits (avec wholesale_price, id_category_default)
    const products = await productService.getAllProducts();
    const productMap = new Map<number, any>();
    products.forEach(p => productMap.set(Number(p.id), p));

    // 3. Récupérer le stock disponible pour chaque produit (produit simple, déclinaison 0)
    const stockMap = new Map<number, number>();
    for (const prod of products) {
      const qty = await stockService.getStockQuantity(prod.id, '0');
      stockMap.set(Number(prod.id), qty);
    }

    // 4. Récupérer les lignes des commandes payées (état 2) avec prix unitaire TTC
    //    Cette fonction doit être ajoutée dans orderService.ts (voir ci-dessous)
    const paidOrderRows = await orderService.fetchPaidOrderRows();

    // 5. Calcul par produit : ventes (CA) et coût des produits vendus (COGS)
    const salesByProduct = new Map<number, number>();
    const cogsByProduct = new Map<number, number>();

    for (const row of paidOrderRows) {
      const productId = row.productId;
      const qtySold = row.quantity;
      const unitPriceTtc = row.unit_price_tax_incl;
      const product = productMap.get(productId);
      const unitPurchasePrice = product?.wholesale_price || 0;

      const sales = qtySold * unitPriceTtc;
      const cogs = qtySold * unitPurchasePrice;

      salesByProduct.set(productId, (salesByProduct.get(productId) || 0) + sales);
      cogsByProduct.set(productId, (cogsByProduct.get(productId) || 0) + cogs);
    }

    // 6. Agrégation par catégorie
    const catMap = new Map<number, {
      sales: number;
      purchases: number;   // valeur totale du stock (prix achat × quantité en stock)
      cogs: number;
      name: string;
    }>();

    for (const prod of products) {
      const catId = prod.id_category_default;
      if (!catId) continue; // ignorer produits sans catégorie
      const productId = Number(prod.id);
      const stockQty = stockMap.get(productId) || 0;
      const purchaseValue = prod.wholesale_price * stockQty;
      const salesValue = salesByProduct.get(productId) || 0;
      const cogsValue = cogsByProduct.get(productId) || 0;

      if (!catMap.has(catId)) {
        catMap.set(catId, {
          sales: 0,
          purchases: 0,
          cogs: 0,
          name: categoryNameMap.get(catId) || `Catégorie ${catId}`,
        });
      }
      const entry = catMap.get(catId)!;
      entry.sales += salesValue;
      entry.purchases += purchaseValue;
      entry.cogs += cogsValue;
    }

    // 7. Construire les résultats par catégorie
    const byCategory: CategoryStats[] = Array.from(catMap.entries()).map(([id, data]) => ({
      categoryId: id,
      categoryName: data.name,
      sales: data.sales,
      purchases: data.purchases,   // valeur du stock
      profit: data.sales - data.cogs,   // bénéfice = ventes - coût des produits vendus
    }));

    // 8. Totaux globaux
    const totalSales = byCategory.reduce((s, c) => s + c.sales, 0);
    const totalPurchases = byCategory.reduce((s, c) => s + c.purchases, 0);
    const totalProfit = byCategory.reduce((s, c) => s + c.profit, 0);

    const global: FinancialGlobal = {
      totalSales,
      totalPurchases,
      profit: totalProfit,
    };

    return { global, byCategory };
  },
};