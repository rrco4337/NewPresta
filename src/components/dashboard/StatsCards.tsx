import { formatCurrency } from '../../utils/formatCurrency';

interface StatsCardsProps {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export function StatsCards({ totalOrders, totalRevenue, averageOrderValue }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500">Commandes</h3>
        <p className="text-3xl font-bold text-gray-800 mt-2">{totalOrders}</p>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500">Chiffre d’affaires</h3>
        <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(totalRevenue)}</p>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500">Panier moyen</h3>
        <p className="text-3xl font-bold text-blue-600 mt-2">{formatCurrency(averageOrderValue)}</p>
      </div>
    </div>
  );
}