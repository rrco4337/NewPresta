// hooks/useTaxes.ts
import { useState, useEffect } from 'react';
import { taxService, type TaxRuleGroup } from '../services/taxApi';

export const useTaxes = () => {
  const [taxGroups, setTaxGroups] = useState<TaxRuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTaxes = async () => {
      try {
        setLoading(true);
        const taxes = await taxService.getAllTaxes();
        console.log('✅ Taxes chargées:', taxes);
        setTaxGroups(taxes);
      } catch (err) {
        console.error('❌ Erreur chargement taxes:', err);
        setError('Erreur chargement des taxes');
      } finally {
        setLoading(false);
      }
    };
    loadTaxes();
  }, []);

  const getTaxRate = (groupId: string): number => {
    const group = taxGroups.find(g => g.id === groupId);
    return group?.rate || 20;
  };

  return { taxGroups, loading, error, getTaxRate };
};