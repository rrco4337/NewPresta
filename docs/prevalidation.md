# Walkthrough — Pré-validation CSV Import

## Changements effectués

### [csvImportService.ts](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/csvImportService.ts)

- **Nouveau type [RowValidation](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/csvImportService.ts#34-39)** : `{ rowIndex, errors[], warnings[] }`
- **[validateAllRows(rows)](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/csvImportService.ts#129-168)** : validation complète en une passe
  - Doublons de référence détectés (erreur sur la 2ème occurrence)
  - Valeurs négatives interdites sur `price`, `wholesalePrice`, `quantity`
  - Nom et Tax Rules ID obligatoires
  - Catégories textuelles → warning (pas bloquant)
- **[resolveOrCreateCategory(name)](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/csvImportService.ts#214-267)** : cherche via `GET /categories?filter[name]`, crée si absente, avec cache `Map<string, number>`
- **[importProducts()](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/csvImportService.ts#277-352)** enrichi : résout les catégories textuelles avant création du produit

```diff:csvImportService.ts
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
===
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

```

---

### [ProductImport.tsx](file:///Users/apple/Documents/L3/S6/prestashop-app/src/components/ProductImport.tsx)

- Affiche **toutes les lignes** du CSV (pas seulement les 5 premières)
- Tableau scrollable (max 480px) avec headers sticky
- Chaque ligne a un badge **OK** / **Alerte** / **Erreur**
- Ligne d'erreurs/warnings affichée en dessous de chaque ligne problématique
- **Chips résumé** en haut : `X valides`, `Y avertissements`, `Z erreurs`
- **Bannière bloquante** rouge si erreurs + bouton import grisé et désactivé

```diff:ProductImport.tsx
import React, { useRef, useState } from 'react';
import { parseCSV, importProducts } from '../services/csvImportService';
import type { CsvRow, ImportResult } from '../services/csvImportService';
import { cleanProducts } from '../services/otherImportService';
import type { CleanResult } from '../services/otherImportService';
import './ProductImport.css';

// ── États de la page ──────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'importing' | 'done';

const ProductImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragOver, setDragOver] = useState(false);

  type CleanStatus = 'idle' | 'running' | 'done';
  const [cleanStatus,   setCleanStatus]   = useState<CleanStatus>('idle');
  const [cleanProgress, setCleanProgress] = useState({ done: 0, total: 0 });
  const [cleanResult,   setCleanResult]   = useState<CleanResult | null>(null);

  // ── Sélection / drag-drop du fichier ─────────────────────────────────────
  function handleFile(selectedFile: File) {
    if (!selectedFile.name.endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier .csv');
      return;
    }

    setFile(selectedFile);

    selectedFile.text().then((content) => {
      const rows = parseCSV(content);
      setPreviewRows(rows.slice(0, 5));
      setStep('preview');
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  // ── Lancement de l'import ─────────────────────────────────────────────────
  async function handleImport() {
    if (!file) return;
    setStep('importing');
    setResults([]);
    setProgress({ done: 0, total: 0 });

    const importResults = await importProducts(file, (done, total) => {
      setProgress({ done, total });
    });

    setResults(importResults);
    setStep('done');
  }

  // ── Nettoyage produits ────────────────────────────────────────────────────
  async function handleCleanProducts() {
    const confirmed = window.confirm(
      'Supprimer TOUS les produits de la base de données ?\n\nCette action est irréversible.'
    );
    if (!confirmed) return;
    setCleanStatus('running');
    setCleanProgress({ done: 0, total: 0 });
    setCleanResult(null);
    try {
      const result = await cleanProducts((done, total) => setCleanProgress({ done, total }));
      setCleanResult(result);
    } catch {
      setCleanResult({ total: 0, deleted: 0, errors: 1 });
    }
    setCleanStatus('done');
  }

  // ── Réinitialisation ──────────────────────────────────────────────────────
  function handleReset() {
    setFile(null);
    setPreviewRows([]);
    setProgress({ done: 0, total: 0 });
    setResults([]);
    setStep('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Stats du rapport ──────────────────────────────────────────────────────
  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="import-page">

      {/* ── ZONE DE DÉPÔT ── */}
      {(step === 'idle' || step === 'preview') && (
        <div
          className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="import-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
          </svg>
          {file ? (
            <p className="import-dropzone-text">
              <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} Ko
            </p>
          ) : (
            <>
              <p className="import-dropzone-text">Glissez votre fichier CSV ici</p>
              <p className="import-dropzone-sub">ou cliquez pour parcourir</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="import-file-input"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* ── PRÉVISUALISATION ── */}
      {step === 'preview' && previewRows.length > 0 && (
        <div className="import-preview">
          <h2 className="import-section-title">
            Aperçu — 5 premières lignes
          </h2>
          <div className="import-table-wrapper">
            <table className="import-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prix HT</th>
                  <th>Prix achat</th>
                  <th>Référence</th>
                  <th>Qté</th>
                  <th>Condition</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.name}</td>
                    <td>{row.price}</td>
                    <td>{row.wholesalePrice}</td>
                    <td>{row.reference}</td>
                    <td>{row.quantity}</td>
                    <td>{row.condition}</td>
                    <td>
                      <span className={`import-badge ${row.active === '1' ? 'import-badge--success' : 'import-badge--muted'}`}>
                        {row.active === '1' ? 'Oui' : 'Non'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Changer de fichier
            </button>
            <button className="btn btn-primary" onClick={handleImport}>
              Lancer l'import
            </button>
          </div>
        </div>
      )}

      {/* ── PROGRESSION ── */}
      {step === 'importing' && (
        <div className="import-progress-block">
          <p className="import-progress-label">
            Import en cours… {progress.done} / {progress.total}
          </p>
          <div className="import-progress-bar">
            <div
              className="import-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="import-progress-pct">{progressPercent}%</p>
        </div>
      )}

      {/* ── RAPPORT ── */}
      {step === 'done' && (
        <div className="import-report">
          <div className="import-stats">
            <div className="import-stat import-stat--success">
              <span className="import-stat-value">{successCount}</span>
              <span className="import-stat-label">Importé{successCount > 1 ? 's' : ''} avec succès</span>
            </div>
            <div className="import-stat import-stat--error">
              <span className="import-stat-value">{errorCount}</span>
              <span className="import-stat-label">Erreur{errorCount > 1 ? 's' : ''}</span>
            </div>
            <div className="import-stat import-stat--total">
              <span className="import-stat-value">{results.length}</span>
              <span className="import-stat-label">Total traité{results.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <h2 className="import-section-title">Détail ligne par ligne</h2>
          <div className="import-table-wrapper">
            <table className="import-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowIndex} className={r.success ? 'import-row--success' : 'import-row--error'}>
                    <td>{r.rowIndex + 2}</td>
                    <td>{r.productName}</td>
                    <td>
                      <span className={`import-badge ${r.success ? 'import-badge--success' : 'import-badge--error'}`}>
                        {r.success ? 'OK' : 'Erreur'}
                      </span>
                    </td>
                    <td className="import-detail">
                      {r.success
                        ? r.productId
                          ? `Créé (ID ${r.productId})`
                          : 'Créé'
                        : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Nouvel import
            </button>
          </div>
        </div>
      )}

      {/* ── ZONE DE NETTOYAGE PRODUITS ── */}
      <div className="import-danger-zone">
        <div className="import-danger-header">
          <span className="import-danger-title">Zone de nettoyage — Produits</span>
          <span className="import-danger-warning">
            Supprime <strong>tous les produits</strong> de la base via l'API PrestaShop.
            Cette action est irréversible.
          </span>
        </div>

        {cleanStatus === 'idle' && (
          <button className="btn btn-danger" onClick={handleCleanProducts}>
            Nettoyer les produits
          </button>
        )}

        {cleanStatus === 'running' && (
          <div className="import-progress-block" style={{ padding: '20px' }}>
            <p className="import-progress-label">
              Suppression… {cleanProgress.done} / {cleanProgress.total}
            </p>
            <div className="import-progress-bar">
              <div
                className="import-progress-fill"
                style={{
                  width: cleanProgress.total > 0
                    ? `${Math.round((cleanProgress.done / cleanProgress.total) * 100)}%`
                    : '0%',
                  background: '#ef4444',
                }}
              />
            </div>
          </div>
        )}

        {cleanStatus === 'done' && cleanResult && (
          <div className="import-clean-result">
            <span className="import-clean-ok">{cleanResult.deleted} supprimé{cleanResult.deleted > 1 ? 's' : ''}</span>
            {cleanResult.errors > 0 && (
              <span className="import-clean-err">{cleanResult.errors} erreur{cleanResult.errors > 1 ? 's' : ''}</span>
            )}
            <button className="btn btn-secondary" style={{ marginLeft: 'auto' }}
              onClick={() => { setCleanStatus('idle'); setCleanResult(null); }}>
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImport;
===
import React, { useRef, useState } from 'react';
import { parseCSV, validateAllRows, importProducts } from '../services/csvImportService';
import type { CsvRow, ImportResult, RowValidation } from '../services/csvImportService';
import { cleanProducts } from '../services/otherImportService';
import type { CleanResult } from '../services/otherImportService';
import './ProductImport.css';

// ── États de la page ──────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'importing' | 'done';

const ProductImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragOver, setDragOver] = useState(false);

  type CleanStatus = 'idle' | 'running' | 'done';
  const [cleanStatus,   setCleanStatus]   = useState<CleanStatus>('idle');
  const [cleanProgress, setCleanProgress] = useState({ done: 0, total: 0 });
  const [cleanResult,   setCleanResult]   = useState<CleanResult | null>(null);

  // ── Sélection / drag-drop du fichier ─────────────────────────────────────
  function handleFile(selectedFile: File) {
    if (!selectedFile.name.endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier .csv');
      return;
    }

    setFile(selectedFile);

    selectedFile.text().then((content) => {
      const rows = parseCSV(content);
      setAllRows(rows);
      const vals = validateAllRows(rows);
      setValidations(vals);
      setStep('preview');
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  // ── Lancement de l'import ─────────────────────────────────────────────────
  async function handleImport() {
    if (!file) return;
    setStep('importing');
    setResults([]);
    setProgress({ done: 0, total: 0 });

    const importResults = await importProducts(file, (done, total) => {
      setProgress({ done, total });
    });

    setResults(importResults);
    setStep('done');
  }

  // ── Nettoyage produits ────────────────────────────────────────────────────
  async function handleCleanProducts() {
    const confirmed = window.confirm(
      'Supprimer TOUS les produits de la base de données ?\n\nCette action est irréversible.'
    );
    if (!confirmed) return;
    setCleanStatus('running');
    setCleanProgress({ done: 0, total: 0 });
    setCleanResult(null);
    try {
      const result = await cleanProducts((done, total) => setCleanProgress({ done, total }));
      setCleanResult(result);
    } catch {
      setCleanResult({ total: 0, deleted: 0, errors: 1 });
    }
    setCleanStatus('done');
  }

  // ── Réinitialisation ──────────────────────────────────────────────────────
  function handleReset() {
    setFile(null);
    setAllRows([]);
    setValidations([]);
    setProgress({ done: 0, total: 0 });
    setResults([]);
    setStep('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Stats de validation ───────────────────────────────────────────────────
  const errorCount = validations.filter((v) => v.errors.length > 0).length;
  const warningCount = validations.filter((v) => v.warnings.length > 0 && v.errors.length === 0).length;
  const validCount = validations.filter((v) => v.errors.length === 0).length;
  const hasBlockingErrors = errorCount > 0;

  // ── Stats du rapport ──────────────────────────────────────────────────────
  const reportSuccess = results.filter((r) => r.success).length;
  const reportErrors = results.filter((r) => !r.success).length;
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="import-page">

      {/* ── ZONE DE DÉPÔT ── */}
      {(step === 'idle' || step === 'preview') && (
        <div
          className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="import-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
          </svg>
          {file ? (
            <p className="import-dropzone-text">
              <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} Ko
            </p>
          ) : (
            <>
              <p className="import-dropzone-text">Glissez votre fichier CSV ici</p>
              <p className="import-dropzone-sub">ou cliquez pour parcourir</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="import-file-input"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* ── PRÉVISUALISATION AVEC VALIDATION ── */}
      {step === 'preview' && allRows.length > 0 && (
        <div className="import-preview">
          <h2 className="import-section-title">
            Pré-validation — {allRows.length} ligne{allRows.length > 1 ? 's' : ''} détectée{allRows.length > 1 ? 's' : ''}
          </h2>

          {/* Résumé de validation */}
          <div className="import-validation-summary">
            <div className="import-validation-chip import-validation-chip--valid">
              <span className="import-validation-chip-icon">✓</span>
              <span>{validCount} valide{validCount > 1 ? 's' : ''}</span>
            </div>
            {warningCount > 0 && (
              <div className="import-validation-chip import-validation-chip--warning">
                <span className="import-validation-chip-icon">⚠</span>
                <span>{warningCount} avertissement{warningCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="import-validation-chip import-validation-chip--error">
                <span className="import-validation-chip-icon">✕</span>
                <span>{errorCount} erreur{errorCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {hasBlockingErrors && (
            <div className="import-blocking-banner">
              Corrigez les erreurs dans le fichier CSV avant de lancer l'import.
            </div>
          )}

          {/* Tableau complet avec erreurs ligne par ligne */}
          <div className="import-table-wrapper" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table className="import-table">
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Statut</th>
                  <th>Nom</th>
                  <th>Référence</th>
                  <th>Prix HT</th>
                  <th>Prix achat</th>
                  <th>Qté</th>
                  <th>Catégorie</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => {
                  const v = validations[i];
                  const hasErrors = v && v.errors.length > 0;
                  const hasWarnings = v && v.warnings.length > 0 && !hasErrors;
                  const rowClass = hasErrors
                    ? 'import-row--error'
                    : hasWarnings
                      ? 'import-row--warning'
                      : 'import-row--valid';

                  return (
                    <React.Fragment key={i}>
                      <tr className={rowClass}>
                        <td>{i + 2}</td>
                        <td>
                          {hasErrors && (
                            <span className="import-badge import-badge--error">Erreur</span>
                          )}
                          {hasWarnings && (
                            <span className="import-badge import-badge--warning">Alerte</span>
                          )}
                          {!hasErrors && !hasWarnings && (
                            <span className="import-badge import-badge--success">OK</span>
                          )}
                        </td>
                        <td>{row.name}</td>
                        <td><code>{row.reference || '—'}</code></td>
                        <td>{row.price}</td>
                        <td>{row.wholesalePrice || '—'}</td>
                        <td>{row.quantity || '0'}</td>
                        <td>{row.categories || '—'}</td>
                        <td>
                          <span className={`import-badge ${row.active === '1' ? 'import-badge--success' : 'import-badge--muted'}`}>
                            {row.active === '1' ? 'Oui' : 'Non'}
                          </span>
                        </td>
                      </tr>
                      {/* Ligne d'erreurs/warnings en dessous */}
                      {v && (v.errors.length > 0 || v.warnings.length > 0) && (
                        <tr className={`${rowClass} import-detail-row`}>
                          <td></td>
                          <td colSpan={8}>
                            <ul className="import-error-list">
                              {v.errors.map((err, j) => (
                                <li key={`e-${j}`} className="import-error-item">
                                  <span className="import-error-icon">✕</span> {err}
                                </li>
                              ))}
                              {v.warnings.map((warn, j) => (
                                <li key={`w-${j}`} className="import-warning-item">
                                  <span className="import-warning-icon">⚠</span> {warn}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Changer de fichier
            </button>
            <button
              className={`btn btn-primary${hasBlockingErrors ? ' btn--disabled' : ''}`}
              onClick={handleImport}
              disabled={hasBlockingErrors}
              title={hasBlockingErrors ? 'Corrigez les erreurs avant de lancer l\'import' : ''}
            >
              Lancer l'import
            </button>
          </div>
        </div>
      )}

      {/* ── PROGRESSION ── */}
      {step === 'importing' && (
        <div className="import-progress-block">
          <p className="import-progress-label">
            Import en cours… {progress.done} / {progress.total}
          </p>
          <div className="import-progress-bar">
            <div
              className="import-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="import-progress-pct">{progressPercent}%</p>
        </div>
      )}

      {/* ── RAPPORT ── */}
      {step === 'done' && (
        <div className="import-report">
          <div className="import-stats">
            <div className="import-stat import-stat--success">
              <span className="import-stat-value">{reportSuccess}</span>
              <span className="import-stat-label">Importé{reportSuccess > 1 ? 's' : ''} avec succès</span>
            </div>
            <div className="import-stat import-stat--error">
              <span className="import-stat-value">{reportErrors}</span>
              <span className="import-stat-label">Erreur{reportErrors > 1 ? 's' : ''}</span>
            </div>
            <div className="import-stat import-stat--total">
              <span className="import-stat-value">{results.length}</span>
              <span className="import-stat-label">Total traité{results.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <h2 className="import-section-title">Détail ligne par ligne</h2>
          <div className="import-table-wrapper">
            <table className="import-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowIndex} className={r.success ? 'import-row--success' : 'import-row--error'}>
                    <td>{r.rowIndex + 2}</td>
                    <td>{r.productName}</td>
                    <td>
                      <span className={`import-badge ${r.success ? 'import-badge--success' : 'import-badge--error'}`}>
                        {r.success ? 'OK' : 'Erreur'}
                      </span>
                    </td>
                    <td className="import-detail">
                      {r.success
                        ? r.productId
                          ? `Créé (ID ${r.productId})`
                          : 'Créé'
                        : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Nouvel import
            </button>
          </div>
        </div>
      )}

      {/* ── ZONE DE NETTOYAGE PRODUITS ── */}
      <div className="import-danger-zone">
        <div className="import-danger-header">
          <span className="import-danger-title">Zone de nettoyage — Produits</span>
          <span className="import-danger-warning">
            Supprime <strong>tous les produits</strong> de la base via l'API PrestaShop.
            Cette action est irréversible.
          </span>
        </div>

        {cleanStatus === 'idle' && (
          <button className="btn btn-danger" onClick={handleCleanProducts}>
            Nettoyer les produits
          </button>
        )}

        {cleanStatus === 'running' && (
          <div className="import-progress-block" style={{ padding: '20px' }}>
            <p className="import-progress-label">
              Suppression… {cleanProgress.done} / {cleanProgress.total}
            </p>
            <div className="import-progress-bar">
              <div
                className="import-progress-fill"
                style={{
                  width: cleanProgress.total > 0
                    ? `${Math.round((cleanProgress.done / cleanProgress.total) * 100)}%`
                    : '0%',
                  background: '#ef4444',
                }}
              />
            </div>
          </div>
        )}

        {cleanStatus === 'done' && cleanResult && (
          <div className="import-clean-result">
            <span className="import-clean-ok">{cleanResult.deleted} supprimé{cleanResult.deleted > 1 ? 's' : ''}</span>
            {cleanResult.errors > 0 && (
              <span className="import-clean-err">{cleanResult.errors} erreur{cleanResult.errors > 1 ? 's' : ''}</span>
            )}
            <button className="btn btn-secondary" style={{ marginLeft: 'auto' }}
              onClick={() => { setCleanStatus('idle'); setCleanResult(null); }}>
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImport;

```

---

### [ProductImport.css](file:///Users/apple/Documents/L3/S6/prestashop-app/src/components/ProductImport.css)

- `.import-validation-summary` + `.import-validation-chip--*` (chips résumé)
- `.import-blocking-banner` (bandeau d'erreur bloquant)
- `.import-row--warning` (fond orange clair)
- `.import-error-list` / `.import-error-item` / `.import-warning-item` (erreurs inline)
- `.import-badge--warning` (badge orange)
- `.btn--disabled` (bouton grisé)
- Headers sticky dans le tableau scrollable

---

## Vérification

| Test | Résultat |
|------|----------|
| `npx tsc --noEmit` | ✅ Aucune erreur TypeScript |
