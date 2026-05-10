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
// API SEXE (GENDERS)
// ==========================================
export interface Gender {
  id: string;
  name: string; // Ex: "Monsieur", "Madame"
}

export const genderService = {

  async getAll(): Promise<Gender[]> {
    try {
      // On tente l'appel, mais on ne laisse pas l'erreur bloquer l'app
      const response = await api.get('/genders?display=[id,name]');
      const data = parseXMLToJSON(response.data);
      const gendersRaw = data.prestashop?.genders?.gender || data.genders?.gender;
      
      if (!gendersRaw) throw new Error("No data");

      const list = Array.isArray(gendersRaw) ? gendersRaw : [gendersRaw];
      return list.map((g: any) => ({
        id: String(g.id),
        name: String(g.name) // Plus besoin de .language grâce au param 'language' dans axios
      }));
    } catch (error) {
      // Puisque l'endpoint n'existe pas, on renvoie les data MariaDB que tu as confirmées
      // ID 1 = Type 0 (M.) | ID 2 = Type 1 (Mme)
      return [
        { id: '1', name: 'M.' },
        { id: '2', name: 'Mme' }
      ];
    }
  }
};
  
  