import { formatCurrency } from '../../utils/formatCurrency';

interface StatsCardsProps {
  totalOrders: number;
  totalCarts: number;
  orderRevenue: number;
  cartRevenue: number;
  totalCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageCartValue: number;
}

const IconOrders = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

const IconCart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
  </svg>
);

const IconRevenue = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);

const IconTotal = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const IconAvg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel?: string;
  subValue?: string;
  colorClass: string;
}

function KpiCard({ icon, label, value, subLabel, subValue, colorClass }: KpiCardProps) {
  return (
    <div className="db-kpi-card">
      <div className={`db-kpi-icon ${colorClass}`}>{icon}</div>
      <div className="db-kpi-body">
        <div className="db-kpi-label">{label}</div>
        <div className="db-kpi-value">{value}</div>
        {subLabel && subValue && (
          <div className="db-kpi-sub">
            <span className="db-kpi-sub-label">{subLabel}</span>
            <span className="db-kpi-sub-value">{subValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatsCards({
  totalOrders,
  totalCarts,
  orderRevenue,
  cartRevenue,
  totalCount,
  totalRevenue,
  averageOrderValue,
  averageCartValue,
}: StatsCardsProps) {
  return (
    <div className="db-kpi-section">
      <div className="db-kpi-grid">
        <KpiCard
          icon={<IconOrders />}
          label="Commandes"
          value={String(totalOrders)}
          subLabel="Panier moyen"
          subValue={formatCurrency(averageOrderValue)}
          colorClass="db-kpi-icon--indigo"
        />
        <KpiCard
          icon={<IconCart />}
          label="Paniers"
          value={String(totalCarts)}
          subLabel="Valeur moy. panier"
          subValue={formatCurrency(averageCartValue)}
          colorClass="db-kpi-icon--amber"
        />
        <KpiCard
          icon={<IconRevenue />}
          label="CA Commandes"
          value={formatCurrency(orderRevenue)}
          colorClass="db-kpi-icon--green"
        />
        <KpiCard
          icon={<IconRevenue />}
          label="CA Paniers"
          value={formatCurrency(cartRevenue)}
          colorClass="db-kpi-icon--teal"
        />
        <KpiCard
          icon={<IconTotal />}
          label="Total général"
          value={`${totalCount} cmd/panier`}
          subLabel="CA total"
          subValue={formatCurrency(totalRevenue)}
          colorClass="db-kpi-icon--pink"
        />
        <KpiCard
          icon={<IconAvg />}
          label="Répartition"
          value={`${totalOrders > 0 ? Math.round((totalOrders / totalCount) * 100) : 0}% cmd`}
          subLabel="Paniers"
          subValue={`${totalCarts > 0 ? Math.round((totalCarts / totalCount) * 100) : 0}%`}
          colorClass="db-kpi-icon--purple"
        />
      </div>
    </div>
  );
}
