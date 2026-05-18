import { useState, useEffect, useCallback } from 'react';
import { CANCELED_STATE_ID, fetchOrders, type OrderFromApi } from '../services/dashboardApi';
import { type DailyOrderStat, type DashboardData, type DashboardFilters } from '../types/dashboard.types';

function aggregateOrdersByDay(orders: OrderFromApi[]): DailyOrderStat[] {
  const map = new Map<string, { count: number; amount: number }>();
  orders.forEach(order => {
    const date = order.date_add.split(' ')[0];
    const amount = parseFloat(order.total_paid_tax_incl);
    
    // Pour le comptage : TOUTES les commandes (y compris annulées)
    const existing = map.get(date);
    if (existing) {
      existing.count++; // Incrémente toujours le compteur
      
      // Pour le montant : on n'ajoute que si NON annulée
      if (order.current_state !== CANCELED_STATE_ID) {
        existing.amount += amount;
      }
    } else {
      // Pour le montant : on n'ajoute que si NON annulée
      const amountToAdd = order.current_state !== CANCELED_STATE_ID ? amount : 0;
      map.set(date, { count: 1, amount: amountToAdd });
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
      const allOrders = await fetchOrders();
      
      // Calcul des commandes annulées
      const cancelledOrdersCount = allOrders.filter(
        order => order.current_state === CANCELED_STATE_ID
      ).length;
      
      const nonCanceledOrders = allOrders.filter(
        order => order.current_state !== CANCELED_STATE_ID
      );
      
      // Filtre selon selectedDate
      const filteredOrders = filters.selectedDate
        ? allOrders.filter(order => order.date_add.split(' ')[0] === filters.selectedDate)
        : allOrders;
      
      const cancelledInFiltered = filteredOrders.filter(
        order => order.current_state === CANCELED_STATE_ID
      ).length;
      
      const totalOrders = filteredOrders.length;
      const totalRevenue = filteredOrders
        .filter(order => order.current_state !== CANCELED_STATE_ID)
        .reduce((sum, o) => sum + parseFloat(o.total_paid_tax_incl), 0);
      const nonCanceledCount = filteredOrders.filter(o => o.current_state !== CANCELED_STATE_ID).length;
      const averageOrderValue = nonCanceledCount === 0 ? 0 : totalRevenue / nonCanceledCount;
      
      const dailyStats = aggregateOrdersByDay(allOrders);
      
      setData({ 
        stats: { 
          totalOrders, 
          totalRevenue, 
          averageOrderValue,
          cancelledOrders: cancelledInFiltered , // Ajout du nombre d'annulées
          cancelledTotal: cancelledOrdersCount  // Nombre total d'annulées (toutes dates confondues)
        }, 
        dailyStats,
        allOrders: filteredOrders
      });
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
    if (autoRefreshIntervalMs > 0) {
      const interval = setInterval(loadData, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [loadData, autoRefreshIntervalMs]);

  return { data, loading, error, refetch: loadData };
}