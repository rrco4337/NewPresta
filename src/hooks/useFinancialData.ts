import { useState, useEffect } from 'react';
import { financialService } from '../services/financialService';

export function useFinancialData(selectedCategoryId?: number | null) {
  const [global, setGlobal] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    financialService.getFinancialData()
      .then(data => {
        setGlobal(data.global);
        setCategories(data.byCategory);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredCategories = selectedCategoryId
    ? categories.filter(cat => cat.categoryId === selectedCategoryId)
    : categories;

  return { global, categories: filteredCategories, loading, error, refetch: () => {} };
}