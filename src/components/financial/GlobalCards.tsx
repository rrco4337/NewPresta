import { formatCurrency } from '../../utils/formatCurrency';
import type { FinancialGlobal } from '../../types/financial.types';

const IconSales = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconPurchase = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

const IconProfit = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

const IconLoss = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
    <polyline points="16 17 22 17 22 11"/>
  </svg>
);

const IconStock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    <path d="M12 11v4"/>
    <path d="M8 11v4"/>
    <path d="M16 11v4"/>
  </svg>
);

interface GlobalCardsProps {
  global: FinancialGlobal;
  totalStockValue: number;  // Valeur totale du stock
}

export function GlobalCards({ global, totalStockValue }: GlobalCardsProps) {
  const isProfit = global.profit >= 0;

  return (
    <div className="fa-kpi-grid">
      <div className="fa-kpi-card">
        <div className="fa-kpi-icon fa-kpi-icon--indigo">
          <IconSales />
        </div>
        <div className="fa-kpi-body">
          <p className="fa-kpi-label">Ventes totales HT</p>
          <p className="fa-kpi-value">{formatCurrency(global.totalSales)}</p>
        </div>
      </div>

      <div className="fa-kpi-card">
        <div className="fa-kpi-icon fa-kpi-icon--amber">
          <IconPurchase />
        </div>
        <div className="fa-kpi-body">
          <p className="fa-kpi-label">Achats HT (COGS)</p>
          <p className="fa-kpi-value">{formatCurrency(global.totalPurchases)}</p>
        </div>
      </div>

      <div className="fa-kpi-card">
        <div className={`fa-kpi-icon ${isProfit ? 'fa-kpi-icon--green' : 'fa-kpi-icon--red'}`}>
          {isProfit ? <IconProfit /> : <IconLoss />}
        </div>
        <div className="fa-kpi-body">
          <p className="fa-kpi-label">Bénéfice net HT</p>
          <p className={`fa-kpi-value ${isProfit ? 'fa-kpi-value--green' : 'fa-kpi-value--red'}`}>
            {formatCurrency(global.profit)}
          </p>
        </div>
      </div>

      {/* Nouvelle carte pour la valeur du stock */}
      {/* <div className="fa-kpi-card">
        <div className="fa-kpi-icon fa-kpi-icon--purple">
          <IconStock />
        </div>
        <div className="fa-kpi-body">
          <p className="fa-kpi-label">Valeur totale du stock</p>
          <p className="fa-kpi-value">{formatCurrency(totalStockValue)}</p>
          <p className="fa-kpi-subtitle">Coût d'achat total</p>
        </div>
      </div> */}
    </div>
  );
}