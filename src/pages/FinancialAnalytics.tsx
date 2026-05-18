import { useState } from 'react';
import { useFinancialData } from '../hooks/useFinancialData';
import { CategorySelector } from '../components/financial/CategorySelector';
import { GlobalCards } from '../components/financial/GlobalCards';
import { CategoryTable } from '../components/financial/CategoryTable';
import { FinancialSkeleton } from '../components/financial/FinancialSkeleton';

export default function FinancialAnalytics() {
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