// financial.types.ts
export interface FinancialGlobal {
  totalSales: number;       // Total ventes HT (période)
  totalPurchases: number;   // Total achats HT - COGS sur la période (produits vendus uniquement)
  profit: number;           // Bénéfice HT
}

export interface CategoryStats {
  categoryId: number;
  categoryName: string;
  sales: number;      // Ventes HT (période)
  purchases: number;  // Achats HT - COGS (période)
  profit: number;
}

export interface ProductStockInfo {
  id_product: number;
  id_combination?: number; // Optionnel pour les combinaisons
  wholesale_price: number;
  quantity: number;
  id_category_default: number;
}

export type FinancialPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface FinancialFilters {
  period: FinancialPeriod;
  dateFrom: string | null;
  dateTo: string | null;
  categoryId: number | null;
}

// Nouveau type pour le résultat complet
export interface FinancialDataResult {
  global: FinancialGlobal;
  byCategory: CategoryStats[];      // Ventes par catégorie (période)
  totalStockValue: number;           // Valeur totale du stock (tous produits)
  stockByCategory: CategoryStats[];  // Valeur du stock par catégorie
}