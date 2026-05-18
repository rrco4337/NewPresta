import { useState, useEffect, useCallback } from 'react';
import { financialService } from '../services/financialService';
import type { CategoryStats, FinancialFilters, FinancialGlobal } from '../types/financial.types';

interface FinancialState {
  global: FinancialGlobal | null;
  allCategories: CategoryStats[];
  loading: boolean;
  error: string | null;
}

export function useFinancialData(filters: FinancialFilters) {
  const [state, setState] = useState<FinancialState>({
    global: null,
    allCategories: [],
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    financialService
      .getFinancialData(filters)
      .then(data => {
        if (!cancelled) {
          setState({ global: data.global, allCategories: data.byCategory, loading: false, error: null });
        }
      })
      .catch(err => {
        if (!cancelled) {
          setState(s => ({ ...s, loading: false, error: err.message ?? 'Erreur inconnue' }));
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.period, filters.dateFrom, filters.dateTo, tick]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  // Filtrage par catégorie côté client (pas de re-fetch)
  const categories = filters.categoryId
    ? state.allCategories.filter(c => c.categoryId === filters.categoryId)
    : state.allCategories;

  // Recalcul des totaux si filtre catégorie actif
  const global: FinancialGlobal | null =
    filters.categoryId && state.global
      ? (() => {
          const totalSales = categories.reduce((s, c) => s + c.sales, 0);
          const totalPurchases = categories.reduce((s, c) => s + c.purchases, 0);
          return { totalSales, totalPurchases, profit: totalSales - totalPurchases };
        })()
      : state.global;

  return {
    global,
    categories,
    allCategories: state.allCategories,
    loading: state.loading,
    error: state.error,
    refetch,
  };
}
