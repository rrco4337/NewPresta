import { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { StatsCards } from './dashboard/StatsCards';
import { OrdersTable } from './dashboard/OrdersTable';
import { DashboardSkeleton } from './dashboard/DashboardSkeleton';
import './Dashboard.css';

interface DashboardFilters {
  selectedDate: string | null;
}

const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({ selectedDate: null });
  const { data, loading, error, refetch } = useDashboardData(filters, 60000);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="db-page">
        <div className="db-error">
          <span>Erreur de chargement : {error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const globalTotalOrders  = data.dailyStats.reduce((s, d) => s + d.orderCount, 0);
  const globalTotalRevenue = data.dailyStats.reduce((s, d) => s + d.totalAmount, 0);
  const globalAvg = globalTotalOrders === 0 ? 0 : globalTotalRevenue / globalTotalOrders;
  const cancel = data.dailyStats.reduce((s, d) => {
  // Si le montant total du jour est 0 mais qu'il y a des commandes, elles sont toutes annulées
  // Sinon, il faut utiliser cancelledOrders depuis les stats
  return s + (d.totalAmount === 0 && d.orderCount > 0 ? d.orderCount : 0);
}, 0);

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="db-page">

      {/* ── En-tête ── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-title">Tableau de bord</h1>
          <p className="db-subtitle">{today}</p>
        </div>
        <button className="db-refresh-btn" onClick={refetch}>
          <IconRefresh />
          Actualiser
        </button>
      </div>

      {/* ── Filtre date ── */}
      <div className="db-filter-bar">
        <span className="db-filter-icon"><IconCalendar /></span>
        <span className="db-filter-label">Filtrer par date :</span>
        <input
          type="date"
          className="db-filter-input"
          value={filters.selectedDate ?? ''}
          onChange={(e) => setFilters({ selectedDate: e.target.value || null })}
        />
        {filters.selectedDate && (
          <button className="db-filter-clear" onClick={() => setFilters({ selectedDate: null })}>
            ✕ Effacer
          </button>
        )}
        {filters.selectedDate && (
          <span className="db-filter-active-badge">
            {filters.selectedDate}
          </span>
        )}
      </div>

      {/* ── KPI globaux ── */}
        <div>
  <p className="db-section-label">Vue globale — toutes commandes</p>
  <StatsCards
    totalOrders={globalTotalOrders}
    totalRevenue={globalTotalRevenue}
    averageOrderValue={globalAvg}
    cancelledOrders={cancel}  // ← CHANGE: cancelledTotal → cancelledOrders
  />
</div>
      {/* ── KPI filtrés ── */}
  {filters.selectedDate && (
  <div>
    <p className="db-section-label">Résultats du {filters.selectedDate}</p>
    <StatsCards
      totalOrders={data.stats.totalOrders}
      totalRevenue={data.stats.totalRevenue}
      averageOrderValue={data.stats.averageOrderValue}
      cancelledOrders={data.stats.cancelledOrders}  // ← OK
    />
  </div>
)}
      

      {/* ── Tableau par jour ── */}
      <OrdersTable dailyStats={data.dailyStats} />

    </div>
  );
}
