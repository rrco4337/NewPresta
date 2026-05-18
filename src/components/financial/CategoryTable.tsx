import { formatCurrency } from '../../utils/formatCurrency';
import type { CategoryStats } from '../../types/financial.types';

interface CategoryTableProps {
  categories: CategoryStats[];
}

function ProfitBadge({ profit }: { profit: number }) {
  if (profit > 0) {
    return (
      <span className="fa-profit-badge fa-profit-badge--positive">
        ▲ {formatCurrency(profit)}
      </span>
    );
  }
  if (profit < 0) {
    return (
      <span className="fa-profit-badge fa-profit-badge--negative">
        ▼ {formatCurrency(Math.abs(profit))}
      </span>
    );
  }
  return (
    <span className="fa-profit-badge fa-profit-badge--zero">
      — {formatCurrency(0)}
    </span>
  );
}

export function CategoryTable({ categories }: CategoryTableProps) {
  if (categories.length === 0) {
    return (
      <div className="fa-table-card">
        <div className="fa-table-head">
          <h2 className="fa-table-title">Détail par catégorie</h2>
        </div>
        <div className="fa-table-empty">Aucune donnée à afficher.</div>
      </div>
    );
  }

  return (
    <div className="fa-table-card">
      <div className="fa-table-head">
        <h2 className="fa-table-title">Détail par catégorie</h2>
        <span className="fa-table-pill">{categories.length} catégorie{categories.length > 1 ? 's' : ''}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="fa-table">
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Ventes HT</th>
              <th>Achats HT</th>
              <th>Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.categoryId}>
                <td className="fa-td-cat">{cat.categoryName}</td>
                <td className="fa-td-amount">{formatCurrency(cat.sales)}</td>
                <td className="fa-td-amount">{formatCurrency(cat.purchases)}</td>
                <td><ProfitBadge profit={cat.profit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
