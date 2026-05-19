import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';
import type { CategoryStats } from '../../types/financial.types';

interface CategoryChartProps {
  categories: CategoryStats[];
}

const COLORS = {
  sales:     '#6366f1',
  purchases: '#f59e0b',
  profit:    '#22c55e',
  loss:      '#e11d48',
};

function truncate(name: string, max = 14): string {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      minWidth: 180,
    }}>
      <p style={{ fontWeight: 700, color: '#111827', marginBottom: 8, fontSize: 13 }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color, fontSize: 13, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{entry.name} : </span>
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function CategoryChart({ categories }: CategoryChartProps) {
  const data = categories
    .filter(c => c.sales > 0 || c.purchases > 0)
    .slice(0, 10)
    .map(c => ({
      name: truncate(c.categoryName),
      fullName: c.categoryName,
      'Ventes HT': parseFloat(c.sales.toFixed(2)),
      'Achats HT': parseFloat(c.purchases.toFixed(2)),
      'Bénéfice':  parseFloat(c.profit.toFixed(2)),
    }));

  if (data.length === 0) {
    return (
      <div className="fa-chart-card">
        <div className="fa-chart-head">
          <h2 className="fa-chart-title">Performances par catégorie</h2>
        </div>
        <div className="fa-table-empty">Aucune donnée de vente sur la période sélectionnée.</div>
      </div>
    );
  }


}
