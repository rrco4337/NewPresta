import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { type DailyOrderStat } from '../../types/dashboard.types';
import { formatCurrency } from '../../utils/formatCurrency';

interface SalesChartProps {
  data: DailyOrderStat[];
}

export function SalesChart({ data }: SalesChartProps) {
  const formattedData = data.map(day => ({
    date: day.date,
    'Montant total (€)': day.totalAmount,
    'Nb commandes': day.orderCount,
  }));

  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-gray-100 mb-8">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Ventes par jour</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value)} />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip formatter={(value, name) => name === 'Montant total (€)' ? formatCurrency(value as number) : value} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="Montant total (€)" stroke="#10b981" strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="Nb commandes" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}