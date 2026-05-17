export type DateRangePreset = 'today' | 'last7days' | 'last30days' | 'custom';

export interface DailyStats {
  date: string;
  orderCount: number;
  cartCount: number;
  orderRevenue: number;
  cartRevenue: number;
  totalCount: number;
  totalRevenue: number;
}

export interface GlobalStats {
  totalOrders: number;
  totalCarts: number;
  orderRevenue: number;
  cartRevenue: number;
  totalCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageCartValue: number;
  dailyStats: DailyStats[];
}

/** @deprecated — use DailyStats instead */
export interface DailyOrderStat {
  date: string;
  orderCount: number;
  totalAmount: number;
}
