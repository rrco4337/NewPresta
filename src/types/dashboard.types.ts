export interface DailyOrderStat {
  date: string;
  orderCount: number;
  totalAmount: number;
}

export interface DashboardData {
  stats: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
  dailyStats: DailyOrderStat[];
}

export interface DashboardFilters {
  selectedDate: string | null;
}