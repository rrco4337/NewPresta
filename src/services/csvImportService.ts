import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { productService } from './produitApi';
import type { Product } from './produitApi';

// ==========================================
// 1. TYPES
// ==========================================

export interface CsvRow {
  id: string;
  active: string;
  name: string;
  categories: string;
  price: string;
  taxRulesId: string;
  wholesalePrice: string;
  reference: string;
  weight: string;
  quantity: string;
  summary: string;
  description: string;
  condition: string;
}

export interface ImportResult {
  rowIndex: number;
  productName: string;
  success: boolean;
  error?: string;
  productId?: string;
}

export interface RowValidation {
  rowIndex: number;
  errors: string[];
  warnings: string[];
}

export type ProgressCallback = (done: number, total: number) => void;

// ==========================================
// 2. PARSING CSV
// ==========================================

// Indices des colonnes dans le CSV PrestaShop (délimiteur ;)
const COL = {
  ID: 0,
  ACTIVE: 1,
  NAME: 2,
  CATEGORIES: 3,
  PRICE: 4,
  TAX_RULES_ID: 5,
  WHOLESALE_PRICE: 6,
  REFERENCE: 12,
  WEIGHT: 22,
  QUANTITY: 25,
  SUMMARY: 33,
  DESCRIPTION: 34,
  CONDITION: 51,
} as const;

function cleanCell(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

export function parseCSV(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  // Ignore la ligne d'en-tête (index 0)
  return lines
    .slice(1)
    .map((line) => {
      const cells = line.split(';');
      return {
        id: cleanCell(cells[COL.ID] ?? ''),
        active: cleanCell(cells[COL.ACTIVE] ?? ''),
        name: cleanCell(cells[COL.NAME] ?? ''),
        categories: cleanCell(cells[COL.CATEGORIES] ?? ''),
        price: cleanCell(cells[COL.PRICE] ?? ''),
        taxRulesId: cleanCell(cells[COL.TAX_RULES_ID] ?? ''),
        wholesalePrice: cleanCell(cells[COL.WHOLESALE_PRICE] ?? ''),
        reference: cleanCell(cells[COL.REFERENCE] ?? ''),
        weight: cleanCell(cells[COL.WEIGHT] ?? ''),
        quantity: cleanCell(cells[COL.QUANTITY] ?? ''),
        summary: cleanCell(cells[COL.SUMMARY] ?? ''),
        description: cleanCell(cells[COL.DESCRIPTION] ?? ''),
        condition: cleanCell(cells[COL.CONDITION] ?? ''),
      } satisfies CsvRow;
    })
    .filter((row) => row.name !== '');
}

// ==========================================
// 3. PRÉ-VALIDATION (ligne par ligne + doublons)
// ==========================================

export function validateRow(row: CsvRow, rowIndex: number): string[] {
  const errors: string[] = [];

  if (!row.name) {
    errors.push(`Le champ "Nom" est requis`);
  }

  const price = parseFloat(row.price);
  if (row.price === '' || isNaN(price)) {
    errors.push(`"Prix HT" invalide (valeur : "${row.price}")`);
  } else if (price < 0) {
    errors.push(`"Prix HT" ne peut pas être négatif (${row.price})`);
  }

  const wholesalePrice = parseFloat(row.wholesalePrice);
  if (row.wholesalePrice !== '' && !isNaN(wholesalePrice) && wholesalePrice < 0) {
    errors.push(`"Prix d'achat" ne peut pas être négatif (${row.wholesalePrice})`);
  }

  const quantity = parseInt(row.quantity, 10);
  if (row.quantity !== '' && !isNaN(quantity) && quantity < 0) {
    errors.push(`"Quantité" ne peut pas être négative (${row.quantity})`);
  }

  const taxRulesId = parseInt(row.taxRulesId, 10);
  if (!row.taxRulesId || Number.isNaN(taxRulesId) || taxRulesId <= 0) {
    errors.push(`"Tax rules ID" invalide (valeur : "${row.taxRulesId}")`);
  }

  return errors;
}

/**
 * Valide toutes les lignes du CSV en une seule passe.
 * Détecte les doublons de référence et les catégories textuelles.
 */
export function validateAllRows(rows: CsvRow[]): RowValidation[] {
  const refMap = new Map<string, number>(); // reference → première ligne (csvLine)
  const validations: RowValidation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const csvLine = i + 2; // +2 car header=1, index 0-based
    const errors = validateRow(row, i);
    const warnings: string[] = [];

    // ── Doublon de référence dans le CSV ──
    if (row.reference) {
      const refKey = row.reference.trim().toLowerCase();
      if (refMap.has(refKey)) {
        errors.push(
          `Référence « ${row.reference} » déjà présente à la ligne ${refMap.get(refKey)}`
        );
      } else {
        refMap.set(refKey, csvLine);
      }
    }

    // ── Catégorie textuelle → warning (sera créée automatiquement) ──
    const firstCategory = row.categories.split(',')[0].trim();
    if (firstCategory && isNaN(parseInt(firstCategory, 10))) {
      warnings.push(
        `La catégorie « ${firstCategory} » sera créée automatiquement`
      );
    }

    validations.push({ rowIndex: i, errors, warnings });
  }

  return validations;
}

// ==========================================
// 4. MAPPING CSV → Product (WebService XML)
// ==========================================

export function mapRowToProduct(row: CsvRow, categoryId?: number): Partial<Product> {
  const firstCategory = row.categories.split(',')[0].trim();
  const parsedCategory = parseInt(firstCategory, 10);
  const idCategory = categoryId ?? (isNaN(parsedCategory) ? 2 : parsedCategory);
  const taxRulesId = parseInt(row.taxRulesId, 10);

  return {
    name: row.name,
    price: parseFloat(row.price) || 0,
    wholesale_price: parseFloat(row.wholesalePrice) || 0,
    reference: row.reference,
    ean13: '',
    description: row.description,
    description_short: row.summary,
    meta_title: row.name,
    active: row.active === '1',
    quantity: parseInt(row.quantity, 10) || 0,
    id_category_default: idCategory,
    id_tax_rules_group: Number.isNaN(taxRulesId) ? 0 : taxRulesId,
  };
}

// ==========================================
// 5. RÉSOLUTION / CRÉATION DE CATÉGORIE
// ==========================================

const categoryApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

const categoryCache = new Map<string, number>();

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

/**
 * Cherche une catégorie par nom. Si elle n'existe pas, la crée.
 * Retourne l'id numérique de la catégorie.
 */
export async function resolveOrCreateCategory(categoryName: string): Promise<number> {
  const key = categoryName.trim().toLowerCase();
  if (categoryCache.has(key)) return categoryCache.get(key)!;

  // Chercher la catégorie existante par nom
  try {
    const res = await categoryApi.get(
      `/categories?display=[id,name]&filter[name]=%[${categoryName}]%`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const categories = doc.querySelectorAll('category');
    for (const cat of categories) {
      const nameEl = cat.querySelector('name language') ?? cat.querySelector('name');
      const idEl = cat.querySelector('id');
      if (nameEl?.textContent?.trim().toLowerCase() === key && idEl?.textContent) {
        const id = parseInt(idEl.textContent.trim(), 10);
        categoryCache.set(key, id);
        return id;
      }
    }
  } catch {
    // API error — on tente quand même la création
  }

  // Créer la catégorie
  const lr = slug(categoryName);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <active><![CDATA[1]]></active>
    <id_parent><![CDATA[2]]></id_parent>
    <name><language id="1"><![CDATA[${categoryName}]]></language></name>
    <description><language id="1"><![CDATA[]]></language></description>
    <link_rewrite><language id="1"><![CDATA[${lr}]]></language></link_rewrite>
    <meta_title><language id="1"><![CDATA[${categoryName}]]></language></meta_title>
    <meta_keywords><language id="1"><![CDATA[]]></language></meta_keywords>
    <meta_description><language id="1"><![CDATA[]]></language></meta_description>
  </category>
</prestashop>`;

  const createRes = await categoryApi.post('/categories', xml);
  const createDoc = new DOMParser().parseFromString(createRes.data, 'text/xml');
  const createdId = parseInt(
    createDoc.querySelector('id')?.textContent?.trim() || '2',
    10
  );
  categoryCache.set(key, createdId);
  return createdId;
}

/** Vide le cache de catégories (utile pour un nouvel import) */
export function clearCategoryCache(): void {
  categoryCache.clear();
}

// ==========================================
// 6. IMPORT PRODUITS — utilise productService.create() (WebService XML /api/products)
// ==========================================

export async function importProducts(
  file: File,
  onProgress?: ProgressCallback
): Promise<ImportResult[]> {
  const content = await file.text();
  const rows = parseCSV(content);
  const results: ImportResult[] = [];
  const total = rows.length;

  // Reset le cache de catégories pour un import frais
  clearCategoryCache();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const validationErrors = validateRow(row, i);
    if (validationErrors.length > 0) {
      results.push({
        rowIndex: i,
        productName: row.name || `Ligne ${i + 2}`,
        success: false,
        error: validationErrors.join(' | '),
      });
      onProgress?.(i + 1, total);
      continue;
    }

    // Résolution de la catégorie (création automatique si textuelle)
    let categoryId: number | undefined;
    const firstCategory = row.categories.split(',')[0].trim();
    if (firstCategory && isNaN(parseInt(firstCategory, 10))) {
      try {
        categoryId = await resolveOrCreateCategory(firstCategory);
      } catch (err: any) {
        results.push({
          rowIndex: i,
          productName: row.name,
          success: false,
          error: `Impossible de créer la catégorie « ${firstCategory} » : ${err.message}`,
        });
        onProgress?.(i + 1, total);
        continue;
      }
    }

    const payload = mapRowToProduct(row, categoryId);

    try {
      const created = await productService.create(payload);
      if (!created) throw new Error('Réponse vide du serveur');

      results.push({
        rowIndex: i,
        productName: row.name,
        success: true,
        productId: created.id,
      });
    } catch (err: any) {
      const msg =
        err.response?.data
          ? extractXmlError(err.response.data)
          : err.message || 'Erreur inconnue';
      results.push({
        rowIndex: i,
        productName: row.name,
        success: false,
        error: msg,
      });
    }

    onProgress?.(i + 1, total);
  }

  return results;
}

// ==========================================
// 7. UTILITAIRE — extrait le message d'erreur PrestaShop depuis le XML
// ==========================================

function extractXmlError(xmlString: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const msgEl = doc.querySelector('message');
    if (msgEl?.textContent) return msgEl.textContent.trim();
    const errorEl = doc.querySelector('error');
    if (errorEl?.textContent) return errorEl.textContent.trim();
  } catch {
    // ignore parse errors
  }
  return typeof xmlString === 'string' ? xmlString.slice(0, 120) : 'Erreur API';
}
