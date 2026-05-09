// hooks/usePrestashopData.ts
import { useState, useEffect } from 'react';
import { categoryService, type Category } from '../services/categorieApi';
import {manufacturerService, type Manufacturer } from '../services/manufacturer';
import { taxService, type TaxRuleGroup } from '../services/taxApi';

export const CreateProductData = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [taxes, setTaxes] = useState<TaxRuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [cats, mans, taxesData] = await Promise.all([
          categoryService.getAll(),
          manufacturerService.getAll(),
          taxService.getAll()
        ]);
        setCategories(cats);
        setManufacturers(mans);
        setTaxes(taxesData);
      } catch (err) {
        setError('Erreur chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return { categories, manufacturers, taxes, loading, error };
};