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
// API CATÉGORIES
// ==========================================
export interface Category {
  id: string;
  name: string;
  active: string;
}

export const categoryService = {
  async getAll(): Promise<Category[]> {
    try {
      const response = await api.get('/categories?display=full');
      const xmlData = parseXMLToJSON(response.data);
      const categories = xmlData.prestashop?.categories?.category || xmlData.categories?.category;
      if (!categories) return [];
      const list = Array.isArray(categories) ? categories : [categories];
      return list.map((cat: any) => ({
        id: cat.id?.toString() || '',
        name: cat.name?.language?._cdata || cat.name?.language || '',
        active: cat.active || '1'
      }));
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      return [];
    }
  },

  async getById(id: string): Promise<Category | null> {
    try {
      const response = await api.get(`/categories/${id}`);
      const xmlData = parseXMLToJSON(response.data);
      const cat = xmlData.prestashop?.category || xmlData.category;
      if (!cat) return null;
      return {
        id: cat.id?.toString() || '',
        name: cat.name?.language?._cdata || cat.name?.language || '',
        active: cat.active || '1'
      };
    } catch (error) {
      console.error(`Erreur chargement catégorie ${id}:`, error);
      return null;
    }
  }
};