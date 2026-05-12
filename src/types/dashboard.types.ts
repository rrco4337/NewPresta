export type DailyOrderStat = {
  date: string;
  orderCount: number;
  totalAmount: number;
};

export type DateRangePreset = 'today' | 'last7days' | 'last30days';

export type DashboardData = {
  stats: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
  dailyStats: DailyOrderStat[];
};