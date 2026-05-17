import { type DailyStats } from '../../types/dashboard.types';
import { formatCurrency } from '../../utils/formatCurrency';

interface OrdersTableProps {
  dailyStats: DailyStats[];
}

function formatDate(raw: string): string {
  const d = new Date(raw + 'T00:00:00');
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function OrdersTable({ dailyStats }: OrdersTableProps) {
  const sorted = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date));

  const grandTotalOrders = sorted.reduce((s, d) => s + d.orderCount, 0);
  const grandTotalCarts = sorted.reduce((s, d) => s + d.cartCount, 0);
  const grandOrderRevenue = sorted.reduce((s, d) => s + d.orderRevenue, 0);
  const grandCartRevenue = sorted.reduce((s, d) => s + d.cartRevenue, 0);
  const grandTotal = grandTotalOrders + grandTotalCarts;
  const grandRevenue = grandOrderRevenue + grandCartRevenue;

  return (
    <div className="db-table-card">
      <div className="db-table-head">
        <h2 className="db-table-title">Détail par jour</h2>
        <span className="db-table-pill">{sorted.length} jour{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="db-table-empty">Aucune donnée disponible</div>
      ) : (
        <div className="db-table-scroll">
          <table className="db-table db-table--extended">
            <thead>
              <tr>
                <th>Date</th>
                <th className="db-th-num">Commandes</th>
                <th className="db-th-num">Paniers</th>
                <th className="db-th-amount">CA Commandes</th>
                <th className="db-th-amount">CA Paniers</th>
                <th className="db-th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((day) => (
                <tr key={day.date}>
                  <td>
                    <span className="db-date-badge">{formatDate(day.date)}</span>
                  </td>
                  <td className="db-td-orders">
                    <span className="db-order-badge db-order-badge--orders">{day.orderCount}</span>
                  </td>
                  <td className="db-td-orders">
                    <span className="db-order-badge db-order-badge--carts">{day.cartCount}</span>
                  </td>
                  <td className="db-td-amount">{formatCurrency(day.orderRevenue)}</td>
                  <td className="db-td-amount db-td-amount--cart">{formatCurrency(day.cartRevenue)}</td>
                  <td className="db-td-total">
                    <div className="db-total-cell">
                      <span className="db-total-count">{day.totalCount} cmd/pan</span>
                      <span className="db-total-amount">{formatCurrency(day.totalRevenue)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="db-tfoot-row">
                <td><strong>Total général</strong></td>
                <td className="db-td-orders"><span className="db-order-badge db-order-badge--orders">{grandTotalOrders}</span></td>
                <td className="db-td-orders"><span className="db-order-badge db-order-badge--carts">{grandTotalCarts}</span></td>
                <td className="db-td-amount"><strong>{formatCurrency(grandOrderRevenue)}</strong></td>
                <td className="db-td-amount db-td-amount--cart"><strong>{formatCurrency(grandCartRevenue)}</strong></td>
                <td className="db-td-total">
                  <div className="db-total-cell">
                    <span className="db-total-count db-total-count--grand">{grandTotal} cmd/pan</span>
                    <span className="db-total-amount db-total-amount--grand">{formatCurrency(grandRevenue)}</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
