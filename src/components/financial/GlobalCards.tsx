import { formatCurrency } from '../../utils/formatCurrency';
export function GlobalCards({ totalSales, totalPurchases, profit }) {
  const profitColor = profit >= 0 ? 'text-green-600' : 'text-red-600';
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="stat-card"><div className="stat-title">Ventes totales</div><div className="stat-value">{formatCurrency(totalSales)}</div></div>
      <div className="stat-card"><div className="stat-title">Achats (stock)</div><div className="stat-value">{formatCurrency(totalPurchases)}</div></div>
      <div className="stat-card"><div className="stat-title">Bénéfice</div><div className={`stat-value ${profitColor}`}>{formatCurrency(profit)}</div></div>
    </div>
  );
}