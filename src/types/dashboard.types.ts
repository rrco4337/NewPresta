import type { OrderFromApi } from "../services/dashboardApi";

export interface DailyOrderStat {
  date: string;
  orderCount: number;
  totalAmount: number;
}

// Dans dashboard.types.ts
export interface DashboardData {
  stats: {
    totalOrders: number;      // TOUTES les commandes
    totalRevenue: number;     // Seulement les NON annulées
    averageOrderValue: number;
    cancelledOrders: number;
    cancelledTotal: number;  // Ajoutez cette ligne
  };
  dailyStats: DailyOrderStat[];
  allOrders?: OrderFromApi[];
}

export interface DashboardFilters {
  selectedDate: string | null;
}