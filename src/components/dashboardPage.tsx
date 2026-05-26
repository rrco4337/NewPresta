import { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { StatsCards } from './dashboard/StatsCards';
import { OrdersTable } from './dashboard/OrdersTable';
import { DashboardSkeleton } from './dashboard/DashboardSkeleton';

interface DashboardFilters { selectedDate: string | null; }

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({ selectedDate: null });
  const { data, loading, error, refetch } = useDashboardData(filters, 60000);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '16px 20px', background: '#fff5f5',
        border: '1px solid #fecaca', borderRadius: '12px',
        color: '#dc2626', fontSize: '0.875rem', fontWeight: 500,
      }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1rem' }}></i>
        Erreur de chargement : {error}
      </div>
    );
  }

  if (!data) return null;

  const globalTotalOrders  = data.dailyStats.reduce((s, d) => s + d.orderCount, 0);
  const globalTotalRevenue = data.dailyStats.reduce((s, d) => s + d.totalAmount, 0);
  const globalAvg = globalTotalOrders === 0 ? 0 : globalTotalRevenue / globalTotalOrders;
  const cancel    = data.dailyStats.reduce((s, d) => s + (d.totalAmount === 0 && d.orderCount > 0 ? d.orderCount : 0), 0);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px', animation: 'slide-up 0.22s ease' }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '0.95rem',
              boxShadow: '0 4px 12px rgba(67,97,238,0.3)',
            }}>
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <h1 style={{
              margin: 0,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '1.4rem', fontWeight: 800,
              color: '#0f1620', letterSpacing: '-0.3px',
            }}>
              Tableau de bord
            </h1>
          </div>
          <p style={{
            margin: 0, fontSize: '0.82rem', color: '#6b7a99',
            textTransform: 'capitalize',
          }}>{today}</p>
        </div>

        <button
          onClick={refetch}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '9px 18px', background: '#fff',
            border: '1.5px solid #d0d7e1', borderRadius: '10px',
            fontSize: '0.82rem', fontWeight: 600, color: '#4a5568',
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = '#4361ee';
            el.style.color = '#4361ee';
            el.style.background = '#eef1fd';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = '#d0d7e1';
            el.style.color = '#4a5568';
            el.style.background = '#fff';
          }}
        >
          <i className="fa-solid fa-rotate-right" style={{ fontSize: '0.8rem' }}></i>
          Actualiser
        </button>
      </div>

      {/* ── Filtre date ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '14px 20px', background: '#fff',
        border: '1px solid #d0d7e1', borderRadius: '12px',
        boxShadow: '0 1px 4px rgba(15,22,40,0.05)',
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: '#eef1fd', color: '#4361ee',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.82rem', flexShrink: 0,
        }}>
          <i className="fa-regular fa-calendar"></i>
        </div>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4a5568', flexShrink: 0 }}>
          Filtrer par date :
        </span>
        <input
          type="date"
          value={filters.selectedDate ?? ''}
          onChange={e => setFilters({ selectedDate: e.target.value || null })}
          style={{
            padding: '7px 12px', border: '1.5px solid #d0d7e1',
            borderRadius: '8px', fontSize: '0.82rem', color: '#0f1620',
            background: '#f1f4f9', outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
          onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
        />
        {filters.selectedDate && (
          <>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', background: '#eef1fd', color: '#4361ee',
              borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
            }}>
              <i className="fa-solid fa-filter" style={{ fontSize: '0.65rem' }}></i>
              {filters.selectedDate}
            </span>
            <button
              onClick={() => setFilters({ selectedDate: null })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', background: '#fee2e2', color: '#dc2626',
                border: 'none', borderRadius: '999px',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.65rem' }}></i>
              Effacer
            </button>
          </>
        )}
      </div>

      {/* ── KPI globaux ── */}
      <div>
        <p style={{
          margin: '0 0 12px',
          fontSize: '0.65rem', fontWeight: 700, color: '#a3b0c8',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <i className="fa-solid fa-globe" style={{ color: '#4361ee' }}></i>
          Vue globale — toutes commandes
        </p>
        <StatsCards
          totalOrders={globalTotalOrders}
          totalRevenue={globalTotalRevenue}
          averageOrderValue={globalAvg}
          cancelledOrders={cancel}
        />
      </div>

      {/* ── KPI filtrés ── */}
      {filters.selectedDate && (
        <div>
          <p style={{
            margin: '0 0 12px',
            fontSize: '0.65rem', fontWeight: 700, color: '#a3b0c8',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <i className="fa-solid fa-filter" style={{ color: '#4361ee' }}></i>
            Résultats du {filters.selectedDate}
          </p>
          <StatsCards
            totalOrders={data.stats.totalOrders}
            totalRevenue={data.stats.totalRevenue}
            averageOrderValue={data.stats.averageOrderValue}
            cancelledOrders={data.stats.cancelledOrders}
          />
        </div>
      )}

      {/* ── Tableau par jour ── */}
      <OrdersTable dailyStats={data.dailyStats} />
    </div>
  );
}
