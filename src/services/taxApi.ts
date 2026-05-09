// services/prestashopApi.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  }
});

// Parser XML (réutilisable)
export function parseXMLToJSON(xmlString: string): any {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  function parseNode(node: Element): any {
    if (node.children.length === 0) return node.textContent ?? '';
    const obj: any = {};
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const key = child.nodeName;
      const value = parseNode(child);
      if (obj[key] !== undefined) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }

  return parseNode(xmlDoc.documentElement);
}

// ==========================================
// API TAXES
// ==========================================
export interface TaxRuleGroup {
  id: string;
  name: string;
  rate: number;
}

export const taxService = {
  async getAll(): Promise<TaxRuleGroup[]> {
    try {
      const response = await api.get('/tax_rule_groups?display=full');
      const xmlData = parseXMLToJSON(response.data);
      const taxes = xmlData.prestashop?.tax_rule_groups?.tax_rule_group || xmlData.tax_rule_groups?.tax_rule_group;
      if (!taxes) return [{ id: '1', name: 'TVA 20%', rate: 20 }];
      const list = Array.isArray(taxes) ? taxes : [taxes];
      return list.map((tax: any) => ({
        id: tax.id?.toString() || '',
        name: tax.name?.language?._cdata || tax.name?.language || '',
        rate: 20 // À extraire correctement si possible
      }));
    } catch (error) {
      console.error('Erreur chargement taxes:', error);
      return [{ id: '1', name: 'TVA 20%', rate: 20 }];
    }
  }
};