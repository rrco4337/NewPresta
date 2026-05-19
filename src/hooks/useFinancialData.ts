import { useState, useEffect, useCallback } from 'react';
import { financialService } from '../services/financialService';
import type { CategoryStats, FinancialFilters, FinancialGlobal } from '../types/financial.types';

interface FinancialState {
  global: FinancialGlobal | null;
  allCategories: CategoryStats[];      // Ventes par catégorie (période)
  totalStockValue: number;              // Valeur totale du stock
  stockByCategory: CategoryStats[];     // Stock par catégorie
  loading: boolean;
  error: string | null;
}

export function useFinancialData(filters: FinancialFilters) {
  const [state, setState] = useState<FinancialState>({
    global: null,
    allCategories: [],
    totalStockValue: 0,
    stockByCategory: [],
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
          setState({ 
            global: data.global, 
            allCategories: data.byCategory,
            totalStockValue: data.totalStockValue,
            stockByCategory: data.stockByCategory,
            loading: false, 
            error: null 
          });
        }
      })
      .catch(err => {
        if (!cancelled) {
          setState(s => ({ 
            ...s, 
            loading: false, 
            error: err.message ?? 'Erreur inconnue' 
          }));
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.period, filters.dateFrom, filters.dateTo, tick]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  // Filtrage par catégorie côté client pour les ventes (pas de re-fetch)
  const categories = filters.categoryId
    ? state.allCategories.filter(c => c.categoryId === filters.categoryId)
    : state.allCategories;

  // Filtrage par catégorie pour le stock
  const filteredStockByCategory = filters.categoryId
    ? state.stockByCategory.filter(c => c.categoryId === filters.categoryId)
    : state.stockByCategory;

  // Recalcul des totaux si filtre catégorie actif pour les ventes
  const global: FinancialGlobal | null =
    filters.categoryId && state.global
      ? (() => {
          const totalSales = categories.reduce((s, c) => s + c.sales, 0);
          const totalPurchases = categories.reduce((s, c) => s + c.purchases, 0);
          return { totalSales, totalPurchases, profit: totalSales - totalPurchases };
        })()
      : state.global;

  // Valeur du stock filtrée par catégorie
  const filteredStockValue = filters.categoryId
    ? filteredStockByCategory.reduce((s, c) => s + c.purchases, 0)
    : state.totalStockValue;

  return {
    // Données de ventes (période)
    global,                      // Totaux des ventes (filtrés par catégorie si besoin)
    categories,                  // Ventes par catégorie (filtrées)
    allCategories: state.allCategories, // Toutes les catégories (ventes)
    
    // Données de stock (tous produits)
    totalStockValue: state.totalStockValue,      // Valeur brute totale du stock
    filteredStockValue,                          // Valeur du stock filtrée par catégorie
    stockByCategory: state.stockByCategory,      // Stock par catégorie (brut)
    filteredStockByCategory,                     // Stock par catégorie (filtré)
    
    // États généraux
    loading: state.loading,
    error: state.error,
    refetch,
  };
}