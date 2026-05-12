import { type DailyOrderStat } from '../../types/dashboard.types';
import { formatCurrency } from '../../utils/formatCurrency';

interface DateSelectFilterProps {
  dailyStats: DailyOrderStat[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

export function DateSelectFilter({ dailyStats, selectedDate, onDateChange }: DateSelectFilterProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Filtrer par date :</label>
      <select
        value={selectedDate || ''}
        onChange={(e) => onDateChange(e.target.value || null)}
        className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">📅 Toutes les commandes</option>
        {dailyStats.map(stat => (
          <option key={stat.date} value={stat.date}>
            {stat.date} — {stat.orderCount} commande(s) — {formatCurrency(stat.totalAmount)}
          </option>
        ))}
      </select>
    </div>
  );
}