import { productService } from './produitApi';
import type { Product } from './produitApi';

// ==========================================
// 1. TYPES - Version pour nouveau CSV
// ==========================================

export interface CsvRow {
  date_availability_produit: string;  // ✅ Nouveau
  nom: string;                         // ✅ Changé (était name)
  reference: string;
  prix_ttc: string;                    // ✅ Changé (était price)
  taxe: string;                        // ✅ Changé (était taxRulesId)
  categorie: string;                   // ✅ Changé (était categories)
  prix_achat: string;                  // ✅ Nouveau
  // Champs optionnels pour compatibilité
  id?: string;
  active?: string;
  quantity?: string;
  description?: string;
  summary?: string;
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
// 2. PARSING CSV - Version pour nouveau CSV
// ==========================================

export function parseCSV(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  // Ignore la ligne d'en-tête (index 0)
  return lines
    .slice(1)
    .map((line) => {
      // Gérer les différents séparateurs (TAB, ; ou ,)
      let cells: string[];
      if (line.includes('\t')) {
        cells = line.split('\t');
      } else if (line.includes(';')) {
        cells = line.split(';');
      } else {
        cells = line.split(',');
      }
      
      return {
        date_availability_produit: cleanCell(cells[0] || ''),
        nom: cleanCell(cells[1] || ''),
        reference: cleanCell(cells[2] || ''),
        prix_ttc: cleanCell(cells[3] || ''),
        taxe: cleanCell(cells[4] || ''),
        categorie: cleanCell(cells[5] || ''),
        prix_achat: cleanCell(cells[6] || ''),
        // Valeurs par défaut
        active: '1',
        quantity: '0',
      };
    })
    .filter((row) => row.nom !== '');
}

function cleanCell(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

// ==========================================
// 3. VALIDATION
// ==========================================

export function validateRow(row: CsvRow, rowIndex: number): string[] {
  const errors: string[] = [];

  if (!row.nom) {
    errors.push(`Ligne ${rowIndex + 2} : le champ "nom" est requis`);
  }

  const price = parseFloat(row.prix_ttc);
  if (row.prix_ttc === '' || isNaN(price) || price < 0) {
    errors.push(`Ligne ${rowIndex + 2} : "prix_ttc" invalide (valeur : "${row.prix_ttc}")`);
  }

  return errors;
}

// ==========================================
// 4. FONCTIONS DE CALCUL
// ==========================================

// Convertir un taux de TVA (ex: "11,65%" ou "5,60%") en nombre
function parseTaxRate(taxRateStr: string): number {
  if (!taxRateStr) return 20;
  
  let cleaned = taxRateStr.trim().replace(/,/g, '.');
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 20;
  
  return parseFloat(match[1]);
}

// Calculer le prix HT à partir du prix TTC et du taux de TVA
function calculatePriceHT(priceTTC: number, taxRate: number): number {
  return priceTTC / (1 + taxRate / 100);
}

// Mapping catégorie vers ID
function getCategoryId(categoryName: string): number {
  const categoryMap: Record<string, number> = {
    'Akanjo': 10,
    'Accessoire': 11,
  };
  return categoryMap[categoryName] || 2;
}

// ==========================================
// 5. MAPPING CSV → Product
// ==========================================

export function mapRowToProduct(row: CsvRow): Partial<Product> {
  // ID catégorie depuis le nom
  const idCategory = getCategoryId(row.categorie);

  // 1. Prix TTC depuis le CSV (convertir virgule en point)
  let priceTTC = 0;
  if (row.prix_ttc) {
    priceTTC = parseFloat(row.prix_ttc.replace(',', '.'));
  }
  
  // 2. Taux de TVA
  const taxRate = parseTaxRate(row.taxe);
  
  // 3. Calculer le prix HT
  const priceHT = calculatePriceHT(priceTTC, taxRate);
  
  // 4. Prix d'achat
  let wholesalePrice = 0;
  if (row.prix_achat) {
    wholesalePrice = parseFloat(row.prix_achat.replace(',', '.'));
  }

  console.log(`📊 ${row.nom}: TTC=${priceTTC}€, TVA=${taxRate}%, HT=${priceHT.toFixed(2)}€`);

  return {
    name: row.nom,
    price: parseFloat(priceHT.toFixed(6)),
    wholesale_price: wholesalePrice,
    reference: row.reference,
    ean13: '',
    description: '',
    description_short: '',
    meta_title: row.nom,
    active: true,
    quantity: parseInt(row.quantity || '0', 10),
    id_category_default: idCategory,
    id_tax_rules_group: 1,
  };
}

// ==========================================
// 6. IMPORT PRODUITS
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
        productName: row.nom || `Ligne ${i + 2}`,
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
        productName: row.nom,
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
        productName: row.nom,
        success: false,
        error: msg,
      });
    }

    onProgress?.(i + 1, total);
  }

  return results;
}

// ==========================================
// 7. UTILITAIRE
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