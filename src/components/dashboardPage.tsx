import { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { StatsCards } from './dashboard/StatsCards';
import { OrdersTable } from './dashboard/OrdersTable';
import { SalesChart } from './dashboard/SalesChart';
import { DashboardSkeleton } from './dashboard/DashboardSkeleton';
import './Dashboard.css';

const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dateRange = selectedDate
    ? { dateFrom: selectedDate, dateTo: selectedDate }
    : {};

  const { data, loading, error, refetch } = useDashboardData(dateRange, 60000);

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

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

  const sectionLabel = selectedDate
    ? `Statistiques du ${selectedDate}`
    : 'Vue globale — toutes commandes et paniers';

  return (
    <div className="db-page">

      {/* ── En-tête ── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-title">Tableau de bord</h1>
          <p className="db-subtitle">{todayLabel}</p>
        </div>
        <button className="db-refresh-btn" onClick={refetch}>
          <IconRefresh />
          Actualiser
        </button>
      </div>

      {/* ── Filtre date précise ── */}
      <div className="db-filter-bar">
        <span className="db-filter-icon"><IconCalendar /></span>
        <span className="db-filter-label">Filtrer par date :</span>
        <input
          type="date"
          className="db-filter-input"
          value={selectedDate ?? ''}
          onChange={(e) => setSelectedDate(e.target.value || null)}
        />
        {selectedDate && (
          <button className="db-filter-clear" onClick={() => setSelectedDate(null)}>
            ✕ Effacer
          </button>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div>
        <p className="db-section-label">{sectionLabel}</p>
        <StatsCards
          totalOrders={data.totalOrders}
          totalCarts={data.totalCarts}
          orderRevenue={data.orderRevenue}
          cartRevenue={data.cartRevenue}
          totalCount={data.totalCount}
          totalRevenue={data.totalRevenue}
          averageOrderValue={data.averageOrderValue}
          averageCartValue={data.averageCartValue}
        />
      </div>

      {/* ── Graphique ── */}
      {data.dailyStats.length > 1 && (
        <SalesChart data={data.dailyStats} />
      )}

      {/* ── Tableau par jour ── */}
      <OrdersTable dailyStats={data.dailyStats} />

    </div>
  );
}
