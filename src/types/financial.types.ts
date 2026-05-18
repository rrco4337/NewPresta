export interface FinancialGlobal {
  totalSales: number;      // Montant total des ventes (TTC)
  totalPurchases: number;  // Valeur totale du stock (prix achat * qty)
  profit: number;          // Bénéfice
}

export interface CategoryStats {
  categoryId: number;
  categoryName: string;
  sales: number;      // Ventes pour cette catégorie
  purchases: number;  // Achats (stock) pour cette catégorie
  profit: number;
}

export interface ProductStockInfo {
  id_product: number;
  wholesale_price: number;
  quantity: number;      // stock disponible
  id_category_default: number;
}


