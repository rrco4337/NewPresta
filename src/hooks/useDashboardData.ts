import { useState, useEffect, useCallback } from 'react';
import { fetchOrders,type OrderFromApi } from '../services/dashboardApi';
import {type  DailyOrderStat,type  DashboardData, type DashboardFilters } from '../types/dashboard.types';

function aggregateOrdersByDay(orders: OrderFromApi[]): DailyOrderStat[] {
  const map = new Map<string, { count: number; amount: number }>();
  orders.forEach(order => {
    const date = order.date_add.split(' ')[0];
    const amount = parseFloat(order.total_paid_tax_incl);
    const existing = map.get(date);
    if (existing) {
      existing.count++;
      existing.amount += amount;
    } else {
      map.set(date, { count: 1, amount });
    }
  });
  return Array.from(map.entries())
    .map(([date, { count, amount }]) => ({ date, orderCount: count, totalAmount: amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function useDashboardData(filters: DashboardFilters, autoRefreshIntervalMs = 60000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Récupère toutes les commandes à chaque appel (pas de cache d'état pour éviter boucle)
      const allOrders = await fetchOrders();
      
      // Filtre selon selectedDate
      const filteredOrders = filters.selectedDate
        ? allOrders.filter(order => order.date_add.split(' ')[0] === filters.selectedDate)
        : allOrders;
      
      const dailyStats = aggregateOrdersByDay(allOrders);
      const totalOrders = filteredOrders.length;
      const totalRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_paid_tax_incl), 0);
      const averageOrderValue = totalOrders === 0 ? 0 : totalRevenue / totalOrders;
      
      setData({ stats: { totalOrders, totalRevenue, averageOrderValue }, dailyStats });
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [filters]); // plus de dépendance à allOrders

  useEffect(() => {
    loadData();
    if (autoRefreshIntervalMs > 0) {
      const interval = setInterval(loadData, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [loadData, autoRefreshIntervalMs]);

  return { data, loading, error, refetch: loadData };
}