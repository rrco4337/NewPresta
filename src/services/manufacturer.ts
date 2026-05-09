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
// API MARQUES (MANUFACTURERS)
// ==========================================
export interface Manufacturer {
  id: string;
  name: string;
  active: string;
}

export const manufacturerService = {

  async getAll(): Promise<Manufacturer[]> {
    try {
      const response = await api.get('/manufacturers?display=full');
      const xmlData = parseXMLToJSON(response.data);
      const manufacturers = xmlData.prestashop?.manufacturers?.manufacturer || xmlData.manufacturers?.manufacturer;
      if (!manufacturers) return [];
      const list = Array.isArray(manufacturers) ? manufacturers : [manufacturers];
      return list.map((man: any) => ({
        id: man.id?.toString() || '',
        name: man.name?.toString() || '',
        active: man.active || '1'
      }));
    } catch (error) {
      console.error('Erreur chargement marques:', error);
      return [];
    }
  }
};
  