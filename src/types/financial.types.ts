export interface FinancialGlobal {
  totalSales: number;       // Total ventes HT
  totalPurchases: number;   // Total achats HT (COGS sur la période)
  profit: number;           // Bénéfice HT
}

export interface CategoryStats {
  categoryId: number;
  categoryName: string;
  sales: number;      // Ventes HT
  purchases: number;  // Achats HT (COGS)
  profit: number;
}

export interface ProductStockInfo {
  id_product: number;
  wholesale_price: number;
  quantity: number;
  id_category_default: number;
}

export type FinancialPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface FinancialFilters {
  period: FinancialPeriod;
  dateFrom: string | null;  // YYYY-MM-DD
  dateTo: string | null;    // YYYY-MM-DD
  categoryId: number | null;
}
