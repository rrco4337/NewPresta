import { useState } from 'react';
import { type DateRangePreset } from '../types/dashboard.types';
import { useDashboardData } from '../hooks/useDashboardData';
import { StatsCards } from '../components/dashboard/StatsCards';
import { SalesChart } from '../components/dashboard/SalesChart';
import { OrdersTable } from '../components/dashboard/OrdersTable';
import { DateFilter } from '../components/dashboard/DateFilter';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';

export default function DashboardPage() {
  const [preset, setPreset] = useState<DateRangePreset>('last30days');
  const { data, loading, error, refetch } = useDashboardData(preset, 60000); // auto-refresh toutes les 60s

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-600">Erreur : {error}</p>
      <button onClick={refetch} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Réessayer</button>
    </div>
  );
  if (!data) return null;

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Tableau de bord</h1>
          <button
            onClick={refetch}
            className="text-sm bg-white border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition"
          >
            ⟳ Actualiser
          </button>
        </div>
        <DateFilter value={preset} onChange={setPreset} />
        <StatsCards
          totalOrders={data.stats.totalOrders}
          totalRevenue={data.stats.totalRevenue}
          averageOrderValue={data.stats.averageOrderValue}
        />
        <SalesChart data={data.dailyStats} />
        <OrdersTable dailyStats={data.dailyStats} />
      </div>
    </div>
  );
}