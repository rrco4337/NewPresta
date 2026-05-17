import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Bar, ComposedChart,
} from 'recharts';
import { type DailyStats } from '../../types/dashboard.types';
import { formatCurrency } from '../../utils/formatCurrency';

interface SalesChartProps {
  data: DailyStats[];
}

export function SalesChart({ data }: SalesChartProps) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const formattedData = sorted.map(day => ({
    date: day.date,
    'CA Commandes': day.orderRevenue,
    'CA Paniers': day.cartRevenue,
    'CA Total': day.totalRevenue,
    'Nb Commandes': day.orderCount,
    'Nb Paniers': day.cartCount,
  }));

  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-gray-100 mb-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Évolution des ventes par jour</h2>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="revenue" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={100} />
          <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) =>
              ['CA Commandes', 'CA Paniers', 'CA Total'].includes(name as string)
                ? formatCurrency(value as number)
                : value
            }
          />
          <Legend />
          <Bar yAxisId="count" dataKey="Nb Commandes" fill="#818cf8" opacity={0.4} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="count" dataKey="Nb Paniers" fill="#fb923c" opacity={0.4} radius={[3, 3, 0, 0]} />
          <Line yAxisId="revenue" type="monotone" dataKey="CA Commandes" stroke="#4f46e5" strokeWidth={2} dot={false} />
          <Line yAxisId="revenue" type="monotone" dataKey="CA Paniers" stroke="#f97316" strokeWidth={2} dot={false} />
          <Line yAxisId="revenue" type="monotone" dataKey="CA Total" stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
