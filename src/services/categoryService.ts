// src/services/categoryService.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ==========================================
// 1. TYPES
// ==========================================
export interface Category {
  id: number;
  name: string;
}

// ==========================================
// 2. CONFIGURATION AXIOS (identique à produitApi)
// ==========================================
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  }
});

// ==========================================
// 3. HELPERS (copiés depuis produitApi)
// ==========================================
function parseXMLToJSON(xmlString: string): unknown {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  function parseNode(node: Element): unknown {
    if (node.children.length === 0) return node.textContent || "";
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const nodeName = child.nodeName;
      const value = parseNode(child);
      if (obj[nodeName]) {
        const current = obj[nodeName];
        if (!Array.isArray(current)) obj[nodeName] = [current];
        (obj[nodeName] as unknown[]).push(value);
      } else {
        obj[nodeName] = value;
      }
    }
    return obj;
  }
  return parseNode(xmlDoc.documentElement);
}

function getPrestashopRoot(xmlData: unknown): Record<string, unknown> | null {
  if (typeof xmlData !== 'object' || xmlData === null) return null;
  const root = (xmlData as any).prestashop ?? xmlData;
  return typeof root === 'object' && root !== null ? root as Record<string, unknown> : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extrait le texte d'une balise multilingue (type <name><language id="1">Nom</language></name>)
 * On prend la première langue trouvée ou celle dont l'id correspond à la langue par défaut (1).
 */
function extractLanguageField(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  let langValue = '';
  if (field.language) {
    const languages = Array.isArray(field.language) ? field.language : [field.language];
    // Cherche la langue id="1" par défaut
    const defaultLang = languages.find((l: any) => l.id === '1');
    if (defaultLang) {
      langValue = defaultLang._cdata || defaultLang._text || '';
    } else if (languages.length > 0) {
      // Sinon, prend la première
      langValue = languages[0]._cdata || languages[0]._text || '';
    }
  }
  return langValue;
}

// ==========================================
// 4. SERVICE CATÉGORIES
// ==========================================
export const categoryService = {
  /**
   * Récupère toutes les catégories avec leur nom.
   * @returns Promise<Category[]> - tableau des catégories { id, name }
   */
  getAllCategories: async (): Promise<Category[]> => {
    try {
      const response = await api.get('/categories', {
        params: { display: 'full' }
      });
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const categoriesContainer = root?.categories;
      if (!isRecord(categoriesContainer)) return [];
      let rawCategories = categoriesContainer.category;
      if (!rawCategories) return [];
      const categoriesArray = Array.isArray(rawCategories) ? rawCategories : [rawCategories];
      return categoriesArray
        .filter(isRecord)
        .map((cat: any) => {
          const id = parseInt(cat.id, 10);
          const name = extractLanguageField(cat.name);
          return { id, name };
        })
        .filter(cat => !isNaN(cat.id) && cat.name !== '');
    } catch (error) {
      console.error("Erreur getAllCategories:", error);
      return [];
    }
  },

  /**
   * Récupère une catégorie spécifique par son ID.
   */
  getCategory: async (id: number): Promise<Category | null> => {
    try {
      const response = await api.get(`/categories/${id}`, {
        params: { display: 'full' }
      });
      const xmlData = parseXMLToJSON(response.data);
      const root = getPrestashopRoot(xmlData);
      const rawCat = root?.category;
      if (!isRecord(rawCat)) return null;
      const name = extractLanguageField(rawCat.name);
      return { id, name };
    } catch (error) {
      console.error(`Erreur getCategory(${id}):`, error);
      return null;
    }
  }
};