// services/prestashopApi.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
   params: {
    language: '1', // Force le Français (ID 1) pour tous les appels
  },
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
// API GROUPES DE CLIENTS (CUSTOMER GROUPS)
// ==========================================
export interface CustomerGroup {
  id: string;
  name: string; // Ex: "Client", "Visiteur"
}

export const customerGroupService = {

  async getAll(): Promise<CustomerGroup[]> {
    try {
      const response = await api.get('/groups?display=[id,name]');
      const data = parseXMLToJSON(response.data);
      const groupsRaw = data.groups?.group || data.prestashop?.groups?.group;
      if (!groupsRaw) return [];
      const list = Array.isArray(groupsRaw) ? groupsRaw : [groupsRaw];
      return list.map((g: any) => ({
        id: String(g.id),
        name: typeof g.name === 'object' ? g.name.language : g.name
      }));
    } catch (error) {
      console.error('Erreur groups:', error);
      return [];
    }
  }
};
  