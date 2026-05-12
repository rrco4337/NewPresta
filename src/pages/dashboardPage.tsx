import { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { StatsCards } from '../components/dashboard/StatsCards';
import { SalesChart } from '../components/dashboard/SalesChart';
import { OrdersTable } from '../components/dashboard/OrdersTable';
import { DatePickerInput } from '../components/dashboard/DatePickerInput';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';

interface DashboardFilters {
  selectedDate: string | null;
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({ selectedDate: null });
  const { data, loading, error, refetch } = useDashboardData(filters, 60000);

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="p-6 text-red-600">Erreur : {error}</div>;
  if (!data) return null;

  // Calcul des totaux globaux (toutes commandes) à partir de dailyStats
  const globalTotalOrders = data.dailyStats.reduce((sum, day) => sum + day.orderCount, 0);
  const globalTotalRevenue = data.dailyStats.reduce((sum, day) => sum + day.totalAmount, 0);
  const globalAverageOrderValue = globalTotalOrders === 0 ? 0 : globalTotalRevenue / globalTotalOrders;

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Tableau de bord</h1>
          <button onClick={refetch} className="text-sm bg-white border rounded-lg px-4 py-2">
            ⟳ Actualiser
          </button>
        </div>

        <DatePickerInput
          selectedDate={filters.selectedDate}
          onDateChange={(date) => setFilters({ selectedDate: date })}
        />

        {/* Section : Total général (toutes commandes) */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">📊 Total général (toutes commandes)</h2>
          <StatsCards
            totalOrders={globalTotalOrders}
            totalRevenue={globalTotalRevenue}
            averageOrderValue={globalAverageOrderValue}
          />
        </div>

        {/* Section : Résultats filtrés (selon date) */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            {filters.selectedDate ? `Résultats pour le ${filters.selectedDate}` : "Résultats (aucun filtre)"}
          </h2>
          <StatsCards
            totalOrders={data.stats.totalOrders}
            totalRevenue={data.stats.totalRevenue}
            averageOrderValue={data.stats.averageOrderValue}
          />
        </div>

        {/* Graphique des ventes par jour (toutes dates) */}
        <SalesChart data={data.dailyStats} />

        {/* Tableau récapitulatif par jour (toutes dates) */}
        <OrdersTable dailyStats={data.dailyStats} />
      </div>
    </div>
  );
}