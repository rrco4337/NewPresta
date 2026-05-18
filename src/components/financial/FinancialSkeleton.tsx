import { useState } from 'react';

import { CategorySelector } from '../financial/CategorySelector';
import { GlobalCards } from '../financial/GlobalCards';
import { CategoryTable } from '../financial/CategoryTable';
import { useFinancialData } from '../../hooks/useFinancialData';
export function FinancialSkeleton() {
  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Analyse financière par catégorie</h1>
        <div className="mb-6">
            <label>Filtrer par catégorie : </label>
            <div className="w-48 h-10 bg-gray-300 rounded animate-pulse ml-2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="stat-card animate-pulse"><div className="stat-title">Ventes totales</div><div className="stat-value bg-gray-300 h-8 w-full rounded"></div></div>
            <div className="stat-card animate-pulse"><div className="stat-title">Achats (stock)</div><div className="stat-value bg-gray-300 h-8 w-full rounded"></div></div>
            <div className="stat-card animate-pulse"><div className="stat-title">Bénéfice</div><div className="stat-value bg-gray-300 h-8 w-full rounded"></div></div>
        </div>
        <h2 className="text-xl font-semibold mt-8 mb-4">Détail par catégorie</h2>
        <table className="min-w-full">
            <thead><tr><th>Catégorie</th><th>Ventes</th><th>Achats (stock)</th><th>Bénéfice</th></tr></thead>
            <tbody>
                {[1,2,3,4,5].map(i => (
                    <tr key={i} className="animate-pulse">
                        <td><div className="bg-gray-300 h-6 w-32 rounded"></div></td>
                        <td><div className="bg-gray-300 h-6 w-20 rounded"></div></td>
                        <td><div className="bg-gray-300 h-6 w-20 rounded"></div></td>
                        <td><div className="bg-gray-300 h-6 w-20 rounded"></div></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
    );
}

export function FinancialAnalytics() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { global, categories, loading, error, refetch } = useFinancialData(selectedCategory);

  if (loading) return <FinancialSkeleton />;
  if (error) return <div className="error">Erreur : {error}</div>;
  if (!global) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Analyse financière par catégorie</h1>
      <div className="mb-6">
        <label>Filtrer par catégorie : </label>
        <CategorySelector value={selectedCategory} onChange={setSelectedCategory} />
      </div>
      <GlobalCards totalSales={global.totalSales} totalPurchases={global.totalPurchases} profit={global.profit} />
      <h2 className="text-xl font-semibold mt-8 mb-4">Détail par catégorie</h2>
      <CategoryTable categories={categories} />
      <button onClick={refetch} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded">Actualiser</button>
    </div>
  );
}