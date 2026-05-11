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
// 3. VALIDATION
// ==========================================

export function validateRow(row: CsvRow, rowIndex: number): string[] {
  const errors: string[] = [];

  if (!row.name) {
    errors.push(`Ligne ${rowIndex + 2} : le champ "Name" est requis`);
  }

  const price = parseFloat(row.price);
  if (row.price === '' || isNaN(price) || price < 0) {
    errors.push(`Ligne ${rowIndex + 2} : "Price" invalide (valeur : "${row.price}")`);
  }

  const taxRulesId = parseInt(row.taxRulesId, 10);
  if (!row.taxRulesId || Number.isNaN(taxRulesId) || taxRulesId <= 0) {
    errors.push(`Ligne ${rowIndex + 2} : "Tax rules ID" invalide (valeur : "${row.taxRulesId}")`);
  }

  return errors;
}

// ==========================================
// 4. MAPPING CSV → Product (WebService XML)
// ==========================================

export function mapRowToProduct(row: CsvRow): Partial<Product> {
  // id_category_default : tente la 1ère valeur numérique, sinon 2 (défaut PS)
  const firstCategory = row.categories.split(',')[0].trim();
  const parsedCategory = parseInt(firstCategory, 10);
  const idCategory = isNaN(parsedCategory) ? 2 : parsedCategory;
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
// 5. IMPORT PRODUITS — utilise productService.create() (WebService XML /api/products)
// ==========================================

export async function importProducts(
  file: File,
  onProgress?: ProgressCallback
): Promise<ImportResult[]> {
  const content = await file.text();
  const rows = parseCSV(content);
  const results: ImportResult[] = [];
  const total = rows.length;

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

    const payload = mapRowToProduct(row);

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
// 6. UTILITAIRE — extrait le message d'erreur PrestaShop depuis le XML
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
