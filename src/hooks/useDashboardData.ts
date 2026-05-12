import { useState, useEffect, useCallback } from 'react';
import { fetchOrders } from '../services/dashboardApi';
import { type DailyOrderStat, type DashboardData,type  DateRangePreset } from '../types/dashboard.types';

function getDateRange(preset: DateRangePreset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let from = new Date(to);

  switch (preset) {
    case 'today':
      from = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 0, 0, 0);
      break;
    case 'last7days':
      from.setDate(to.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case 'last30days':
      from.setDate(to.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
  }
  return { from, to };
}

function aggregateOrdersByDay(orders: any[]): DailyOrderStat[] {
  const map = new Map<string, { count: number; amount: number }>();

  orders.forEach(order => {
    const date = order.date_add.split('T')[0]; // YYYY-MM-DD
    const amount = parseFloat(order.total_paid_tax_incl);
    const existing = map.get(date);
    if (existing) {
      existing.count += 1;
      existing.amount += amount;
    } else {
      map.set(date, { count: 1, amount });
    }
  });

  return Array.from(map.entries())
    .map(([date, { count, amount }]) => ({ date, orderCount: count, totalAmount: amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function useDashboardData(preset: DateRangePreset, autoRefreshIntervalMs = 60000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange(preset);
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      const orders = await fetchOrders(fromStr, toStr);
      const dailyStats = aggregateOrdersByDay(orders);

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_paid_tax_incl), 0);
      const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders;

      setData({
        stats: { totalOrders, totalRevenue, averageOrderValue },
        dailyStats,
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    loadData();
    if (autoRefreshIntervalMs > 0) {
      const interval = setInterval(loadData, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [loadData, autoRefreshIntervalMs]);

  return { data, loading, error, refetch: loadData };
}