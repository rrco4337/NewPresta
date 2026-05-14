import { formatCurrency } from '../../utils/formatCurrency';

interface StatsCardsProps {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

const IconOrders = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

const IconRevenue = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);

const IconAvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

export function StatsCards({ totalOrders, totalRevenue, averageOrderValue }: StatsCardsProps) {
  return (
    <div className="db-kpi-grid">
      <div className="db-kpi-card">
        <div className="db-kpi-icon db-kpi-icon--indigo">
          <IconOrders />
        </div>
        <div className="db-kpi-body">
          <div className="db-kpi-label">Commandes</div>
          <div className="db-kpi-value">{totalOrders}</div>
        </div>
      </div>

      <div className="db-kpi-card">
        <div className="db-kpi-icon db-kpi-icon--green">
          <IconRevenue />
        </div>
        <div className="db-kpi-body">
          <div className="db-kpi-label">Chiffre d'affaires</div>
          <div className="db-kpi-value db-kpi-value--green">{formatCurrency(totalRevenue)}</div>
        </div>
      </div>

      <div className="db-kpi-card">
        <div className="db-kpi-icon db-kpi-icon--pink">
          <IconAvg />
        </div>
        <div className="db-kpi-body">
          <div className="db-kpi-label">Panier moyen</div>
          <div className="db-kpi-value db-kpi-value--pink">{formatCurrency(averageOrderValue)}</div>
        </div>
      </div>
    </div>
  );
}
