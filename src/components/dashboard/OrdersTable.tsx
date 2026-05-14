import { type DailyOrderStat } from '../../types/dashboard.types';
import { formatCurrency } from '../../utils/formatCurrency';

interface OrdersTableProps {
  dailyStats: DailyOrderStat[];
}

function formatDate(raw: string): string {
  const d = new Date(raw + 'T00:00:00');
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function OrdersTable({ dailyStats }: OrdersTableProps) {
  const sorted = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="db-table-card">
      <div className="db-table-head">
        <h2 className="db-table-title">Détail par jour</h2>
        <span className="db-table-pill">{sorted.length} jour{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="db-table-empty">Aucune donnée disponible</div>
      ) : (
        <table className="db-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Commandes</th>
              <th>Montant total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((day) => (
              <tr key={day.date}>
                <td>
                  <span className="db-date-badge">{formatDate(day.date)}</span>
                </td>
                <td className="db-td-orders">
                  <span className="db-order-badge">{day.orderCount}</span>
                </td>
                <td className="db-td-amount">{formatCurrency(day.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
