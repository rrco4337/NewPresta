import { formatCurrency } from '../../utils/formatCurrency';

interface StatsCardsProps {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  cancelledOrders?: number;
  cancelledTotal?: number;
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

export function StatsCards({ totalOrders, totalRevenue, averageOrderValue, cancelledOrders = 0, cancelledTotal = 0 }: StatsCardsProps) {
  const activeOrders = totalOrders - cancelledOrders;
  
  // Debug: Afficher dans la console
  console.log('StatsCards - cancelledOrders:', cancelledOrders);
  console.log('StatsCards - totalOrders:', totalOrders);
  console.log('StatsCards - cancelledTotal:', cancelledTotal);
  
  // Styles inline de secours
  const subvalueStyle = {
    display: 'flex',
    gap: '8px',
    fontSize: '0.75rem',
    marginTop: '4px',
    flexDirection: 'column' as const,
    alignItems: 'flex-start'
  };
  
  const activeStyle = {
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.1)',
    padding: '2px 6px',
    borderRadius: '12px',
    fontSize: '0.7rem'
  };
  
  const cancelledStyle = {
    color: '#dc3545',
    background: 'rgba(220, 53, 69, 0.1)',
    padding: '2px 6px',
    borderRadius: '12px',
    fontSize: '0.7rem'
  };
  
  return (
    <div className="db-kpi-grid">
      <div className="db-kpi-card">
        <div className="db-kpi-icon db-kpi-icon--indigo">
          <IconOrders />
        </div>
        <div className="db-kpi-body">
          <div className="db-kpi-label">Commandes</div>
          <div className="db-kpi-value" style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {totalOrders}
            {/* Affichage toujours visible pour tester */}
            <div style={subvalueStyle}>
              <span style={activeStyle}>✓ validées: {activeOrders}</span>
              <span style={cancelledStyle}>✗ annulées: {cancelledOrders}</span>
          
            </div>
          </div>
        </div>
      </div>

      <div className="db-kpi-card">
        <div className="db-kpi-icon db-kpi-icon--green">
          <IconRevenue />
        </div>
        <div className="db-kpi-body">
          <div className="db-kpi-label">Chiffre d'affaires</div>
          <div className="db-kpi-value db-kpi-value--green" style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {formatCurrency(totalRevenue)}
          </div>
        </div>
      </div>

      <div className="db-kpi-card">
        <div className="db-kpi-icon db-kpi-icon--pink">
          <IconAvg />
        </div>
        <div className="db-kpi-body">
          <div className="db-kpi-label">Panier moyen</div>
          <div className="db-kpi-value db-kpi-value--pink" style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {formatCurrency(averageOrderValue)}
          </div>
        </div>
      </div>
    </div>
  );
}