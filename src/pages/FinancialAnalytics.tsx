import { useState } from 'react';
import { useFinancialData } from '../hooks/useFinancialData';
import { GlobalCards } from '../components/financial/GlobalCards';
import { CategoryTable } from '../components/financial/CategoryTable';
import { CategoryChart } from '../components/financial/CategoryChart';
import { CategorySelector } from '../components/financial/CategorySelector';
import { PeriodFilter } from '../components/financial/PeriodFilter';
import { FinancialSkeleton } from '../components/financial/FinancialSkeleton';
import type { FinancialFilters } from '../types/financial.types';
import '../components/financial/Financial.css';

const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const DEFAULT_FILTERS: FinancialFilters = {
  period: 'month',
  dateFrom: null,
  dateTo: null,
  categoryId: null,
};

function periodLabel(filters: FinancialFilters): string {
  switch (filters.period) {
    case 'day':    return "Aujourd'hui";
    case 'week':   return '7 derniers jours';
    case 'month':  return 'Ce mois';
    case 'year':   return 'Cette année';
    case 'all':    return 'Toutes les périodes';
    case 'custom': {
      if (filters.dateFrom && filters.dateTo) {
        return `${filters.dateFrom} → ${filters.dateTo}`;
      }
      return 'Période personnalisée';
    }
    default: return '';
  }
}

export default function FinancialAnalytics() {
  const [filters, setFilters] = useState<FinancialFilters>(DEFAULT_FILTERS);
  const { 
    global, 
    categories, 
    allCategories, 
    totalStockValue,  // AJOUTÉ : récupérer la valeur du stock
     totalStockPurchaseValue,
    loading, 
    error, 
    refetch 
  } = useFinancialData(filters);

  const handleFiltersChange = (next: FinancialFilters) => {
    setFilters(next);
  };

  const handleCategoryChange = (id: number | null) => {
    setFilters(f => ({ ...f, categoryId: id }));
  };

  // Log pour déboguer
  console.log('💰 totalStockValue dans le composant:', totalStockValue);
  console.log('📊 global:', global);

  if (loading) return <FinancialSkeleton />;

  if (error) {
    return (
      <div className="fa-page">
        <div className="fa-error">
          <span>⚠️ Erreur de chargement : {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fa-page">

      {/* ── En-tête ── */}
      <div className="fa-header">
        <div className="fa-header-left">
          <h1 className="fa-title">Statistiques commerciales</h1>
          <p className="fa-subtitle">{periodLabel(filters)}</p>
        </div>
        <button className="fa-refresh-btn" onClick={refetch}>
          <IconRefresh />
          Actualiser
        </button>
      </div>

      {/* ── Filtre période ── */}
      <PeriodFilter filters={filters} onChange={handleFiltersChange} />

      {/* ── Filtre catégorie ── */}
      <CategorySelector
        allCategories={allCategories}
        value={filters.categoryId}
        onChange={handleCategoryChange}
      />

      {/* ── KPI globaux ── */}
      {global && (
        <div>
          <p className="fa-section-label">
            {filters.categoryId
              ? `Totaux — catégorie sélectionnée`
              : 'Totaux globaux — toutes catégories'}
          </p>
          {/* CORRECTION : Passer totalStockValue */}
          <GlobalCards global={global} totalStockValue={totalStockValue} />


        </div>

        
      )}

    
      {/* ── Tableau par catégorie ── */}
      <CategoryTable categories={categories} />

    </div>
  );
}