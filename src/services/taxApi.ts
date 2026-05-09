// services/taxApi.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost/prestashop/api',
  params: { output_format: 'JSON' }, // ← IMPORTANT: retourne du JSON au lieu de XML
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
});

export interface Tax {
  id: number;
  rate: string;
  active: string;
  deleted: string;
  name: Array<{ id: string; value: string }>;
}

export interface TaxRuleGroup {
  id: string;
  name: string;
  rate: number;
  active: boolean;
}

export const taxService = {
  // Récupérer toutes les taxes
  async getAllTaxes(): Promise<TaxRuleGroup[]> {
    try {
      const response = await api.get('/taxes?display=full');
      
      // La réponse est en JSON maintenant
      const data = response.data;
      const taxes = data.taxes || [];
      
      return taxes.map((tax: any) => ({
        id: tax.id?.toString() || '',
        name: tax.name?.[0]?.value || `TVA ${tax.rate}%`,
        rate: parseFloat(tax.rate || '0'),
        active: tax.active === '1'
      }));
    } catch (error) {
      console.error('Erreur chargement taxes:', error);
      // Fallback en cas d'erreur
      return [
        { id: '1', name: 'TVA 20%', rate: 20, active: true },
        { id: '2', name: 'TVA 10%', rate: 10, active: true },
        { id: '3', name: 'TVA 5.5%', rate: 5.5, active: true },
        { id: '4', name: 'TVA 2.1%', rate: 2.1, active: true },
      ];
    }
  },
};