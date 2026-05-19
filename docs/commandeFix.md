# Walkthrough — Migration commandes localStorage → PrestaShop API

## Résumé

Les commandes créées par Fichier 3 passaient déjà par l'API PrestaShop (`POST /carts` → `POST /orders`) mais étaient **dupliquées en localStorage**. Cette migration supprime entièrement la couche locale et utilise `POST /order_histories` pour appliquer le statut correct.

## Changements

### [fichierImportService.ts](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/fichierImportService.ts)

- Supprimé `import { addLocalOrders }` et `LocalOrder`/`LocalOrderStatus`
- Remplacé `mapEtatToStatus()` → [mapEtatToPSState()](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/fichierImportService.ts#571-578) retournant des IDs PS (2=payé, 8=échec, 6=annulé)
- Après [createPSOrder()](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/customerService.ts#214-311), appelle `POST /order_histories` pour appliquer le statut
- Supprimé la construction de `LocalOrder` et `addLocalOrders(newOrders)`

```diff:fichierImportService.ts
import axios from 'axios';
import JSZip from 'jszip';
import { addLocalOrders } from './orderService';
import type { LocalOrder, LocalOrderStatus } from './orderService';
import {
  findCustomerByEmail,
  createAddress,
  createPSCart,
  createPSOrder,
  updateStockAfterOrder,
  type CheckoutItem,
} from './customerService';
import { ensureTaxRulesGroupIdByRate, getTaxRateByGroup } from './taxService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ==========================================
// UTILITAIRES CSV
// ==========================================

/** Parser CSV générique : gère les champs entre guillemets et les virgules internes */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvContent(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map(parseCsvLine);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function resolveFichier1Columns(header: string[]) {
  const lower = header.map(normalizeHeader);
  const hasDate = lower.includes('date_produit');
  const fallback = hasDate
    ? { date: 0, nom: 1, reference: 2, prixTtc: 3, taxe: 4, categorie: 5, prixAchat: 6 }
    : { date: -1, nom: 0, reference: 1, prixTtc: 2, taxe: 3, categorie: 4, prixAchat: 5 };

  const findIdx = (names: string[], fallbackIdx: number) => {
    for (const name of names) {
      const idx = lower.indexOf(name);
      if (idx >= 0) return idx;
    }
    return fallbackIdx;
  };

  return {
    dateIdx: findIdx(['date_produit', 'date produit', 'date','date_availability_produit'], fallback.date),
    nomIdx: findIdx(['nom', 'name'], fallback.nom),
    referenceIdx: findIdx(['reference', 'référence', 'ref'], fallback.reference),
    prixTtcIdx: findIdx(['prix_ttc', 'prix ttc', 'price_ttc'], fallback.prixTtc),
    taxeIdx: findIdx(['taxe', 'taux_tva', 'tva', 'tax'], fallback.taxe),
    categorieIdx: findIdx(['categorie', 'catégorie', 'category'], fallback.categorie),
    prixAchatIdx: findIdx(['prix_achat', 'prix achat', 'wholesale_price'], fallback.prixAchat),
  };
}

function parseFrenchNumber(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

function parseNumberStrict(raw: string): number | null {
  const cleaned = raw.trim().replace('%', '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

function normalizeYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function buildDate(year: number, month: number, day: number, h = 0, m = 0, s = 0): Date | null {
  const y = normalizeYear(year);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(y, month - 1, day, h, m, s);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function parseDateFlexible(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct);

  const ymd = value.match(/^([12]\d{3})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (ymd) {
    const [, y, mo, d, hh, mm, ss] = ymd;
    return buildDate(
      parseInt(y, 10),
      parseInt(mo, 10),
      parseInt(d, 10),
      parseInt(hh ?? '0', 10),
      parseInt(mm ?? '0', 10),
      parseInt(ss ?? '0', 10),
    );
  }

  const dmy = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (dmy) {
    const [, p1, p2, y, hh, mm, ss] = dmy;
    const a = parseInt(p1, 10);
    const b = parseInt(p2, 10);
    const year = parseInt(y, 10);
    let day = a;
    let month = b;
    if (a <= 12 && b <= 12) {
      day = a; // format fr par defaut
      month = b;
    } else if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    }
    return buildDate(
      year,
      month,
      day,
      parseInt(hh ?? '0', 10),
      parseInt(mm ?? '0', 10),
      parseInt(ss ?? '0', 10),
    );
  }

  return null;
}

function parseTaxRate(s: string): number {
  return parseFrenchNumber(s.replace('%', '')) / 100;
}

function ttcToHt(ttc: number, taxRate: number): number {
  if (taxRate <= 0) return ttc;
  return ttc / (1 + taxRate);
}

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function buildCombinationReference(reference: string, variant: string): string {
  const suffix = slugify(variant);
  return suffix ? `${reference}-${suffix}` : reference;
}

function extractXmlError(xml: string): string {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return doc.querySelector('message')?.textContent?.trim()
        ?? doc.querySelector('error')?.textContent?.trim()
        ?? xml.slice(0, 100);
  } catch { return 'Erreur API'; }
}

function getCreatedId(xml: string): string | null {
  try {
    return new DOMParser().parseFromString(xml, 'text/xml')
      .querySelector('id')?.textContent?.trim() ?? null;
  } catch { return null; }
}

async function postXml(endpoint: string, xml: string): Promise<string> {
  const res = await api.post(endpoint, xml);
  return getCreatedId(res.data) ?? '?';
}

async function fetchProductByReference(reference: string): Promise<{
  id: string;
  name: string;
  priceHt: number;
  taxRulesGroupId: number;
} | null> {
  try {
    const res = await api.get(
      `/products?display=[id,name,reference,price,id_tax_rules_group]&filter[reference]=[${reference}]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const el = doc.querySelector('product');
    if (!el) return null;
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const name = el.querySelector('name > language')?.textContent?.trim()
      ?? el.querySelector('name')?.textContent?.trim()
      ?? reference;
    const priceHt = parseFloat(el.querySelector('price')?.textContent ?? '0');
    const taxRulesGroupId = parseInt(el.querySelector('id_tax_rules_group')?.textContent ?? '0', 10);
    if (!id) return null;
    return { id, name, priceHt, taxRulesGroupId };
  } catch (err) {
    console.error('fetchProductByReference failed', { reference, err });
    return null;
  }
}

async function fetchCombinationByReference(reference: string): Promise<{
  id: string;
  productId: string;
  priceImpact: number;
} | null> {
  try {
    const res = await api.get(
      `/combinations?display=[id,id_product,reference,price]&filter[reference]=[${reference}]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const el = doc.querySelector('combination');
    if (!el) return null;
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const productId = el.querySelector('id_product')?.textContent?.trim() ?? '';
    const priceImpact = parseFloat(el.querySelector('price')?.textContent ?? '0');
    if (!id) return null;
    return { id, productId, priceImpact };
  } catch (err) {
    console.error('fetchCombinationByReference failed', { reference, err });
    return null;
  }
}

// ==========================================
// TYPES
// ==========================================

export interface FichierImportResult {
  label: string;
  success: boolean;
  error?: string;
  id?: string;
}

export type FichierProgressCallback = (done: number, total: number, label: string) => void;

// ==========================================
// CACHES GLOBAUX (réinitialisés à chaque import)
// ==========================================

let categoryCache: Map<string, string> = new Map();
let productRefCache: Map<string, string> = new Map();
let optionCache: Map<string, string> = new Map();
let optionValueCache: Map<string, string> = new Map();
let taxRateCache: Map<string, number> = new Map(); // reference → taxRate

// ==========================================
// FICHIER 1 — Produits (date_produit,nom,reference,prix_ttc,Taxe,categorie,prix_achat)
// ==========================================

async function findOrCreateCategory(name: string): Promise<string> {
  if (categoryCache.has(name)) return categoryCache.get(name)!;

  // Chargement de toutes les catégories au premier appel
  if (categoryCache.size === 0) {
    try {
      const res = await api.get('/categories?display=full');
      const doc = new DOMParser().parseFromString(res.data, 'text/xml');
      doc.querySelectorAll('category').forEach((c) => {
        const id   = c.querySelector(':scope > id')?.textContent?.trim();
        const nameEl = c.querySelector('name language');
        const n    = nameEl?.textContent?.trim() ?? c.querySelector('name')?.textContent?.trim();
        if (id && n) categoryCache.set(n, id);
      });
    } catch { /* ignore */ }
  }

  if (categoryCache.has(name)) return categoryCache.get(name)!;

  // Créer la catégorie
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <active><![CDATA[1]]></active>
    <id_parent><![CDATA[2]]></id_parent>
    <name><language id="1"><![CDATA[${name}]]></language></name>
    <link_rewrite><language id="1"><![CDATA[${slugify(name)}]]></language></link_rewrite>
    <description><language id="1"><![CDATA[]]></language></description>
    <meta_title><language id="1"><![CDATA[${name}]]></language></meta_title>
    <meta_keywords><language id="1"><![CDATA[]]></language></meta_keywords>
    <meta_description><language id="1"><![CDATA[]]></language></meta_description>
  </category>
</prestashop>`;
  const id = await postXml('/categories', xml);
  categoryCache.set(name, id);
  return id;
}

export async function importFichier1(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  categoryCache = new Map();
  productRefCache = new Map();
  taxRateCache = new Map();

  const lines = parseCsvContent(await file.text());
  const header = lines[0] ?? [];
  const cols = resolveFichier1Columns(header);
  const rows  = lines.slice(1).filter((r) => (r[cols.nomIdx] ?? '').trim() !== ''); // skip header
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = row[cols.nomIdx] ?? '';
    const reference = row[cols.referenceIdx] ?? '';
    const dateValue = cols.dateIdx >= 0 ? (row[cols.dateIdx] ?? '') : '';
    const prix_ttc_str = row[cols.prixTtcIdx] ?? '';
    const taxe_str = row[cols.taxeIdx] ?? '';
    const categorie = row[cols.categorieIdx] ?? '';
    const prix_achat_str = row[cols.prixAchatIdx] ?? '';
    const label = `${nom} (${reference})`;
    onProgress?.(i, rows.length, label);
    try {
      const taxRate  = parseTaxRate(taxe_str ?? '0%');
      const ttc      = parseFrenchNumber(prix_ttc_str ?? '0');
      const ht       = ttcToHt(ttc, taxRate);
      const wholesalePrice = parseFrenchNumber(prix_achat_str ?? '0');
      const catId    = await findOrCreateCategory(categorie ?? 'Général');
      const taxGroupId = await ensureTaxRulesGroupIdByRate(taxRate);
      if (!taxGroupId) {
        console.error('Tax group not found for rate', {
          label,
          rate: taxRate,
          taxLabel: taxe_str,
        });
        throw new Error(`Aucun groupe de taxe pour le taux ${taxe_str ?? '0%'}`);
      }
      taxRateCache.set(reference, taxRate);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <active><![CDATA[1]]></active>
    <state><![CDATA[1]]></state>
    <id_category_default><![CDATA[${catId}]]></id_category_default>
    <id_tax_rules_group><![CDATA[${taxGroupId}]]></id_tax_rules_group>
    <type><![CDATA[simple]]></type>
    <reference><![CDATA[${reference}]]></reference>
    <price><![CDATA[${ht.toFixed(6)}]]></price>
    <wholesale_price><![CDATA[${wholesalePrice.toFixed(6)}]]></wholesale_price>
    <name><language id="1"><![CDATA[${nom}]]></language></name>
    <link_rewrite><language id="1"><![CDATA[${slugify(nom)}]]></language></link_rewrite>
    <description><language id="1"><![CDATA[]]></language></description>
    <description_short><language id="1"><![CDATA[]]></language></description_short>
    <meta_title><language id="1"><![CDATA[${nom}]]></language></meta_title>
    <associations>
      <categories><category><id><![CDATA[${catId}]]></id></category></categories>
    </associations>
  </product>
</prestashop>`;
      const id = await postXml('/products', xml);
      productRefCache.set(reference, id);
      results.push({ label, success: true, id });
    } catch (err: any) {
      console.error('Import fichier1 failed', {
        label,
        error: err,
        response: err?.response?.data,
      });
      results.push({ label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length, label);
  }
  return results;
}

// ==========================================
// FICHIER 2 — Combinaisons & Stock (reference,specificité,karazany,stock_initial,prix_vente_ttc)
// ==========================================

async function getProductIdByRef(reference: string): Promise<string | null> {
  if (productRefCache.has(reference)) return productRefCache.get(reference)!;
  try {
    const res = await api.get(`/products?display=[id,reference]&filter[reference]=[${reference}]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const id  = doc.querySelector('product > id')?.textContent?.trim();
    if (id) { productRefCache.set(reference, id); return id; }
  } catch { /* ignore */ }
  return null;
}

async function getStockAvailableId(productId: string, combinationId = '0'): Promise<string | null> {
  try {
    const res = await api.get(
      `/stock_availables?display=[id,id_product,id_product_attribute]&filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    return doc.querySelector('stock_available > id')?.textContent?.trim() ?? null;
  } catch { return null; }
}

async function setStock(stockId: string, productId: string, combinationId: string, qty: number): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${stockId}]]></id>
    <id_product><![CDATA[${productId}]]></id_product>
    <id_product_attribute><![CDATA[${combinationId}]]></id_product_attribute>
    <id_shop><![CDATA[1]]></id_shop>
    <id_shop_group><![CDATA[0]]></id_shop_group>
    <quantity><![CDATA[${qty}]]></quantity>
    <depends_on_stock><![CDATA[0]]></depends_on_stock>
    <out_of_stock><![CDATA[0]]></out_of_stock>
  </stock_available>
</prestashop>`;
  await api.put(`/stock_availables/${stockId}`, xml);
}

async function getOrCreateOption(name: string): Promise<string> {
  const key = name.toLowerCase();
  if (optionCache.has(key)) return optionCache.get(key)!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <name><language id="1"><![CDATA[${name}]]></language></name>
    <public_name><language id="1"><![CDATA[${name}]]></language></public_name>
    <group_type><![CDATA[select]]></group_type>
    <is_color_group><![CDATA[0]]></is_color_group>
    <position><![CDATA[0]]></position>
  </product_option>
</prestashop>`;
  const id = await postXml('/product_options', xml);
  optionCache.set(key, id);
  return id;
}

async function getOrCreateOptionValue(optionId: string, valueName: string): Promise<string> {
  const key = `${optionId}:${valueName.toLowerCase()}`;
  if (optionValueCache.has(key)) return optionValueCache.get(key)!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group><![CDATA[${optionId}]]></id_attribute_group>
    <name><language id="1"><![CDATA[${valueName}]]></language></name>
    <position><![CDATA[0]]></position>
  </product_option_value>
</prestashop>`;
  const id = await postXml('/product_option_values', xml);
  optionValueCache.set(key, id);
  return id;
}

export async function importFichier2(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  optionCache = new Map();
  optionValueCache = new Map();

  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[0]);
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const [reference, specificite, karazany, stock_str, prix_ttc_str] = rows[i];
    const label = `${reference}${karazany ? ' — ' + karazany : ''}`;
    onProgress?.(i, rows.length, label);

    try {
      const productId = await getProductIdByRef(reference);
      if (!productId) throw new Error(`Produit "${reference}" introuvable`);

      const qty = parseInt(stock_str ?? '0', 10) || 0;
      const hasVariant = specificite && karazany;

      if (hasVariant) {
        // Créer la combinaison
        const taxRate   = taxRateCache.get(reference) ?? 0;
        const basePriceRes = await api.get(`/products/${productId}?display=[price]`);
        const baseDoc   = new DOMParser().parseFromString(basePriceRes.data, 'text/xml');
        const baseHt    = parseFloat(baseDoc.querySelector('price')?.textContent ?? '0');
        const variantTtc = parseFrenchNumber(prix_ttc_str ?? '0');
        const variantHt  = variantTtc > 0 ? ttcToHt(variantTtc, taxRate) : baseHt;
        const priceImpact = (variantHt - baseHt).toFixed(6);
        const combinationRef = buildCombinationReference(reference, karazany);

        const optionId = await getOrCreateOption(specificite);
        const valId    = await getOrCreateOptionValue(optionId, karazany);

        const combXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product><![CDATA[${productId}]]></id_product>
    <reference><![CDATA[${combinationRef}]]></reference>
    <price><![CDATA[${priceImpact}]]></price>
    <minimal_quantity><![CDATA[1]]></minimal_quantity>
    <default_on><![CDATA[0]]></default_on>
    <associations>
      <product_option_values>
        <product_option_value><id><![CDATA[${valId}]]></id></product_option_value>
      </product_option_values>
    </associations>
  </combination>
</prestashop>`;
        const combId = await postXml('/combinations', combXml);
        // Mettre à jour le stock de la combinaison
        const stockId = await getStockAvailableId(productId, combId);
        if (stockId) await setStock(stockId, productId, combId, qty);
        results.push({ label, success: true, id: combId });
      } else {
        // Pas de variante : mettre le stock du produit de base
        const stockId = await getStockAvailableId(productId, '0');
        if (stockId) await setStock(stockId, productId, '0', qty);
        results.push({ label, success: true });
      }
    } catch (err: any) {
      console.error('Import fichier2 failed', {
        label,
        error: err,
        response: err?.response?.data,
      });
      results.push({ label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length, label);
  }
  return results;
}

// ==========================================
// FICHIER 3 — Clients & Commandes (date,nom,email,pwd,adresse,achat,etat)
// ==========================================

function parseAchat(raw: string): Array<{ reference: string; qty: number; variant: string }> {
  // raw après parse CSV: [("T_01";3;"ngoza")] ou [("T_01";2;"kely"),("M_03";1;"")]
  const cleaned = raw.trim();
  if (!cleaned.startsWith('[')) return [];
  const inner = cleaned.slice(1, -1); // retire [ et ]
  const itemStrings = inner.split('),(');

  return itemStrings.map((s) => {
    const stripped = s.replace(/^\(|\)$/g, '');
    const parts    = stripped.split(';');
    return {
      reference: parts[0]?.replace(/"/g, '').trim() ?? '',
      qty:       parseInt(parts[1]?.trim() ?? '1', 10) || 1,
      variant:   parts[2]?.replace(/"/g, '').trim() ?? '',
    };
  }).filter((it) => it.reference);
}

function mapEtatToStatus(etat: string): LocalOrderStatus {
  const e = etat.toLowerCase();
  if (e.includes('accept') || e.includes('effectu')) return 'paid';
  if (e.includes('erreur') || e.includes('chec'))    return 'error';
  if (e.includes('annul'))                            return 'cancelled';
  return 'pending';
}

interface ImportCustomer {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
}

function splitCustomerName(nom: string): { firstname: string; lastname: string } {
  const parts = nom.trim().split(' ').filter(Boolean);
  const firstname = parts[0] ?? nom;
  const lastname = parts.slice(1).join(' ') || nom;
  return { firstname, lastname };
}

async function createCustomer(nom: string, email: string, pwd: string): Promise<ImportCustomer | null> {
  const { firstname, lastname } = splitCustomerName(nom);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <active><![CDATA[1]]></active>
    <id_gender><![CDATA[0]]></id_gender>
    <email><![CDATA[${email}]]></email>
    <passwd><![CDATA[${pwd}]]></passwd>
    <lastname><![CDATA[${lastname}]]></lastname>
    <firstname><![CDATA[${firstname}]]></firstname>
    <newsletter><![CDATA[0]]></newsletter>
    <optin><![CDATA[0]]></optin>
    <id_default_group><![CDATA[3]]></id_default_group>
  </customer>
</prestashop>`;
  try {
    const id = await postXml('/customers', xml);
    if (!id || id === '?') return null;
    return { id, firstname, lastname, email };
  } catch {
    return null;
  }
}

async function resolveCustomer(nom: string, email: string, pwd: string): Promise<ImportCustomer | null> {
  const existing = await findCustomerByEmail(email);
  if (existing) return existing;
  return await createCustomer(nom, email, pwd);
}

async function ensureAddressForCustomer(customer: ImportCustomer, adresse: string): Promise<string | null> {
  const address1 = adresse?.trim() || 'Adresse import';
  const city = adresse?.trim() || 'Ville';
  const postcode = '00000';
  const alias = `Import ${customer.id}-${Date.now()}`;
  try {
    return await createAddress({
      id_customer: customer.id,
      alias,
      firstname: customer.firstname,
      lastname: customer.lastname,
      address1,
      address2: '',
      postcode,
      city,
    });
  } catch (err) {
    console.error('Address creation failed', { customer: customer.email, adresse, err });
    return null;
  }
}

async function buildCheckoutItems(items: Array<{ reference: string; qty: number; variant: string }>): Promise<CheckoutItem[]> {
  const result: CheckoutItem[] = [];

  for (const item of items) {
    const product = await fetchProductByReference(item.reference);
    if (!product) throw new Error(`Produit "${item.reference}" introuvable`);

    let attributeId: string | undefined;
    let priceHt = product.priceHt;

    if (item.variant) {
      const combRef = buildCombinationReference(item.reference, item.variant);
      const combination = await fetchCombinationByReference(combRef);
      if (!combination) throw new Error(`Declinaison "${combRef}" introuvable`);
      if (combination.productId && combination.productId !== product.id) {
        console.warn('Combination product mismatch', { combRef, productId: product.id, comboProductId: combination.productId });
      }
      attributeId = combination.id;
      priceHt = product.priceHt + combination.priceImpact;
    }

    const taxRate = await getTaxRateByGroup(product.taxRulesGroupId);
    const priceTtc = roundMoney(priceHt * (1 + taxRate));

    result.push({
      id: product.id,
      name: product.name || item.reference,
      priceHt: roundMoney(priceHt),
      priceTtc,
      taxRate,
      qty: item.qty,
      attributeId,
    });
  }

  return result;
}

export async function importFichier3(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[1]);
  const results: FichierImportResult[] = [];
  const newOrders: LocalOrder[] = [];

  const carrierId = '1';
  const shippingCost = 0;

  for (let i = 0; i < rows.length; i++) {
    const [date, nom, email, pwd, adresse, achat, etat] = rows[i];
    const label = `${nom} (${email})`;
    onProgress?.(i, rows.length, label);

    try {
      const customer = await resolveCustomer(nom, email, pwd);
      if (!customer) throw new Error(`Client "${email}" introuvable ou creation impossible`);

      const addressId = await ensureAddressForCustomer(customer, adresse ?? '');
      if (!addressId) throw new Error(`Adresse non creee pour ${email}`);

      const items = parseAchat(achat ?? '');
      const checkoutItems = await buildCheckoutItems(items);
      if (checkoutItems.length === 0) throw new Error('Aucun achat valide dans la ligne');

      const cartId = await createPSCart(customer.id, addressId, carrierId, checkoutItems);
      const orderId = await createPSOrder({
        customerId: customer.id,
        addressId,
        cartId,
        carrierId,
        items: checkoutItems,
        shippingCost,
      });
      await updateStockAfterOrder(checkoutItems);

      const status = mapEtatToStatus(etat ?? '');
      const totalTtc = checkoutItems.reduce((sum, item) => sum + item.priceTtc * item.qty, 0);
      const order: LocalOrder = {
        id:            orderId,
        date:          date ?? new Date().toLocaleDateString('fr-FR'),
        customerName:  nom,
        customerEmail: email,
        address:       adresse ?? '',
        items,
        status,
        totalTTC:      roundMoney(totalTtc),
        source:        'local',
      };
      newOrders.push(order);
      results.push({ label, success: true, id: orderId });
    } catch (err: any) {
      console.error('Import fichier3 failed', {
        label,
        error: err,
        response: err?.response?.data,
      });
      results.push({ label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length, label);
  }

  if (newOrders.length > 0) addLocalOrders(newOrders);
  return results;
}

// ==========================================
// IMAGES ZIP
// ==========================================

export interface ImageImportResult {
  filename: string;
  reference: string;
  success: boolean;
  error?: string;
}

async function uploadImage(productId: string, blob: Blob, filename: string): Promise<void> {
  const formData = new FormData();
  formData.append('image', blob, filename);
  const res = await fetch(`/api/images/products/${productId}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(extractXmlError(text) || `HTTP ${res.status}`);
  }
}

export async function importImagesZip(
  file: File,
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<ImageImportResult[]> {
  const zip     = await JSZip.loadAsync(await file.arrayBuffer());
  const results: ImageImportResult[] = [];
  const entries = Object.entries(zip.files).filter(
    ([name, f]) => !f.dir && !name.startsWith('__MACOSX') && /\.(png|jpg|jpeg|webp|gif)$/i.test(name)
  );

  for (let i = 0; i < entries.length; i++) {
    const [path, zipFile] = entries[i];
    const filename  = path.split('/').pop() ?? path;
    const reference = filename.replace(/\.[^.]+$/, '');
    onProgress?.(i, entries.length, filename);

    try {
      const productId = await getProductIdByRef(reference);
      if (!productId) throw new Error(`Produit "${reference}" introuvable`);
      const blob = await zipFile.async('blob');
      await uploadImage(productId, blob, filename);
      results.push({ filename, reference, success: true });
    } catch (err: any) {
      console.error('Import images failed', {
        filename,
        reference,
        error: err,
      });
      results.push({ filename, reference, success: false, error: err.message });
    }
    onProgress?.(i + 1, entries.length, filename);
  }
  return results;
}

// ==========================================
// PRÉ-VALIDATION TRANSACTIONNELLE
// ==========================================

export type PrevalidateAllResult = {
  fichier1: FichierImportResult[];
  fichier2: FichierImportResult[];
  fichier3: FichierImportResult[];
  images: ImageImportResult[];
  hasErrors: boolean;
};

type PrevalidateCallbacks = {
  fichier1?: FichierProgressCallback;
  fichier2?: FichierProgressCallback;
  fichier3?: FichierProgressCallback;
  images?: (done: number, total: number, name: string) => void;
};

type PrevalidateContext = {
  productRefs: Set<string>;
  taxRateByRef: Map<string, number>;
  combinationRefs: Set<string>;
};

async function productExistsByRef(reference: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(reference)) return cache.get(reference)!;
  const exists = Boolean(await fetchProductByReference(reference));
  cache.set(reference, exists);
  return exists;
}

async function combinationExistsByRef(reference: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(reference)) return cache.get(reference)!;
  const exists = Boolean(await fetchCombinationByReference(reference));
  cache.set(reference, exists);
  return exists;
}

async function customerExistsByEmail(email: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(email)) return cache.get(email)!;
  const exists = Boolean(await findCustomerByEmail(email));
  cache.set(email, exists);
  return exists;
}

async function prevalidateFichier1Internal(
  file: File,
  onProgress: PrevalidateCallbacks['fichier1'],
  productExistsCache: Map<string, boolean>,
): Promise<{ results: FichierImportResult[]; context: PrevalidateContext }> {
  const lines = parseCsvContent(await file.text());
  const header = lines[0] ?? [];
  const cols = resolveFichier1Columns(header);
  const rows  = lines.slice(1).filter((r) => (r[cols.nomIdx] ?? '').trim() !== '');
  const results: FichierImportResult[] = [];
  const productRefs = new Set<string>();
  const taxRateByRef = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = row[cols.nomIdx] ?? '';
    const reference = row[cols.referenceIdx] ?? '';
    const dateValue = cols.dateIdx >= 0 ? (row[cols.dateIdx] ?? '') : '';
    const prix_ttc_str = row[cols.prixTtcIdx] ?? '';
    const taxe_str = row[cols.taxeIdx] ?? '';
    const prix_achat_str = row[cols.prixAchatIdx] ?? '';
    const label = `${nom} (${reference})`;
    onProgress?.(i, rows.length, label);

    const errors: string[] = [];
    if (!nom.trim()) errors.push('Nom manquant');
    if (!reference.trim()) errors.push('Reference manquante');
    if (dateValue.trim() && !parseDateFlexible(dateValue)) {
      errors.push('Date invalide');
    }

    const prixRaw = prix_ttc_str.trim();
    const prixParsed = prixRaw ? parseNumberStrict(prixRaw) : null;
    if (!prixRaw) errors.push('Prix TTC manquant');
    if (prixRaw && prixParsed == null) errors.push('Prix TTC invalide');

    const prixAchatRaw = prix_achat_str.trim();
    const prixAchatParsed = prixAchatRaw ? parseNumberStrict(prixAchatRaw) : null;
    if (prixAchatRaw && prixAchatParsed == null) errors.push('Prix achat invalide');

    const taxeRaw = taxe_str.trim();
    const taxeParsed = taxeRaw ? parseNumberStrict(taxeRaw) : null;
    if (taxeRaw && taxeParsed == null) errors.push('Taxe invalide');

    if (reference && productRefs.has(reference)) errors.push('Reference en double');

    if (errors.length === 0 && reference) {
      const exists = await productExistsByRef(reference, productExistsCache);
      if (exists) errors.push('Reference deja existante');
    }

    let taxRate = 0;
    if (taxeParsed != null) taxRate = Math.max(0, taxeParsed) / 100;

    if (errors.length === 0 && reference) {
      productRefs.add(reference);
      taxRateByRef.set(reference, taxRate);
      results.push({ label, success: true });
    } else {
      results.push({ label, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, rows.length, label);
  }

  return {
    results,
    context: { productRefs, taxRateByRef, combinationRefs: new Set() },
  };
}

async function prevalidateFichier2Internal(
  file: File,
  baseContext: PrevalidateContext,
  onProgress: PrevalidateCallbacks['fichier2'],
  productExistsCache: Map<string, boolean>,
  combinationExistsCache: Map<string, boolean>,
): Promise<{ results: FichierImportResult[]; combinationRefs: Set<string> }> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[0]);
  const results: FichierImportResult[] = [];
  const combinationRefs = new Set<string>();
  const seenCombRefs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const [reference, specificite, karazany, stock_str, prix_ttc_str] = rows[i];
    const label = `${reference}${karazany ? ' — ' + karazany : ''}`;
    onProgress?.(i, rows.length, label);

    const errors: string[] = [];
    if (!reference?.trim()) errors.push('Reference manquante');

    const stockRaw = (stock_str ?? '').trim();
    if (stockRaw) {
      const stockParsed = parseInt(stockRaw, 10);
      if (Number.isNaN(stockParsed)) errors.push('Stock invalide');
      if (!Number.isNaN(stockParsed) && stockParsed < 0) errors.push('Stock negatif');
    }

    const priceRaw = (prix_ttc_str ?? '').trim();
    if (priceRaw) {
      const priceParsed = parseNumberStrict(priceRaw);
      if (priceParsed == null) errors.push('Prix TTC invalide');
    }

    const hasSpecificite = Boolean(specificite?.trim());
    const hasKarazany = Boolean(karazany?.trim());
    if (hasSpecificite !== hasKarazany) {
      errors.push('Specificite et karazany doivent etre renseignes ensemble');
    }

    let combRef = '';
    if (hasSpecificite && hasKarazany && reference?.trim()) {
      combRef = buildCombinationReference(reference.trim(), karazany.trim());
      if (seenCombRefs.has(combRef)) errors.push('Declinaison en double');
      seenCombRefs.add(combRef);
      combinationRefs.add(combRef);
    }

    if (errors.length === 0 && reference?.trim()) {
      const ref = reference.trim();
      if (!baseContext.productRefs.has(ref)) {
        const exists = await productExistsByRef(ref, productExistsCache);
        if (!exists) errors.push(`Produit "${ref}" introuvable`);
      }
    }

    if (errors.length === 0 && combRef) {
      const exists = await combinationExistsByRef(combRef, combinationExistsCache);
      if (exists) errors.push(`Declinaison "${combRef}" deja existante`);
    }

    if (errors.length === 0) {
      results.push({ label, success: true });
    } else {
      results.push({ label, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, rows.length, label);
  }

  return { results, combinationRefs };
}

async function prevalidateFichier3Internal(
  file: File,
  baseContext: PrevalidateContext,
  onProgress: PrevalidateCallbacks['fichier3'],
  productExistsCache: Map<string, boolean>,
  combinationExistsCache: Map<string, boolean>,
  customerExistsCache: Map<string, boolean>,
): Promise<FichierImportResult[]> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[1]);
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const nom = rows[i][1] ?? '';
    const email = rows[i][2] ?? '';
    const pwd = rows[i][3] ?? '';
    const achat = rows[i][5] ?? '';
    const dateValue = rows[i][0] ?? '';
    const label = `${nom} (${email})`;
    onProgress?.(i, rows.length, label);

    const errors: string[] = [];
    const emailValue = (email ?? '').trim();
    if (!nom?.trim()) errors.push('Nom manquant');
    if (!emailValue) errors.push('Email manquant');
    if (emailValue && !/^\S+@\S+\.\S+$/.test(emailValue)) errors.push('Email invalide');
    if (dateValue.trim() && !parseDateFlexible(dateValue)) {
      errors.push('Date invalide');
    }

    if (emailValue && errors.length === 0) {
      const customerExists = await customerExistsByEmail(emailValue, customerExistsCache);
      if (!customerExists && !(pwd ?? '').trim()) {
        errors.push('Mot de passe manquant pour nouveau client');
      }
    }

    const items = parseAchat(achat ?? '');
    if (items.length === 0) errors.push('Aucun achat valide dans la ligne');

    for (const item of items) {
      if (!item.reference.trim()) {
        errors.push('Reference produit manquante');
        continue;
      }
      if (item.qty <= 0) errors.push(`Quantite invalide pour ${item.reference}`);

      const ref = item.reference.trim();
      if (!baseContext.productRefs.has(ref)) {
        const exists = await productExistsByRef(ref, productExistsCache);
        if (!exists) errors.push(`Produit "${ref}" introuvable`);
      }

      if (item.variant?.trim()) {
        const combRef = buildCombinationReference(ref, item.variant.trim());
        if (!baseContext.combinationRefs.has(combRef)) {
          const exists = await combinationExistsByRef(combRef, combinationExistsCache);
          if (!exists) errors.push(`Declinaison "${combRef}" introuvable`);
        }
      }
    }

    if (errors.length === 0) {
      results.push({ label, success: true });
    } else {
      results.push({ label, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, rows.length, label);
  }

  return results;
}

async function prevalidateImagesZipInternal(
  file: File,
  baseContext: PrevalidateContext,
  onProgress: PrevalidateCallbacks['images'],
  productExistsCache: Map<string, boolean>,
): Promise<ImageImportResult[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const results: ImageImportResult[] = [];
  const entries = Object.entries(zip.files).filter(
    ([name, f]) => !f.dir && !name.startsWith('__MACOSX') && /\.(png|jpg|jpeg|webp|gif)$/i.test(name)
  );

  if (entries.length === 0) {
    results.push({
      filename: 'Aucune image',
      reference: '',
      success: false,
      error: 'Archive vide ou sans image valide',
    });
    return results;
  }

  for (let i = 0; i < entries.length; i++) {
    const [path] = entries[i];
    const filename = path.split('/').pop() ?? path;
    const reference = filename.replace(/\.[^.]+$/, '');
    onProgress?.(i, entries.length, filename);

    const errors: string[] = [];
    if (!reference.trim()) errors.push('Nom de fichier invalide');

    if (reference.trim() && !baseContext.productRefs.has(reference)) {
      const exists = await productExistsByRef(reference, productExistsCache);
      if (!exists) errors.push(`Produit "${reference}" introuvable`);
    }

    if (errors.length === 0) {
      results.push({ filename, reference, success: true });
    } else {
      results.push({ filename, reference, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, entries.length, filename);
  }

  return results;
}

export async function prevalidateFichiersImport(
  files: { fichier1: File; fichier2: File; fichier3: File; images: File },
  callbacks: PrevalidateCallbacks = {},
): Promise<PrevalidateAllResult> {
  const productExistsCache = new Map<string, boolean>();
  const combinationExistsCache = new Map<string, boolean>();
  const customerExistsCache = new Map<string, boolean>();

  const fichier1Result = await prevalidateFichier1Internal(
    files.fichier1,
    callbacks.fichier1,
    productExistsCache,
  );

  const fichier2Result = await prevalidateFichier2Internal(
    files.fichier2,
    fichier1Result.context,
    callbacks.fichier2,
    productExistsCache,
    combinationExistsCache,
  );

  const fullContext: PrevalidateContext = {
    productRefs: fichier1Result.context.productRefs,
    taxRateByRef: fichier1Result.context.taxRateByRef,
    combinationRefs: fichier2Result.combinationRefs,
  };

  const fichier3Results = await prevalidateFichier3Internal(
    files.fichier3,
    fullContext,
    callbacks.fichier3,
    productExistsCache,
    combinationExistsCache,
    customerExistsCache,
  );

  const imagesResults = await prevalidateImagesZipInternal(
    files.images,
    fullContext,
    callbacks.images,
    productExistsCache,
  );

  const hasErrors =
    fichier1Result.results.some((r) => !r.success)
    || fichier2Result.results.some((r) => !r.success)
    || fichier3Results.some((r) => !r.success)
    || imagesResults.some((r) => !r.success);

  return {
    fichier1: fichier1Result.results,
    fichier2: fichier2Result.results,
    fichier3: fichier3Results,
    images: imagesResults,
    hasErrors,
  };
}
===
import axios from 'axios';
import JSZip from 'jszip';

import {
  findCustomerByEmail,
  createAddress,
  createPSCart,
  createPSOrder,
  updateStockAfterOrder,
  type CheckoutItem,
} from './customerService';
import { ensureTaxRulesGroupIdByRate, getTaxRateByGroup } from './taxService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ==========================================
// UTILITAIRES CSV
// ==========================================

/** Parser CSV générique : gère les champs entre guillemets et les virgules internes */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvContent(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map(parseCsvLine);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function resolveFichier1Columns(header: string[]) {
  const lower = header.map(normalizeHeader);
  const hasDate = lower.includes('date_produit');
  const fallback = hasDate
    ? { date: 0, nom: 1, reference: 2, prixTtc: 3, taxe: 4, categorie: 5, prixAchat: 6 }
    : { date: -1, nom: 0, reference: 1, prixTtc: 2, taxe: 3, categorie: 4, prixAchat: 5 };

  const findIdx = (names: string[], fallbackIdx: number) => {
    for (const name of names) {
      const idx = lower.indexOf(name);
      if (idx >= 0) return idx;
    }
    return fallbackIdx;
  };

  return {
    dateIdx: findIdx(['date_produit', 'date produit', 'date','date_availability_produit'], fallback.date),
    nomIdx: findIdx(['nom', 'name'], fallback.nom),
    referenceIdx: findIdx(['reference', 'référence', 'ref'], fallback.reference),
    prixTtcIdx: findIdx(['prix_ttc', 'prix ttc', 'price_ttc'], fallback.prixTtc),
    taxeIdx: findIdx(['taxe', 'taux_tva', 'tva', 'tax'], fallback.taxe),
    categorieIdx: findIdx(['categorie', 'catégorie', 'category'], fallback.categorie),
    prixAchatIdx: findIdx(['prix_achat', 'prix achat', 'wholesale_price'], fallback.prixAchat),
  };
}

function parseFrenchNumber(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

function parseNumberStrict(raw: string): number | null {
  const cleaned = raw.trim().replace('%', '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

function normalizeYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function buildDate(year: number, month: number, day: number, h = 0, m = 0, s = 0): Date | null {
  const y = normalizeYear(year);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(y, month - 1, day, h, m, s);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function parseDateFlexible(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct);

  const ymd = value.match(/^([12]\d{3})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (ymd) {
    const [, y, mo, d, hh, mm, ss] = ymd;
    return buildDate(
      parseInt(y, 10),
      parseInt(mo, 10),
      parseInt(d, 10),
      parseInt(hh ?? '0', 10),
      parseInt(mm ?? '0', 10),
      parseInt(ss ?? '0', 10),
    );
  }

  const dmy = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (dmy) {
    const [, p1, p2, y, hh, mm, ss] = dmy;
    const a = parseInt(p1, 10);
    const b = parseInt(p2, 10);
    const year = parseInt(y, 10);
    let day = a;
    let month = b;
    if (a <= 12 && b <= 12) {
      day = a; // format fr par defaut
      month = b;
    } else if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    }
    return buildDate(
      year,
      month,
      day,
      parseInt(hh ?? '0', 10),
      parseInt(mm ?? '0', 10),
      parseInt(ss ?? '0', 10),
    );
  }

  return null;
}

function parseTaxRate(s: string): number {
  return parseFrenchNumber(s.replace('%', '')) / 100;
}

function ttcToHt(ttc: number, taxRate: number): number {
  if (taxRate <= 0) return ttc;
  return ttc / (1 + taxRate);
}

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function buildCombinationReference(reference: string, variant: string): string {
  const suffix = slugify(variant);
  return suffix ? `${reference}-${suffix}` : reference;
}

function extractXmlError(xml: string): string {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return doc.querySelector('message')?.textContent?.trim()
        ?? doc.querySelector('error')?.textContent?.trim()
        ?? xml.slice(0, 100);
  } catch { return 'Erreur API'; }
}

function getCreatedId(xml: string): string | null {
  try {
    return new DOMParser().parseFromString(xml, 'text/xml')
      .querySelector('id')?.textContent?.trim() ?? null;
  } catch { return null; }
}

async function postXml(endpoint: string, xml: string): Promise<string> {
  const res = await api.post(endpoint, xml);
  return getCreatedId(res.data) ?? '?';
}

async function fetchProductByReference(reference: string): Promise<{
  id: string;
  name: string;
  priceHt: number;
  taxRulesGroupId: number;
} | null> {
  try {
    const res = await api.get(
      `/products?display=[id,name,reference,price,id_tax_rules_group]&filter[reference]=[${reference}]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const el = doc.querySelector('product');
    if (!el) return null;
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const name = el.querySelector('name > language')?.textContent?.trim()
      ?? el.querySelector('name')?.textContent?.trim()
      ?? reference;
    const priceHt = parseFloat(el.querySelector('price')?.textContent ?? '0');
    const taxRulesGroupId = parseInt(el.querySelector('id_tax_rules_group')?.textContent ?? '0', 10);
    if (!id) return null;
    return { id, name, priceHt, taxRulesGroupId };
  } catch (err) {
    console.error('fetchProductByReference failed', { reference, err });
    return null;
  }
}

async function fetchCombinationByReference(reference: string): Promise<{
  id: string;
  productId: string;
  priceImpact: number;
} | null> {
  try {
    const res = await api.get(
      `/combinations?display=[id,id_product,reference,price]&filter[reference]=[${reference}]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const el = doc.querySelector('combination');
    if (!el) return null;
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const productId = el.querySelector('id_product')?.textContent?.trim() ?? '';
    const priceImpact = parseFloat(el.querySelector('price')?.textContent ?? '0');
    if (!id) return null;
    return { id, productId, priceImpact };
  } catch (err) {
    console.error('fetchCombinationByReference failed', { reference, err });
    return null;
  }
}

// ==========================================
// TYPES
// ==========================================

export interface FichierImportResult {
  label: string;
  success: boolean;
  error?: string;
  id?: string;
}

export type FichierProgressCallback = (done: number, total: number, label: string) => void;

// ==========================================
// CACHES GLOBAUX (réinitialisés à chaque import)
// ==========================================

let categoryCache: Map<string, string> = new Map();
let productRefCache: Map<string, string> = new Map();
let optionCache: Map<string, string> = new Map();
let optionValueCache: Map<string, string> = new Map();
let taxRateCache: Map<string, number> = new Map(); // reference → taxRate

// ==========================================
// FICHIER 1 — Produits (date_produit,nom,reference,prix_ttc,Taxe,categorie,prix_achat)
// ==========================================

async function findOrCreateCategory(name: string): Promise<string> {
  if (categoryCache.has(name)) return categoryCache.get(name)!;

  // Chargement de toutes les catégories au premier appel
  if (categoryCache.size === 0) {
    try {
      const res = await api.get('/categories?display=full');
      const doc = new DOMParser().parseFromString(res.data, 'text/xml');
      doc.querySelectorAll('category').forEach((c) => {
        const id   = c.querySelector(':scope > id')?.textContent?.trim();
        const nameEl = c.querySelector('name language');
        const n    = nameEl?.textContent?.trim() ?? c.querySelector('name')?.textContent?.trim();
        if (id && n) categoryCache.set(n, id);
      });
    } catch { /* ignore */ }
  }

  if (categoryCache.has(name)) return categoryCache.get(name)!;

  // Créer la catégorie
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <active><![CDATA[1]]></active>
    <id_parent><![CDATA[2]]></id_parent>
    <name><language id="1"><![CDATA[${name}]]></language></name>
    <link_rewrite><language id="1"><![CDATA[${slugify(name)}]]></language></link_rewrite>
    <description><language id="1"><![CDATA[]]></language></description>
    <meta_title><language id="1"><![CDATA[${name}]]></language></meta_title>
    <meta_keywords><language id="1"><![CDATA[]]></language></meta_keywords>
    <meta_description><language id="1"><![CDATA[]]></language></meta_description>
  </category>
</prestashop>`;
  const id = await postXml('/categories', xml);
  categoryCache.set(name, id);
  return id;
}

export async function importFichier1(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  categoryCache = new Map();
  productRefCache = new Map();
  taxRateCache = new Map();

  const lines = parseCsvContent(await file.text());
  const header = lines[0] ?? [];
  const cols = resolveFichier1Columns(header);
  const rows  = lines.slice(1).filter((r) => (r[cols.nomIdx] ?? '').trim() !== ''); // skip header
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = row[cols.nomIdx] ?? '';
    const reference = row[cols.referenceIdx] ?? '';
    const dateValue = cols.dateIdx >= 0 ? (row[cols.dateIdx] ?? '') : '';
    const prix_ttc_str = row[cols.prixTtcIdx] ?? '';
    const taxe_str = row[cols.taxeIdx] ?? '';
    const categorie = row[cols.categorieIdx] ?? '';
    const prix_achat_str = row[cols.prixAchatIdx] ?? '';
    const label = `${nom} (${reference})`;
    onProgress?.(i, rows.length, label);
    try {
      const taxRate  = parseTaxRate(taxe_str ?? '0%');
      const ttc      = parseFrenchNumber(prix_ttc_str ?? '0');
      const ht       = ttcToHt(ttc, taxRate);
      const wholesalePrice = parseFrenchNumber(prix_achat_str ?? '0');
      const catId    = await findOrCreateCategory(categorie ?? 'Général');
      const taxGroupId = await ensureTaxRulesGroupIdByRate(taxRate);
      if (!taxGroupId) {
        console.error('Tax group not found for rate', {
          label,
          rate: taxRate,
          taxLabel: taxe_str,
        });
        throw new Error(`Aucun groupe de taxe pour le taux ${taxe_str ?? '0%'}`);
      }
      taxRateCache.set(reference, taxRate);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <active><![CDATA[1]]></active>
    <state><![CDATA[1]]></state>
    <id_category_default><![CDATA[${catId}]]></id_category_default>
    <id_tax_rules_group><![CDATA[${taxGroupId}]]></id_tax_rules_group>
    <type><![CDATA[simple]]></type>
    <reference><![CDATA[${reference}]]></reference>
    <price><![CDATA[${ht.toFixed(6)}]]></price>
    <wholesale_price><![CDATA[${wholesalePrice.toFixed(6)}]]></wholesale_price>
    <name><language id="1"><![CDATA[${nom}]]></language></name>
    <link_rewrite><language id="1"><![CDATA[${slugify(nom)}]]></language></link_rewrite>
    <description><language id="1"><![CDATA[]]></language></description>
    <description_short><language id="1"><![CDATA[]]></language></description_short>
    <meta_title><language id="1"><![CDATA[${nom}]]></language></meta_title>
    <associations>
      <categories><category><id><![CDATA[${catId}]]></id></category></categories>
    </associations>
  </product>
</prestashop>`;
      const id = await postXml('/products', xml);
      productRefCache.set(reference, id);
      results.push({ label, success: true, id });
    } catch (err: any) {
      console.error('Import fichier1 failed', {
        label,
        error: err,
        response: err?.response?.data,
      });
      results.push({ label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length, label);
  }
  return results;
}

// ==========================================
// FICHIER 2 — Combinaisons & Stock (reference,specificité,karazany,stock_initial,prix_vente_ttc)
// ==========================================

async function getProductIdByRef(reference: string): Promise<string | null> {
  if (productRefCache.has(reference)) return productRefCache.get(reference)!;
  try {
    const res = await api.get(`/products?display=[id,reference]&filter[reference]=[${reference}]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const id  = doc.querySelector('product > id')?.textContent?.trim();
    if (id) { productRefCache.set(reference, id); return id; }
  } catch { /* ignore */ }
  return null;
}

async function getStockAvailableId(productId: string, combinationId = '0'): Promise<string | null> {
  try {
    const res = await api.get(
      `/stock_availables?display=[id,id_product,id_product_attribute]&filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    return doc.querySelector('stock_available > id')?.textContent?.trim() ?? null;
  } catch { return null; }
}

async function setStock(stockId: string, productId: string, combinationId: string, qty: number): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${stockId}]]></id>
    <id_product><![CDATA[${productId}]]></id_product>
    <id_product_attribute><![CDATA[${combinationId}]]></id_product_attribute>
    <id_shop><![CDATA[1]]></id_shop>
    <id_shop_group><![CDATA[0]]></id_shop_group>
    <quantity><![CDATA[${qty}]]></quantity>
    <depends_on_stock><![CDATA[0]]></depends_on_stock>
    <out_of_stock><![CDATA[0]]></out_of_stock>
  </stock_available>
</prestashop>`;
  await api.put(`/stock_availables/${stockId}`, xml);
}

async function getOrCreateOption(name: string): Promise<string> {
  const key = name.toLowerCase();
  if (optionCache.has(key)) return optionCache.get(key)!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <name><language id="1"><![CDATA[${name}]]></language></name>
    <public_name><language id="1"><![CDATA[${name}]]></language></public_name>
    <group_type><![CDATA[select]]></group_type>
    <is_color_group><![CDATA[0]]></is_color_group>
    <position><![CDATA[0]]></position>
  </product_option>
</prestashop>`;
  const id = await postXml('/product_options', xml);
  optionCache.set(key, id);
  return id;
}

async function getOrCreateOptionValue(optionId: string, valueName: string): Promise<string> {
  const key = `${optionId}:${valueName.toLowerCase()}`;
  if (optionValueCache.has(key)) return optionValueCache.get(key)!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group><![CDATA[${optionId}]]></id_attribute_group>
    <name><language id="1"><![CDATA[${valueName}]]></language></name>
    <position><![CDATA[0]]></position>
  </product_option_value>
</prestashop>`;
  const id = await postXml('/product_option_values', xml);
  optionValueCache.set(key, id);
  return id;
}

export async function importFichier2(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  optionCache = new Map();
  optionValueCache = new Map();

  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[0]);
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const [reference, specificite, karazany, stock_str, prix_ttc_str] = rows[i];
    const label = `${reference}${karazany ? ' — ' + karazany : ''}`;
    onProgress?.(i, rows.length, label);

    try {
      const productId = await getProductIdByRef(reference);
      if (!productId) throw new Error(`Produit "${reference}" introuvable`);

      const qty = parseInt(stock_str ?? '0', 10) || 0;
      const hasVariant = specificite && karazany;

      if (hasVariant) {
        // Créer la combinaison
        const taxRate   = taxRateCache.get(reference) ?? 0;
        const basePriceRes = await api.get(`/products/${productId}?display=[price]`);
        const baseDoc   = new DOMParser().parseFromString(basePriceRes.data, 'text/xml');
        const baseHt    = parseFloat(baseDoc.querySelector('price')?.textContent ?? '0');
        const variantTtc = parseFrenchNumber(prix_ttc_str ?? '0');
        const variantHt  = variantTtc > 0 ? ttcToHt(variantTtc, taxRate) : baseHt;
        const priceImpact = (variantHt - baseHt).toFixed(6);
        const combinationRef = buildCombinationReference(reference, karazany);

        const optionId = await getOrCreateOption(specificite);
        const valId    = await getOrCreateOptionValue(optionId, karazany);

        const combXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product><![CDATA[${productId}]]></id_product>
    <reference><![CDATA[${combinationRef}]]></reference>
    <price><![CDATA[${priceImpact}]]></price>
    <minimal_quantity><![CDATA[1]]></minimal_quantity>
    <default_on><![CDATA[0]]></default_on>
    <associations>
      <product_option_values>
        <product_option_value><id><![CDATA[${valId}]]></id></product_option_value>
      </product_option_values>
    </associations>
  </combination>
</prestashop>`;
        const combId = await postXml('/combinations', combXml);
        // Mettre à jour le stock de la combinaison
        const stockId = await getStockAvailableId(productId, combId);
        if (stockId) await setStock(stockId, productId, combId, qty);
        results.push({ label, success: true, id: combId });
      } else {
        // Pas de variante : mettre le stock du produit de base
        const stockId = await getStockAvailableId(productId, '0');
        if (stockId) await setStock(stockId, productId, '0', qty);
        results.push({ label, success: true });
      }
    } catch (err: any) {
      console.error('Import fichier2 failed', {
        label,
        error: err,
        response: err?.response?.data,
      });
      results.push({ label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length, label);
  }
  return results;
}

// ==========================================
// FICHIER 3 — Clients & Commandes (date,nom,email,pwd,adresse,achat,etat)
// ==========================================

function parseAchat(raw: string): Array<{ reference: string; qty: number; variant: string }> {
  // raw après parse CSV: [("T_01";3;"ngoza")] ou [("T_01";2;"kely"),("M_03";1;"")]
  const cleaned = raw.trim();
  if (!cleaned.startsWith('[')) return [];
  const inner = cleaned.slice(1, -1); // retire [ et ]
  const itemStrings = inner.split('),(');

  return itemStrings.map((s) => {
    const stripped = s.replace(/^\(|\)$/g, '');
    const parts    = stripped.split(';');
    return {
      reference: parts[0]?.replace(/"/g, '').trim() ?? '',
      qty:       parseInt(parts[1]?.trim() ?? '1', 10) || 1,
      variant:   parts[2]?.replace(/"/g, '').trim() ?? '',
    };
  }).filter((it) => it.reference);
}

function mapEtatToPSState(etat: string): number | null {
  const e = etat.toLowerCase();
  if (e.includes('accept') || e.includes('effectu')) return 2;  // Paiement accepté
  if (e.includes('erreur') || e.includes('chec'))    return 8;  // Échec paiement
  if (e.includes('annul'))                            return 6;  // Annulé
  return null; // pas de changement, garde l'état initial (13)
}

interface ImportCustomer {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
}

function splitCustomerName(nom: string): { firstname: string; lastname: string } {
  const parts = nom.trim().split(' ').filter(Boolean);
  const firstname = parts[0] ?? nom;
  const lastname = parts.slice(1).join(' ') || nom;
  return { firstname, lastname };
}

async function createCustomer(nom: string, email: string, pwd: string): Promise<ImportCustomer | null> {
  const { firstname, lastname } = splitCustomerName(nom);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <active><![CDATA[1]]></active>
    <id_gender><![CDATA[0]]></id_gender>
    <email><![CDATA[${email}]]></email>
    <passwd><![CDATA[${pwd}]]></passwd>
    <lastname><![CDATA[${lastname}]]></lastname>
    <firstname><![CDATA[${firstname}]]></firstname>
    <newsletter><![CDATA[0]]></newsletter>
    <optin><![CDATA[0]]></optin>
    <id_default_group><![CDATA[3]]></id_default_group>
  </customer>
</prestashop>`;
  try {
    const id = await postXml('/customers', xml);
    if (!id || id === '?') return null;
    return { id, firstname, lastname, email };
  } catch {
    return null;
  }
}

async function resolveCustomer(nom: string, email: string, pwd: string): Promise<ImportCustomer | null> {
  const existing = await findCustomerByEmail(email);
  if (existing) return existing;
  return await createCustomer(nom, email, pwd);
}

async function ensureAddressForCustomer(customer: ImportCustomer, adresse: string): Promise<string | null> {
  const address1 = adresse?.trim() || 'Adresse import';
  const city = adresse?.trim() || 'Ville';
  const postcode = '00000';
  const alias = `Import ${customer.id}-${Date.now()}`;
  try {
    return await createAddress({
      id_customer: customer.id,
      alias,
      firstname: customer.firstname,
      lastname: customer.lastname,
      address1,
      address2: '',
      postcode,
      city,
    });
  } catch (err) {
    console.error('Address creation failed', { customer: customer.email, adresse, err });
    return null;
  }
}

async function buildCheckoutItems(items: Array<{ reference: string; qty: number; variant: string }>): Promise<CheckoutItem[]> {
  const result: CheckoutItem[] = [];

  for (const item of items) {
    const product = await fetchProductByReference(item.reference);
    if (!product) throw new Error(`Produit "${item.reference}" introuvable`);

    let attributeId: string | undefined;
    let priceHt = product.priceHt;

    if (item.variant) {
      const combRef = buildCombinationReference(item.reference, item.variant);
      const combination = await fetchCombinationByReference(combRef);
      if (!combination) throw new Error(`Declinaison "${combRef}" introuvable`);
      if (combination.productId && combination.productId !== product.id) {
        console.warn('Combination product mismatch', { combRef, productId: product.id, comboProductId: combination.productId });
      }
      attributeId = combination.id;
      priceHt = product.priceHt + combination.priceImpact;
    }

    const taxRate = await getTaxRateByGroup(product.taxRulesGroupId);
    const priceTtc = roundMoney(priceHt * (1 + taxRate));

    result.push({
      id: product.id,
      name: product.name || item.reference,
      priceHt: roundMoney(priceHt),
      priceTtc,
      taxRate,
      qty: item.qty,
      attributeId,
    });
  }

  return result;
}

export async function importFichier3(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[1]);
  const results: FichierImportResult[] = [];

  const carrierId = '1';
  const shippingCost = 0;

  for (let i = 0; i < rows.length; i++) {
    const [, nom, email, pwd, adresse, achat, etat] = rows[i];
    const label = `${nom} (${email})`;
    onProgress?.(i, rows.length, label);

    try {
      const customer = await resolveCustomer(nom, email, pwd);
      if (!customer) throw new Error(`Client "${email}" introuvable ou creation impossible`);

      const addressId = await ensureAddressForCustomer(customer, adresse ?? '');
      if (!addressId) throw new Error(`Adresse non creee pour ${email}`);

      const items = parseAchat(achat ?? '');
      const checkoutItems = await buildCheckoutItems(items);
      if (checkoutItems.length === 0) throw new Error('Aucun achat valide dans la ligne');

      const cartId = await createPSCart(customer.id, addressId, carrierId, checkoutItems);
      const orderId = await createPSOrder({
        customerId: customer.id,
        addressId,
        cartId,
        carrierId,
        items: checkoutItems,
        shippingCost,
      });
      await updateStockAfterOrder(checkoutItems);

      // Appliquer le statut PS basé sur le champ "etat" du CSV
      const psState = mapEtatToPSState(etat ?? '');
      if (psState !== null) {
        try {
          const statusXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order><![CDATA[${orderId}]]></id_order>
    <id_order_state><![CDATA[${psState}]]></id_order_state>
    <id_employee><![CDATA[1]]></id_employee>
  </order_history>
</prestashop>`;
          await api.post('/order_histories', statusXml);
        } catch (statusErr) {
          console.warn('Statut commande non appliqué:', orderId, statusErr);
        }
      }

      results.push({ label, success: true, id: orderId });
    } catch (err: any) {
      console.error('Import fichier3 failed', {
        label,
        error: err,
        response: err?.response?.data,
      });
      results.push({ label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length, label);
  }

  return results;
}

// ==========================================
// IMAGES ZIP
// ==========================================

export interface ImageImportResult {
  filename: string;
  reference: string;
  success: boolean;
  error?: string;
}

async function uploadImage(productId: string, blob: Blob, filename: string): Promise<void> {
  const formData = new FormData();
  formData.append('image', blob, filename);
  const res = await fetch(`/api/images/products/${productId}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(extractXmlError(text) || `HTTP ${res.status}`);
  }
}

export async function importImagesZip(
  file: File,
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<ImageImportResult[]> {
  const zip     = await JSZip.loadAsync(await file.arrayBuffer());
  const results: ImageImportResult[] = [];
  const entries = Object.entries(zip.files).filter(
    ([name, f]) => !f.dir && !name.startsWith('__MACOSX') && /\.(png|jpg|jpeg|webp|gif)$/i.test(name)
  );

  for (let i = 0; i < entries.length; i++) {
    const [path, zipFile] = entries[i];
    const filename  = path.split('/').pop() ?? path;
    const reference = filename.replace(/\.[^.]+$/, '');
    onProgress?.(i, entries.length, filename);

    try {
      const productId = await getProductIdByRef(reference);
      if (!productId) throw new Error(`Produit "${reference}" introuvable`);
      const blob = await zipFile.async('blob');
      await uploadImage(productId, blob, filename);
      results.push({ filename, reference, success: true });
    } catch (err: any) {
      console.error('Import images failed', {
        filename,
        reference,
        error: err,
      });
      results.push({ filename, reference, success: false, error: err.message });
    }
    onProgress?.(i + 1, entries.length, filename);
  }
  return results;
}

// ==========================================
// PRÉ-VALIDATION TRANSACTIONNELLE
// ==========================================

export type PrevalidateAllResult = {
  fichier1: FichierImportResult[];
  fichier2: FichierImportResult[];
  fichier3: FichierImportResult[];
  images: ImageImportResult[];
  hasErrors: boolean;
};

type PrevalidateCallbacks = {
  fichier1?: FichierProgressCallback;
  fichier2?: FichierProgressCallback;
  fichier3?: FichierProgressCallback;
  images?: (done: number, total: number, name: string) => void;
};

type PrevalidateContext = {
  productRefs: Set<string>;
  taxRateByRef: Map<string, number>;
  combinationRefs: Set<string>;
};

async function productExistsByRef(reference: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(reference)) return cache.get(reference)!;
  const exists = Boolean(await fetchProductByReference(reference));
  cache.set(reference, exists);
  return exists;
}

async function combinationExistsByRef(reference: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(reference)) return cache.get(reference)!;
  const exists = Boolean(await fetchCombinationByReference(reference));
  cache.set(reference, exists);
  return exists;
}

async function customerExistsByEmail(email: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(email)) return cache.get(email)!;
  const exists = Boolean(await findCustomerByEmail(email));
  cache.set(email, exists);
  return exists;
}

async function prevalidateFichier1Internal(
  file: File,
  onProgress: PrevalidateCallbacks['fichier1'],
  productExistsCache: Map<string, boolean>,
): Promise<{ results: FichierImportResult[]; context: PrevalidateContext }> {
  const lines = parseCsvContent(await file.text());
  const header = lines[0] ?? [];
  const cols = resolveFichier1Columns(header);
  const rows  = lines.slice(1).filter((r) => (r[cols.nomIdx] ?? '').trim() !== '');
  const results: FichierImportResult[] = [];
  const productRefs = new Set<string>();
  const taxRateByRef = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = row[cols.nomIdx] ?? '';
    const reference = row[cols.referenceIdx] ?? '';
    const dateValue = cols.dateIdx >= 0 ? (row[cols.dateIdx] ?? '') : '';
    const prix_ttc_str = row[cols.prixTtcIdx] ?? '';
    const taxe_str = row[cols.taxeIdx] ?? '';
    const prix_achat_str = row[cols.prixAchatIdx] ?? '';
    const label = `${nom} (${reference})`;
    onProgress?.(i, rows.length, label);

    const errors: string[] = [];
    if (!nom.trim()) errors.push('Nom manquant');
    if (!reference.trim()) errors.push('Reference manquante');
    if (dateValue.trim() && !parseDateFlexible(dateValue)) {
      errors.push('Date invalide');
    }

    const prixRaw = prix_ttc_str.trim();
    const prixParsed = prixRaw ? parseNumberStrict(prixRaw) : null;
    if (!prixRaw) errors.push('Prix TTC manquant');
    if (prixRaw && prixParsed == null) errors.push('Prix TTC invalide');

    const prixAchatRaw = prix_achat_str.trim();
    const prixAchatParsed = prixAchatRaw ? parseNumberStrict(prixAchatRaw) : null;
    if (prixAchatRaw && prixAchatParsed == null) errors.push('Prix achat invalide');

    const taxeRaw = taxe_str.trim();
    const taxeParsed = taxeRaw ? parseNumberStrict(taxeRaw) : null;
    if (taxeRaw && taxeParsed == null) errors.push('Taxe invalide');

    if (reference && productRefs.has(reference)) errors.push('Reference en double');

    if (errors.length === 0 && reference) {
      const exists = await productExistsByRef(reference, productExistsCache);
      if (exists) errors.push('Reference deja existante');
    }

    let taxRate = 0;
    if (taxeParsed != null) taxRate = Math.max(0, taxeParsed) / 100;

    if (errors.length === 0 && reference) {
      productRefs.add(reference);
      taxRateByRef.set(reference, taxRate);
      results.push({ label, success: true });
    } else {
      results.push({ label, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, rows.length, label);
  }

  return {
    results,
    context: { productRefs, taxRateByRef, combinationRefs: new Set() },
  };
}

async function prevalidateFichier2Internal(
  file: File,
  baseContext: PrevalidateContext,
  onProgress: PrevalidateCallbacks['fichier2'],
  productExistsCache: Map<string, boolean>,
  combinationExistsCache: Map<string, boolean>,
): Promise<{ results: FichierImportResult[]; combinationRefs: Set<string> }> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[0]);
  const results: FichierImportResult[] = [];
  const combinationRefs = new Set<string>();
  const seenCombRefs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const [reference, specificite, karazany, stock_str, prix_ttc_str] = rows[i];
    const label = `${reference}${karazany ? ' — ' + karazany : ''}`;
    onProgress?.(i, rows.length, label);

    const errors: string[] = [];
    if (!reference?.trim()) errors.push('Reference manquante');

    const stockRaw = (stock_str ?? '').trim();
    if (stockRaw) {
      const stockParsed = parseInt(stockRaw, 10);
      if (Number.isNaN(stockParsed)) errors.push('Stock invalide');
      if (!Number.isNaN(stockParsed) && stockParsed < 0) errors.push('Stock negatif');
    }

    const priceRaw = (prix_ttc_str ?? '').trim();
    if (priceRaw) {
      const priceParsed = parseNumberStrict(priceRaw);
      if (priceParsed == null) errors.push('Prix TTC invalide');
    }

    const hasSpecificite = Boolean(specificite?.trim());
    const hasKarazany = Boolean(karazany?.trim());
    if (hasSpecificite !== hasKarazany) {
      errors.push('Specificite et karazany doivent etre renseignes ensemble');
    }

    let combRef = '';
    if (hasSpecificite && hasKarazany && reference?.trim()) {
      combRef = buildCombinationReference(reference.trim(), karazany.trim());
      if (seenCombRefs.has(combRef)) errors.push('Declinaison en double');
      seenCombRefs.add(combRef);
      combinationRefs.add(combRef);
    }

    if (errors.length === 0 && reference?.trim()) {
      const ref = reference.trim();
      if (!baseContext.productRefs.has(ref)) {
        const exists = await productExistsByRef(ref, productExistsCache);
        if (!exists) errors.push(`Produit "${ref}" introuvable`);
      }
    }

    if (errors.length === 0 && combRef) {
      const exists = await combinationExistsByRef(combRef, combinationExistsCache);
      if (exists) errors.push(`Declinaison "${combRef}" deja existante`);
    }

    if (errors.length === 0) {
      results.push({ label, success: true });
    } else {
      results.push({ label, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, rows.length, label);
  }

  return { results, combinationRefs };
}

async function prevalidateFichier3Internal(
  file: File,
  baseContext: PrevalidateContext,
  onProgress: PrevalidateCallbacks['fichier3'],
  productExistsCache: Map<string, boolean>,
  combinationExistsCache: Map<string, boolean>,
  customerExistsCache: Map<string, boolean>,
): Promise<FichierImportResult[]> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[1]);
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const nom = rows[i][1] ?? '';
    const email = rows[i][2] ?? '';
    const pwd = rows[i][3] ?? '';
    const achat = rows[i][5] ?? '';
    const dateValue = rows[i][0] ?? '';
    const label = `${nom} (${email})`;
    onProgress?.(i, rows.length, label);

    const errors: string[] = [];
    const emailValue = (email ?? '').trim();
    if (!nom?.trim()) errors.push('Nom manquant');
    if (!emailValue) errors.push('Email manquant');
    if (emailValue && !/^\S+@\S+\.\S+$/.test(emailValue)) errors.push('Email invalide');
    if (dateValue.trim() && !parseDateFlexible(dateValue)) {
      errors.push('Date invalide');
    }

    if (emailValue && errors.length === 0) {
      const customerExists = await customerExistsByEmail(emailValue, customerExistsCache);
      if (!customerExists && !(pwd ?? '').trim()) {
        errors.push('Mot de passe manquant pour nouveau client');
      }
    }

    const items = parseAchat(achat ?? '');
    if (items.length === 0) errors.push('Aucun achat valide dans la ligne');

    for (const item of items) {
      if (!item.reference.trim()) {
        errors.push('Reference produit manquante');
        continue;
      }
      if (item.qty <= 0) errors.push(`Quantite invalide pour ${item.reference}`);

      const ref = item.reference.trim();
      if (!baseContext.productRefs.has(ref)) {
        const exists = await productExistsByRef(ref, productExistsCache);
        if (!exists) errors.push(`Produit "${ref}" introuvable`);
      }

      if (item.variant?.trim()) {
        const combRef = buildCombinationReference(ref, item.variant.trim());
        if (!baseContext.combinationRefs.has(combRef)) {
          const exists = await combinationExistsByRef(combRef, combinationExistsCache);
          if (!exists) errors.push(`Declinaison "${combRef}" introuvable`);
        }
      }
    }

    if (errors.length === 0) {
      results.push({ label, success: true });
    } else {
      results.push({ label, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, rows.length, label);
  }

  return results;
}

async function prevalidateImagesZipInternal(
  file: File,
  baseContext: PrevalidateContext,
  onProgress: PrevalidateCallbacks['images'],
  productExistsCache: Map<string, boolean>,
): Promise<ImageImportResult[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const results: ImageImportResult[] = [];
  const entries = Object.entries(zip.files).filter(
    ([name, f]) => !f.dir && !name.startsWith('__MACOSX') && /\.(png|jpg|jpeg|webp|gif)$/i.test(name)
  );

  if (entries.length === 0) {
    results.push({
      filename: 'Aucune image',
      reference: '',
      success: false,
      error: 'Archive vide ou sans image valide',
    });
    return results;
  }

  for (let i = 0; i < entries.length; i++) {
    const [path] = entries[i];
    const filename = path.split('/').pop() ?? path;
    const reference = filename.replace(/\.[^.]+$/, '');
    onProgress?.(i, entries.length, filename);

    const errors: string[] = [];
    if (!reference.trim()) errors.push('Nom de fichier invalide');

    if (reference.trim() && !baseContext.productRefs.has(reference)) {
      const exists = await productExistsByRef(reference, productExistsCache);
      if (!exists) errors.push(`Produit "${reference}" introuvable`);
    }

    if (errors.length === 0) {
      results.push({ filename, reference, success: true });
    } else {
      results.push({ filename, reference, success: false, error: errors.join(' | ') });
    }

    onProgress?.(i + 1, entries.length, filename);
  }

  return results;
}

export async function prevalidateFichiersImport(
  files: { fichier1: File; fichier2: File; fichier3: File; images: File },
  callbacks: PrevalidateCallbacks = {},
): Promise<PrevalidateAllResult> {
  const productExistsCache = new Map<string, boolean>();
  const combinationExistsCache = new Map<string, boolean>();
  const customerExistsCache = new Map<string, boolean>();

  const fichier1Result = await prevalidateFichier1Internal(
    files.fichier1,
    callbacks.fichier1,
    productExistsCache,
  );

  const fichier2Result = await prevalidateFichier2Internal(
    files.fichier2,
    fichier1Result.context,
    callbacks.fichier2,
    productExistsCache,
    combinationExistsCache,
  );

  const fullContext: PrevalidateContext = {
    productRefs: fichier1Result.context.productRefs,
    taxRateByRef: fichier1Result.context.taxRateByRef,
    combinationRefs: fichier2Result.combinationRefs,
  };

  const fichier3Results = await prevalidateFichier3Internal(
    files.fichier3,
    fullContext,
    callbacks.fichier3,
    productExistsCache,
    combinationExistsCache,
    customerExistsCache,
  );

  const imagesResults = await prevalidateImagesZipInternal(
    files.images,
    fullContext,
    callbacks.images,
    productExistsCache,
  );

  const hasErrors =
    fichier1Result.results.some((r) => !r.success)
    || fichier2Result.results.some((r) => !r.success)
    || fichier3Results.some((r) => !r.success)
    || imagesResults.some((r) => !r.success);

  return {
    fichier1: fichier1Result.results,
    fichier2: fichier2Result.results,
    fichier3: fichier3Results,
    images: imagesResults,
    hasErrors,
  };
}
```

---

### [orderService.ts](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/orderService.ts)

Supprimé entièrement :
- Types : `LocalOrderStatus`, `OrderItem`, `LocalOrder`, `AnyOrder`
- Constantes : `ALLOWED_LOCAL_STATUSES`, `LOCAL_KEY`
- Fonctions : `getLocalOrders()`, `saveLocalOrders()`, `addLocalOrders()`, `updateLocalOrderStatus()`, `clearLocalOrders()`, `localStatusLabel()`

Conservé : [PSOrder](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/orderService.ts#12-21), [fetchPSOrders()](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/orderService.ts#74-89), [updatePSOrderStatus()](file:///Users/apple/Documents/L3/S6/prestashop-app/src/services/orderService.ts#90-104), `PS_STATE_LABELS`, `ALLOWED_PS_STATES`

```diff:orderService.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ==========================================
// TYPES
// ==========================================

export type LocalOrderStatus = 'pending' | 'paid' | 'error' | 'cancelled';

export interface OrderItem {
  reference: string;
  qty: number;
  variant: string;
}

export interface LocalOrder {
  id: string;
  date: string;
  customerName: string;
  customerEmail: string;
  address: string;
  items: OrderItem[];
  status: LocalOrderStatus;
  totalTTC: number;
  source: 'local';
}

export interface PSOrder {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  totalPaid: number;
  date: string;
  currentState: number;
  source: 'prestashop';
}

export type AnyOrder = LocalOrder | PSOrder;

// Statuts PrestaShop (défauts)
export const PS_STATE_LABELS: Record<number, string> = {
  1:  'En attente de chèque',
  2:  'Paiement accepté',
  3:  'En préparation',
  4:  'Expédié',
  5:  'Livré',
  6:  'Annulé',
  7:  'Remboursé',
  8:  'Échec paiement',
  9:  'En rupture (payé)',
  10: 'En attente virement',
  11: 'Paiement à la livraison',
};

// Les 3 statuts modifiables demandés
export const ALLOWED_PS_STATES = [
  { label: 'Paiement effectué', value: 2 },
  { label: 'Échec paiement',    value: 8 },
  { label: 'Annulé',            value: 6 },
];

export const ALLOWED_LOCAL_STATUSES: { label: string; value: LocalOrderStatus }[] = [
  { label: 'Paiement effectué', value: 'paid'      },
  { label: 'Échec paiement',    value: 'error'     },
  { label: 'Annulé',            value: 'cancelled' },
];

export function localStatusLabel(s: LocalOrderStatus): string {
  const map: Record<LocalOrderStatus, string> = {
    pending:   'En attente',
    paid:      'Paiement effectué',
    error:     'Échec paiement',
    cancelled: 'Annulé',
  };
  return map[s] ?? s;
}

// ==========================================
// LOCAL ORDERS (localStorage)
// ==========================================

const LOCAL_KEY = 'ps_local_orders';

export function getLocalOrders(): LocalOrder[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as LocalOrder[];
  } catch { return []; }
}

export function saveLocalOrders(orders: LocalOrder[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(orders));
}

export function addLocalOrders(orders: LocalOrder[]): void {
  const existing = getLocalOrders();
  const merged   = [...existing, ...orders];
  saveLocalOrders(merged);
}

export function updateLocalOrderStatus(id: string, status: LocalOrderStatus): void {
  const orders = getLocalOrders().map((o) => o.id === id ? { ...o, status } : o);
  saveLocalOrders(orders);
}

export function clearLocalOrders(): void {
  localStorage.removeItem(LOCAL_KEY);
}

// ==========================================
// PRESTASHOP ORDERS
// ==========================================

function parseText(xmlString: string, selector: string): string {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  return doc.querySelector(selector)?.textContent?.trim() ?? '';
}

function parseOrdersXml(xmlString: string): Omit<PSOrder, 'customerName'>[] {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const orders: Omit<PSOrder, 'customerName'>[] = [];
  doc.querySelectorAll('order').forEach((el) => {
    const id         = el.querySelector('id')?.textContent?.trim() ?? '';
    const reference  = el.querySelector('reference')?.textContent?.trim() ?? '';
    const customerId = el.querySelector('id_customer')?.textContent?.trim() ?? '';
    const totalPaid  = parseFloat(el.querySelector('total_paid_tax_incl')?.textContent ?? '0');
    const date       = el.querySelector('date_add')?.textContent?.trim() ?? '';
    const state      = parseInt(el.querySelector('current_state')?.textContent ?? '0', 10);
    if (id) orders.push({ id, reference, customerId, totalPaid, date, currentState: state, source: 'prestashop' });
  });
  return orders;
}

async function fetchCustomerName(customerId: string): Promise<string> {
  try {
    const res = await api.get(`/customers/${customerId}?display=[firstname,lastname]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const first = doc.querySelector('firstname')?.textContent?.trim() ?? '';
    const last  = doc.querySelector('lastname')?.textContent?.trim()  ?? '';
    return `${first} ${last}`.trim() || `Client #${customerId}`;
  } catch { return `Client #${customerId}`; }
}

export async function fetchPSOrders(): Promise<PSOrder[]> {
  try {
    const res    = await api.get('/orders?display=full');
    const raw    = parseOrdersXml(res.data);
    const orders = await Promise.all(
      raw.map(async (o) => ({
        ...o,
        customerName: await fetchCustomerName(o.customerId),
      }))
    );
    return orders;
  } catch {
    return [];
  }
}

export async function updatePSOrderStatus(orderId: string, stateId: number): Promise<boolean> {
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order><![CDATA[${orderId}]]></id_order>
    <id_order_state><![CDATA[${stateId}]]></id_order_state>
    <id_employee><![CDATA[1]]></id_employee>
  </order_history>
</prestashop>`;
    await api.post('/order_histories', xml);
    return true;
  } catch { return false; }
}

// Extract text from PS order XML for the reference field
export { parseText };
===
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ==========================================
// TYPES
// ==========================================

export interface PSOrder {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  totalPaid: number;
  date: string;
  currentState: number;
}

// Statuts PrestaShop (défauts)
export const PS_STATE_LABELS: Record<number, string> = {
  1:  'En attente de chèque',
  2:  'Paiement accepté',
  3:  'En préparation',
  4:  'Expédié',
  5:  'Livré',
  6:  'Annulé',
  7:  'Remboursé',
  8:  'Échec paiement',
  9:  'En rupture (payé)',
  10: 'En attente virement',
  11: 'Paiement à la livraison',
  13: 'En attente COD',
};

// Les 3 statuts modifiables demandés
export const ALLOWED_PS_STATES = [
  { label: 'Paiement effectué', value: 2 },
  { label: 'Échec paiement',    value: 8 },
  { label: 'Annulé',            value: 6 },
];

// ==========================================
// PRESTASHOP ORDERS
// ==========================================

function parseOrdersXml(xmlString: string): Omit<PSOrder, 'customerName'>[] {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const orders: Omit<PSOrder, 'customerName'>[] = [];
  doc.querySelectorAll('order').forEach((el) => {
    const id         = el.querySelector('id')?.textContent?.trim() ?? '';
    const reference  = el.querySelector('reference')?.textContent?.trim() ?? '';
    const customerId = el.querySelector('id_customer')?.textContent?.trim() ?? '';
    const totalPaid  = parseFloat(el.querySelector('total_paid_tax_incl')?.textContent ?? '0');
    const date       = el.querySelector('date_add')?.textContent?.trim() ?? '';
    const state      = parseInt(el.querySelector('current_state')?.textContent ?? '0', 10);
    if (id) orders.push({ id, reference, customerId, totalPaid, date, currentState: state });
  });
  return orders;
}

async function fetchCustomerName(customerId: string): Promise<string> {
  try {
    const res = await api.get(`/customers/${customerId}?display=[firstname,lastname]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const first = doc.querySelector('firstname')?.textContent?.trim() ?? '';
    const last  = doc.querySelector('lastname')?.textContent?.trim()  ?? '';
    return `${first} ${last}`.trim() || `Client #${customerId}`;
  } catch { return `Client #${customerId}`; }
}

export async function fetchPSOrders(): Promise<PSOrder[]> {
  try {
    const res    = await api.get('/orders?display=full');
    const raw    = parseOrdersXml(res.data);
    const orders = await Promise.all(
      raw.map(async (o) => ({
        ...o,
        customerName: await fetchCustomerName(o.customerId),
      }))
    );
    return orders;
  } catch {
    return [];
  }
}

export async function updatePSOrderStatus(orderId: string, stateId: number): Promise<boolean> {
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order><![CDATA[${orderId}]]></id_order>
    <id_order_state><![CDATA[${stateId}]]></id_order_state>
    <id_employee><![CDATA[1]]></id_employee>
  </order_history>
</prestashop>`;
    await api.post('/order_histories', xml);
    return true;
  } catch { return false; }
}

```

---

### [OrderList.tsx](file:///Users/apple/Documents/L3/S6/prestashop-app/src/components/OrderList.tsx)

- Simplifié pour PS uniquement — supprimé colonne "Source", `AnyOrder`, branchements `source === 'local'`
- Le type est maintenant `PSOrder[]` directement

```diff:OrderList.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchPSOrders,
  getLocalOrders,
  updateLocalOrderStatus,
  updatePSOrderStatus,
  localStatusLabel,
  ALLOWED_PS_STATES,
  ALLOWED_LOCAL_STATUSES,
  PS_STATE_LABELS,
  type AnyOrder,
  type LocalOrder,
  type PSOrder,
  type LocalOrderStatus,
} from '../services/orderService';
import './OrderList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function psStatusLabel(state: number): string {
  return PS_STATE_LABELS[state] ?? `État ${state}`;
}

function orderStatusClass(order: AnyOrder): string {
  if (order.source === 'local') {
    const s = (order as LocalOrder).status;
    if (s === 'paid')      return 'status-badge--paid';
    if (s === 'error')     return 'status-badge--error';
    if (s === 'cancelled') return 'status-badge--cancelled';
    return 'status-badge--pending';
  }
  const state = (order as PSOrder).currentState;
  if (state === 2) return 'status-badge--paid';
  if (state === 8) return 'status-badge--error';
  if (state === 6) return 'status-badge--cancelled';
  return 'status-badge--default';
}

function orderLabel(order: AnyOrder): string {
  if (order.source === 'local') return localStatusLabel((order as LocalOrder).status);
  return psStatusLabel((order as PSOrder).currentState);
}

function orderId(order: AnyOrder): string {
  return order.source === 'local' ? `LOC-${order.id}` : `#${(order as PSOrder).reference || order.id}`;
}

function orderDate(order: AnyOrder): string {
  return formatDate(order.date);
}

function orderCustomer(order: AnyOrder): string {
  return order.source === 'local'
    ? (order as LocalOrder).customerName
    : (order as PSOrder).customerName;
}

function orderAmount(order: AnyOrder): string {
  return order.source === 'local'
    ? formatAmount((order as LocalOrder).totalTTC)
    : formatAmount((order as PSOrder).totalPaid);
}

// ── Composant ─────────────────────────────────────────────────────────────────

const OrderList: React.FC = () => {
  const [orders, setOrders]         = useState<AnyOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Sélection en attente de confirmation
  const [pendingChange, setPendingChange] = useState<{
    order: AnyOrder;
    newValue: string; // LocalOrderStatus | string(number) for PS
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ps, local] = await Promise.all([fetchPSOrders(), Promise.resolve(getLocalOrders())]);
      const all: AnyOrder[] = [
        ...ps,
        ...local,
      ];
      // Sort by date descending
      all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      setOrders(all);
    } catch (e) {
      setError('Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Quand l'utilisateur choisit un nouveau statut dans le select
  const handleSelectChange = (order: AnyOrder, newValue: string) => {
    setPendingChange({ order, newValue });
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    setApplying(true);
    const { order, newValue } = pendingChange;

    if (order.source === 'local') {
      updateLocalOrderStatus(order.id, newValue as LocalOrderStatus);
      setOrders((prev) =>
        prev.map((o) =>
          o.source === 'local' && o.id === order.id
            ? { ...o, status: newValue as LocalOrderStatus }
            : o
        )
      );
    } else {
      const ok = await updatePSOrderStatus(order.id, parseInt(newValue, 10));
      if (ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.source === 'prestashop' && o.id === order.id
              ? { ...o, currentState: parseInt(newValue, 10) }
              : o
          )
        );
      }
    }

    setApplying(false);
    setPendingChange(null);
  };

  const handleCancelChange = () => setPendingChange(null);

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="orders-page">
      {/* Confirmation modale */}
      {pendingChange && (
        <div className="orders-modal-overlay">
          <div className="orders-modal">
            <h3 className="orders-modal-title">Confirmer le changement</h3>
            <p className="orders-modal-text">
              Modifier le statut de la commande <strong>{orderId(pendingChange.order)}</strong> ?
            </p>
            <div className="orders-modal-actions">
              <button className="btn btn-secondary" onClick={handleCancelChange} disabled={applying}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleConfirmChange} disabled={applying}>
                {applying ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="orders-toolbar">
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
        <span className="orders-count">{orders.length} commande(s)</span>
      </div>

      {error && <p className="orders-error">{error}</p>}

      {loading && orders.length === 0 ? (
        <div className="orders-loading">Chargement des commandes…</div>
      ) : orders.length === 0 ? (
        <div className="orders-empty">Aucune commande trouvée.</div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>Client</th>
                <th>Montant TTC</th>
                <th>Date</th>
                <th>Source</th>
                <th>Statut</th>
                <th>Modifier</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const key = `${order.source}-${order.id}`;
                const allowedOptions = order.source === 'local'
                  ? ALLOWED_LOCAL_STATUSES.map((s) => ({ label: s.label, value: s.value }))
                  : ALLOWED_PS_STATES.map((s) => ({ label: s.label, value: String(s.value) }));

                const currentValue = order.source === 'local'
                  ? (order as LocalOrder).status
                  : String((order as PSOrder).currentState);

                return (
                  <tr key={key}>
                    <td className="orders-cell-ref">{orderId(order)}</td>
                    <td>{orderCustomer(order)}</td>
                    <td className="orders-cell-amount">{orderAmount(order)}</td>
                    <td>{orderDate(order)}</td>
                    <td>
                      <span className={`source-badge source-badge--${order.source}`}>
                        {order.source === 'local' ? 'Local' : 'PrestaShop'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${orderStatusClass(order)}`}>
                        {orderLabel(order)}
                      </span>
                    </td>
                    <td>
                      <select
                        className="orders-status-select"
                        value={currentValue}
                        onChange={(e) => handleSelectChange(order, e.target.value)}
                      >
                        {/* Option placeholder si statut courant n'est pas dans ALLOWED */}
                        {!allowedOptions.some((o) => String(o.value) === currentValue) && (
                          <option value={currentValue} disabled>
                            {orderLabel(order)}
                          </option>
                        )}
                        {allowedOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderList;
===
import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchPSOrders,
  updatePSOrderStatus,
  ALLOWED_PS_STATES,
  PS_STATE_LABELS,
  type PSOrder,
} from '../services/orderService';
import './OrderList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function psStatusLabel(state: number): string {
  return PS_STATE_LABELS[state] ?? `État ${state}`;
}

function orderStatusClass(state: number): string {
  if (state === 2) return 'status-badge--paid';
  if (state === 8) return 'status-badge--error';
  if (state === 6) return 'status-badge--cancelled';
  return 'status-badge--default';
}

// ── Composant ─────────────────────────────────────────────────────────────────

const OrderList: React.FC = () => {
  const [orders, setOrders]         = useState<PSOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Sélection en attente de confirmation
  const [pendingChange, setPendingChange] = useState<{
    order: PSOrder;
    newValue: number;
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ps = await fetchPSOrders();
      // Sort by date descending
      ps.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      setOrders(ps);
    } catch {
      setError('Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Quand l'utilisateur choisit un nouveau statut dans le select
  const handleSelectChange = (order: PSOrder, newValue: string) => {
    setPendingChange({ order, newValue: parseInt(newValue, 10) });
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    setApplying(true);
    const { order, newValue } = pendingChange;

    const ok = await updatePSOrderStatus(order.id, newValue);
    if (ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, currentState: newValue }
            : o
        )
      );
    }

    setApplying(false);
    setPendingChange(null);
  };

  const handleCancelChange = () => setPendingChange(null);

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="orders-page">
      {/* Confirmation modale */}
      {pendingChange && (
        <div className="orders-modal-overlay">
          <div className="orders-modal">
            <h3 className="orders-modal-title">Confirmer le changement</h3>
            <p className="orders-modal-text">
              Modifier le statut de la commande <strong>#{pendingChange.order.reference || pendingChange.order.id}</strong> ?
            </p>
            <div className="orders-modal-actions">
              <button className="btn btn-secondary" onClick={handleCancelChange} disabled={applying}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleConfirmChange} disabled={applying}>
                {applying ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="orders-toolbar">
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
        <span className="orders-count">{orders.length} commande(s)</span>
      </div>

      {error && <p className="orders-error">{error}</p>}

      {loading && orders.length === 0 ? (
        <div className="orders-loading">Chargement des commandes…</div>
      ) : orders.length === 0 ? (
        <div className="orders-empty">Aucune commande trouvée.</div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>Client</th>
                <th>Montant TTC</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Modifier</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const currentValue = String(order.currentState);

                return (
                  <tr key={order.id}>
                    <td className="orders-cell-ref">#{order.reference || order.id}</td>
                    <td>{order.customerName}</td>
                    <td className="orders-cell-amount">{formatAmount(order.totalPaid)}</td>
                    <td>{formatDate(order.date)}</td>
                    <td>
                      <span className={`status-badge ${orderStatusClass(order.currentState)}`}>
                        {psStatusLabel(order.currentState)}
                      </span>
                    </td>
                    <td>
                      <select
                        className="orders-status-select"
                        value={currentValue}
                        onChange={(e) => handleSelectChange(order, e.target.value)}
                      >
                        {/* Option placeholder si statut courant n'est pas dans ALLOWED */}
                        {!ALLOWED_PS_STATES.some((o) => String(o.value) === currentValue) && (
                          <option value={currentValue} disabled>
                            {psStatusLabel(order.currentState)}
                          </option>
                        )}
                        {ALLOWED_PS_STATES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderList;

```

---

### [DataReset.tsx](file:///Users/apple/Documents/L3/S6/prestashop-app/src/components/DataReset.tsx)

- Supprimé `import { clearLocalOrders }` et l'étape "Commandes locales"
- Supprimé les mentions "commandes locales" dans les textes UI

```diff:DataReset.tsx
import React, { useState } from 'react';
import {
  cleanCombinations,
  cleanProducts,
  cleanCategories,
  cleanCustomers,
  cleanAddresses,
  cleanSuppliers,
  cleanBrands,
  type CleanResult,
} from '../services/otherImportService';
import { clearLocalOrders } from '../services/orderService';
import './DataReset.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface StepResult {
  label: string;
  result: CleanResult | null;
  error?: string;
}

type ResetPhase = 'idle' | 'confirm' | 'running' | 'done';

// ── Étapes de suppression dans l'ordre correct ────────────────────────────────
const RESET_STEPS: Array<{
  label: string;
  run: (cb: (done: number, total: number) => void) => Promise<CleanResult>;
}> = [
  { label: 'Déclinaisons',  run: (cb) => cleanCombinations(cb) },
  { label: 'Produits',      run: (cb) => cleanProducts(cb) },
  { label: 'Catégories',    run: (cb) => cleanCategories(cb) },
  { label: 'Clients',       run: (cb) => cleanCustomers(cb) },
  { label: 'Adresses',      run: (cb) => cleanAddresses(cb) },
  { label: 'Fournisseurs',  run: (cb) => cleanSuppliers(cb) },
  { label: 'Marques',       run: (cb) => cleanBrands(cb) },
];

// ── Composant ─────────────────────────────────────────────────────────────────

const DataReset: React.FC = () => {
  const [phase, setPhase]           = useState<ResetPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0); // 0-100
  const [stepResults, setStepResults]   = useState<StepResult[]>([]);

  const totalSteps = RESET_STEPS.length + 1; // +1 for local orders

  const handleConfirm = () => setPhase('confirm');
  const handleCancel  = () => setPhase('idle');

  const handleReset = async () => {
    setPhase('running');
    setCurrentStep(0);
    setStepProgress(0);
    setStepResults([]);

    const results: StepResult[] = [];

    for (let i = 0; i < RESET_STEPS.length; i++) {
      const step = RESET_STEPS[i];
      setCurrentStep(i);
      setStepProgress(0);

      try {
        const res = await step.run((done, total) => {
          setStepProgress(total > 0 ? Math.round((done / total) * 100) : 0);
        });
        results.push({ label: step.label, result: res });
      } catch (err) {
        results.push({
          label: step.label,
          result: null,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }

      setStepResults([...results]);
    }

    // Dernière étape : commandes locales
    setCurrentStep(RESET_STEPS.length);
    setStepProgress(100);
    clearLocalOrders();
    results.push({ label: 'Commandes locales', result: { total: 0, deleted: 0, errors: 0 } });
    setStepResults([...results]);

    setPhase('done');
  };

  const handleRetry = () => {
    setPhase('idle');
    setStepResults([]);
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (phase === 'confirm') {
    return (
      <div className="reset-page">
        <div className="reset-confirm-card">
          <div className="reset-confirm-icon">!</div>
          <h2 className="reset-confirm-title">Confirmer la réinitialisation</h2>
          <p className="reset-confirm-text">
            Cette action va supprimer <strong>toutes les données</strong> de la boutique PrestaShop
            (produits, catégories, clients, adresses, fournisseurs, marques, déclinaisons)
            ainsi que les commandes locales. Elle est <strong>irréversible</strong>.
          </p>
          <div className="reset-confirm-actions">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Annuler
            </button>
            <button className="btn btn-danger-large" onClick={handleReset}>
              Oui, tout supprimer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    const globalPct = Math.round((currentStep / totalSteps) * 100);
    const currentLabel = currentStep < RESET_STEPS.length
      ? RESET_STEPS[currentStep].label
      : 'Commandes locales';

    return (
      <div className="reset-page">
        <div className="reset-running-card">
          <div className="reset-spinner" aria-hidden="true" />
          <h2 className="reset-running-title">Réinitialisation en cours…</h2>

          {/* Étape courante */}
          <div className="reset-step-info">
            <span className="reset-step-label">Suppression : <strong>{currentLabel}</strong></span>
            <div className="reset-progress-bar">
              <div className="reset-progress-fill" style={{ width: `${stepProgress}%` }} />
            </div>
            <span className="reset-step-pct">{stepProgress}%</span>
          </div>

          {/* Progression globale */}
          <div className="reset-global-info">
            <span className="reset-global-label">Étape {currentStep + 1} / {totalSteps}</span>
            <div className="reset-progress-bar reset-progress-bar--global">
              <div className="reset-progress-fill reset-progress-fill--global" style={{ width: `${globalPct}%` }} />
            </div>
          </div>

          {/* Étapes terminées */}
          {stepResults.length > 0 && (
            <div className="reset-steps-done">
              {stepResults.map((s) => (
                <div key={s.label} className={`reset-step-row${s.error ? ' reset-step-row--error' : ' reset-step-row--ok'}`}>
                  <span className="reset-step-dot">{s.error ? '✗' : '✓'}</span>
                  <span className="reset-step-name">{s.label}</span>
                  {s.result && (
                    <span className="reset-step-count">{s.result.deleted} supprimé(s)</span>
                  )}
                  {s.error && <span className="reset-step-err">{s.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const totalDeleted = stepResults.reduce((n, s) => n + (s.result?.deleted ?? 0), 0);
    const totalErrors  = stepResults.reduce((n, s) => n + (s.result?.errors ?? 0) + (s.error ? 1 : 0), 0);

    return (
      <div className="reset-page">
        <div className="reset-done-card">
          <div className={`reset-done-icon${totalErrors > 0 ? ' reset-done-icon--warn' : ''}`}>
            {totalErrors > 0 ? '!' : '✓'}
          </div>
          <h2 className="reset-done-title">
            {totalErrors > 0 ? 'Réinitialisation partielle' : 'Réinitialisation terminée'}
          </h2>

          <div className="reset-done-stats">
            <div className="reset-done-stat reset-done-stat--ok">
              <span className="reset-done-stat-value">{totalDeleted}</span>
              <span className="reset-done-stat-label">Éléments supprimés</span>
            </div>
            {totalErrors > 0 && (
              <div className="reset-done-stat reset-done-stat--err">
                <span className="reset-done-stat-value">{totalErrors}</span>
                <span className="reset-done-stat-label">Erreurs</span>
              </div>
            )}
          </div>

          <div className="reset-steps-done">
            {stepResults.map((s) => (
              <div key={s.label} className={`reset-step-row${s.error ? ' reset-step-row--error' : ' reset-step-row--ok'}`}>
                <span className="reset-step-dot">{s.error ? '✗' : '✓'}</span>
                <span className="reset-step-name">{s.label}</span>
                {s.result && (
                  <span className="reset-step-count">{s.result.deleted} supprimé(s)</span>
                )}
                {s.error && <span className="reset-step-err">{s.error}</span>}
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={handleRetry}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  // ── Phase idle ───────────────────────────────────────────────────────────────
  return (
    <div className="reset-page">
      <div className="reset-idle-card">
        <div className="reset-warning-banner">
          <span className="reset-warning-icon">!</span>
          <div>
            <p className="reset-warning-title">Zone de danger</p>
            <p className="reset-warning-text">
              Cette opération supprime toutes les données de la boutique : produits, catégories,
              clients, adresses, fournisseurs, marques et déclinaisons. Les commandes locales sont
              également effacées. Cette action est <strong>irréversible</strong>.
            </p>
          </div>
        </div>

        <div className="reset-entity-list">
          <h3 className="reset-entity-title">Données qui seront supprimées</h3>
          <ul className="reset-entity-items">
            {RESET_STEPS.map((s) => (
              <li key={s.label} className="reset-entity-item">
                <span className="reset-entity-dot" />
                {s.label}
              </li>
            ))}
            <li className="reset-entity-item">
              <span className="reset-entity-dot" />
              Commandes locales (localStorage)
            </li>
          </ul>
        </div>

        <button className="btn btn-danger-large" onClick={handleConfirm}>
          Réinitialiser toutes les données
        </button>
      </div>
    </div>
  );
};

export default DataReset;
===
import React, { useState } from 'react';
import {
  cleanCombinations,
  cleanProducts,
  cleanCategories,
  cleanCustomers,
  cleanAddresses,
  cleanSuppliers,
  cleanBrands,
  type CleanResult,
} from '../services/otherImportService';
import './DataReset.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface StepResult {
  label: string;
  result: CleanResult | null;
  error?: string;
}

type ResetPhase = 'idle' | 'confirm' | 'running' | 'done';

// ── Étapes de suppression dans l'ordre correct ────────────────────────────────
const RESET_STEPS: Array<{
  label: string;
  run: (cb: (done: number, total: number) => void) => Promise<CleanResult>;
}> = [
  { label: 'Déclinaisons',  run: (cb) => cleanCombinations(cb) },
  { label: 'Produits',      run: (cb) => cleanProducts(cb) },
  { label: 'Catégories',    run: (cb) => cleanCategories(cb) },
  { label: 'Clients',       run: (cb) => cleanCustomers(cb) },
  { label: 'Adresses',      run: (cb) => cleanAddresses(cb) },
  { label: 'Fournisseurs',  run: (cb) => cleanSuppliers(cb) },
  { label: 'Marques',       run: (cb) => cleanBrands(cb) },
];

// ── Composant ─────────────────────────────────────────────────────────────────

const DataReset: React.FC = () => {
  const [phase, setPhase]           = useState<ResetPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0); // 0-100
  const [stepResults, setStepResults]   = useState<StepResult[]>([]);

  const totalSteps = RESET_STEPS.length;

  const handleConfirm = () => setPhase('confirm');
  const handleCancel  = () => setPhase('idle');

  const handleReset = async () => {
    setPhase('running');
    setCurrentStep(0);
    setStepProgress(0);
    setStepResults([]);

    const results: StepResult[] = [];

    for (let i = 0; i < RESET_STEPS.length; i++) {
      const step = RESET_STEPS[i];
      setCurrentStep(i);
      setStepProgress(0);

      try {
        const res = await step.run((done, total) => {
          setStepProgress(total > 0 ? Math.round((done / total) * 100) : 0);
        });
        results.push({ label: step.label, result: res });
      } catch (err) {
        results.push({
          label: step.label,
          result: null,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }

      setStepResults([...results]);
    }

    setPhase('done');
  };

  const handleRetry = () => {
    setPhase('idle');
    setStepResults([]);
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (phase === 'confirm') {
    return (
      <div className="reset-page">
        <div className="reset-confirm-card">
          <div className="reset-confirm-icon">!</div>
          <h2 className="reset-confirm-title">Confirmer la réinitialisation</h2>
          <p className="reset-confirm-text">
            Cette action va supprimer <strong>toutes les données</strong> de la boutique PrestaShop
            (produits, catégories, clients, adresses, fournisseurs, marques, déclinaisons).
            Elle est <strong>irréversible</strong>.
          </p>
          <div className="reset-confirm-actions">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Annuler
            </button>
            <button className="btn btn-danger-large" onClick={handleReset}>
              Oui, tout supprimer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    const globalPct = Math.round((currentStep / totalSteps) * 100);
    const currentLabel = RESET_STEPS[currentStep]?.label ?? '…';

    return (
      <div className="reset-page">
        <div className="reset-running-card">
          <div className="reset-spinner" aria-hidden="true" />
          <h2 className="reset-running-title">Réinitialisation en cours…</h2>

          {/* Étape courante */}
          <div className="reset-step-info">
            <span className="reset-step-label">Suppression : <strong>{currentLabel}</strong></span>
            <div className="reset-progress-bar">
              <div className="reset-progress-fill" style={{ width: `${stepProgress}%` }} />
            </div>
            <span className="reset-step-pct">{stepProgress}%</span>
          </div>

          {/* Progression globale */}
          <div className="reset-global-info">
            <span className="reset-global-label">Étape {currentStep + 1} / {totalSteps}</span>
            <div className="reset-progress-bar reset-progress-bar--global">
              <div className="reset-progress-fill reset-progress-fill--global" style={{ width: `${globalPct}%` }} />
            </div>
          </div>

          {/* Étapes terminées */}
          {stepResults.length > 0 && (
            <div className="reset-steps-done">
              {stepResults.map((s) => (
                <div key={s.label} className={`reset-step-row${s.error ? ' reset-step-row--error' : ' reset-step-row--ok'}`}>
                  <span className="reset-step-dot">{s.error ? '✗' : '✓'}</span>
                  <span className="reset-step-name">{s.label}</span>
                  {s.result && (
                    <span className="reset-step-count">{s.result.deleted} supprimé(s)</span>
                  )}
                  {s.error && <span className="reset-step-err">{s.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const totalDeleted = stepResults.reduce((n, s) => n + (s.result?.deleted ?? 0), 0);
    const totalErrors  = stepResults.reduce((n, s) => n + (s.result?.errors ?? 0) + (s.error ? 1 : 0), 0);

    return (
      <div className="reset-page">
        <div className="reset-done-card">
          <div className={`reset-done-icon${totalErrors > 0 ? ' reset-done-icon--warn' : ''}`}>
            {totalErrors > 0 ? '!' : '✓'}
          </div>
          <h2 className="reset-done-title">
            {totalErrors > 0 ? 'Réinitialisation partielle' : 'Réinitialisation terminée'}
          </h2>

          <div className="reset-done-stats">
            <div className="reset-done-stat reset-done-stat--ok">
              <span className="reset-done-stat-value">{totalDeleted}</span>
              <span className="reset-done-stat-label">Éléments supprimés</span>
            </div>
            {totalErrors > 0 && (
              <div className="reset-done-stat reset-done-stat--err">
                <span className="reset-done-stat-value">{totalErrors}</span>
                <span className="reset-done-stat-label">Erreurs</span>
              </div>
            )}
          </div>

          <div className="reset-steps-done">
            {stepResults.map((s) => (
              <div key={s.label} className={`reset-step-row${s.error ? ' reset-step-row--error' : ' reset-step-row--ok'}`}>
                <span className="reset-step-dot">{s.error ? '✗' : '✓'}</span>
                <span className="reset-step-name">{s.label}</span>
                {s.result && (
                  <span className="reset-step-count">{s.result.deleted} supprimé(s)</span>
                )}
                {s.error && <span className="reset-step-err">{s.error}</span>}
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={handleRetry}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  // ── Phase idle ───────────────────────────────────────────────────────────────
  return (
    <div className="reset-page">
      <div className="reset-idle-card">
        <div className="reset-warning-banner">
          <span className="reset-warning-icon">!</span>
          <div>
            <p className="reset-warning-title">Zone de danger</p>
            <p className="reset-warning-text">
              Cette opération supprime toutes les données de la boutique : produits, catégories,
              clients, adresses, fournisseurs, marques et déclinaisons.
              Cette action est <strong>irréversible</strong>.
            </p>
          </div>
        </div>

        <div className="reset-entity-list">
          <h3 className="reset-entity-title">Données qui seront supprimées</h3>
          <ul className="reset-entity-items">
            {RESET_STEPS.map((s) => (
              <li key={s.label} className="reset-entity-item">
                <span className="reset-entity-dot" />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <button className="btn btn-danger-large" onClick={handleConfirm}>
          Réinitialiser toutes les données
        </button>
      </div>
    </div>
  );
};

export default DataReset;
```

---

### [ImportAudit.tsx](file:///Users/apple/Documents/L3/S6/prestashop-app/src/components/ImportAudit.tsx)

- Supprimé `import { getLocalOrders, type LocalOrder }`
- Supprimé l'état `localOrders`, son loading, son `Promise.allSettled` entry, et la section UI complète

```diff:ImportAudit.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchProductsSample,
  fetchCategoriesSample,
  fetchCustomersSample,
  fetchAddressesSample,
  fetchSuppliersSample,
  fetchBrandsSample,
  fetchCombinationsSample,
  fetchStockSample,
  fetchTaxesSample,
  fetchTaxRuleGroupsSample,
  fetchTaxRulesSample,
  type ProductAudit,
  type CategoryAudit,
  type CustomerAudit,
  type AddressAudit,
  type SupplierAudit,
  type BrandAudit,
  type CombinationAudit,
  type StockAudit,
  type TaxAudit,
  type TaxRuleGroupAudit,
  type TaxRuleAudit,
} from '../services/importAuditService';
import { getLocalOrders, type LocalOrder } from '../services/orderService';
import './ImportAudit.css';

type SectionState<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

const DEFAULT_STATE = { items: [], loading: true, error: null } as const;

const ImportAudit: React.FC = () => {
  const [products, setProducts] = useState<SectionState<ProductAudit>>(DEFAULT_STATE);
  const [categories, setCategories] = useState<SectionState<CategoryAudit>>(DEFAULT_STATE);
  const [customers, setCustomers] = useState<SectionState<CustomerAudit>>(DEFAULT_STATE);
  const [addresses, setAddresses] = useState<SectionState<AddressAudit>>(DEFAULT_STATE);
  const [suppliers, setSuppliers] = useState<SectionState<SupplierAudit>>(DEFAULT_STATE);
  const [brands, setBrands] = useState<SectionState<BrandAudit>>(DEFAULT_STATE);
  const [combinations, setCombinations] = useState<SectionState<CombinationAudit>>(DEFAULT_STATE);
  const [stocks, setStocks] = useState<SectionState<StockAudit>>(DEFAULT_STATE);
  const [taxes, setTaxes] = useState<SectionState<TaxAudit>>(DEFAULT_STATE);
  const [taxGroups, setTaxGroups] = useState<SectionState<TaxRuleGroupAudit>>(DEFAULT_STATE);
  const [taxRules, setTaxRules] = useState<SectionState<TaxRuleAudit>>(DEFAULT_STATE);
  const [localOrders, setLocalOrders] = useState<SectionState<LocalOrder>>(DEFAULT_STATE);

  const loadAll = useCallback(async () => {
    setProducts((p) => ({ ...p, loading: true, error: null }));
    setCategories((p) => ({ ...p, loading: true, error: null }));
    setCustomers((p) => ({ ...p, loading: true, error: null }));
    setAddresses((p) => ({ ...p, loading: true, error: null }));
    setSuppliers((p) => ({ ...p, loading: true, error: null }));
    setBrands((p) => ({ ...p, loading: true, error: null }));
    setCombinations((p) => ({ ...p, loading: true, error: null }));
    setStocks((p) => ({ ...p, loading: true, error: null }));
    setTaxes((p) => ({ ...p, loading: true, error: null }));
    setTaxGroups((p) => ({ ...p, loading: true, error: null }));
    setTaxRules((p) => ({ ...p, loading: true, error: null }));
    setLocalOrders((p) => ({ ...p, loading: true, error: null }));

    const tasks = await Promise.allSettled([
      fetchProductsSample(),
      fetchCategoriesSample(),
      fetchCustomersSample(),
      fetchAddressesSample(),
      fetchSuppliersSample(),
      fetchBrandsSample(),
      fetchCombinationsSample(),
      fetchStockSample(),
      fetchTaxesSample(),
      fetchTaxRuleGroupsSample(),
      fetchTaxRulesSample(),
      Promise.resolve(getLocalOrders()),
    ]);

    const applyResult = <T,>(
      result: PromiseSettledResult<T[]>,
      setter: React.Dispatch<React.SetStateAction<SectionState<T>>>
    ) => {
      if (result.status === 'fulfilled') {
        setter({ items: result.value, loading: false, error: null });
      } else {
        setter({ items: [], loading: false, error: result.reason?.message ?? 'Erreur' });
      }
    };

    applyResult(tasks[0] as PromiseSettledResult<ProductAudit[]>, setProducts);
    applyResult(tasks[1] as PromiseSettledResult<CategoryAudit[]>, setCategories);
    applyResult(tasks[2] as PromiseSettledResult<CustomerAudit[]>, setCustomers);
    applyResult(tasks[3] as PromiseSettledResult<AddressAudit[]>, setAddresses);
    applyResult(tasks[4] as PromiseSettledResult<SupplierAudit[]>, setSuppliers);
    applyResult(tasks[5] as PromiseSettledResult<BrandAudit[]>, setBrands);
    applyResult(tasks[6] as PromiseSettledResult<CombinationAudit[]>, setCombinations);
    applyResult(tasks[7] as PromiseSettledResult<StockAudit[]>, setStocks);
    applyResult(tasks[8] as PromiseSettledResult<TaxAudit[]>, setTaxes);
    applyResult(tasks[9] as PromiseSettledResult<TaxRuleGroupAudit[]>, setTaxGroups);
    applyResult(tasks[10] as PromiseSettledResult<TaxRuleAudit[]>, setTaxRules);
    applyResult(tasks[11] as PromiseSettledResult<LocalOrder[]>, setLocalOrders);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const renderHeader = (title: string, count: number, loading: boolean) => (
    <div className="audit-section-header">
      <h2 className="audit-section-title">{title}</h2>
      <span className="audit-count">{loading ? '...' : count}</span>
    </div>
  );

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1 className="audit-title">Audit import</h1>
          <p className="audit-subtitle">Verifier les donnees importees (extraits recents).</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll}>
          Actualiser
        </button>
      </div>

      <section className="audit-section">
        {renderHeader('Produits', products.items.length, products.loading)}
        {products.error && <p className="audit-error">{products.error}</p>}
        {!products.loading && products.items.length === 0 && !products.error && (
          <p className="audit-empty">Aucun produit.</p>
        )}
        {products.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Reference</th>
                  <th>Prix HT</th>
                  <th>Taxe</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {products.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.reference}</td>
                    <td>{p.priceHt}</td>
                    <td>{p.taxRulesGroupId}</td>
                    <td>{p.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Declinaisons', combinations.items.length, combinations.loading)}
        {combinations.error && <p className="audit-error">{combinations.error}</p>}
        {!combinations.loading && combinations.items.length === 0 && !combinations.error && (
          <p className="audit-empty">Aucune declinaison.</p>
        )}
        {combinations.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID Produit</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {combinations.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.productId}</td>
                    <td>{c.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Stock', stocks.items.length, stocks.loading)}
        {stocks.error && <p className="audit-error">{stocks.error}</p>}
        {!stocks.loading && stocks.items.length === 0 && !stocks.error && (
          <p className="audit-empty">Aucun stock.</p>
        )}
        {stocks.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID Produit</th>
                  <th>Quantite</th>
                </tr>
              </thead>
              <tbody>
                {stocks.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.productId}</td>
                    <td>{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Categories', categories.items.length, categories.loading)}
        {categories.error && <p className="audit-error">{categories.error}</p>}
        {!categories.loading && categories.items.length === 0 && !categories.error && (
          <p className="audit-empty">Aucune categorie.</p>
        )}
        {categories.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {categories.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Clients', customers.items.length, customers.loading)}
        {customers.error && <p className="audit-error">{customers.error}</p>}
        {!customers.loading && customers.items.length === 0 && !customers.error && (
          <p className="audit-empty">Aucun client.</p>
        )}
        {customers.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Prenom</th>
                  <th>Nom</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {customers.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.firstname}</td>
                    <td>{c.lastname}</td>
                    <td>{c.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Adresses', addresses.items.length, addresses.loading)}
        {addresses.error && <p className="audit-error">{addresses.error}</p>}
        {!addresses.loading && addresses.items.length === 0 && !addresses.error && (
          <p className="audit-empty">Aucune adresse.</p>
        )}
        {addresses.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Alias</th>
                  <th>Ville</th>
                  <th>Code postal</th>
                  <th>Pays</th>
                  <th>Client</th>
                </tr>
              </thead>
              <tbody>
                {addresses.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.alias}</td>
                    <td>{a.city}</td>
                    <td>{a.postcode}</td>
                    <td>{a.countryId}</td>
                    <td>{a.customerId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Fournisseurs', suppliers.items.length, suppliers.loading)}
        {suppliers.error && <p className="audit-error">{suppliers.error}</p>}
        {!suppliers.loading && suppliers.items.length === 0 && !suppliers.error && (
          <p className="audit-empty">Aucun fournisseur.</p>
        )}
        {suppliers.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Marques', brands.items.length, brands.loading)}
        {brands.error && <p className="audit-error">{brands.error}</p>}
        {!brands.loading && brands.items.length === 0 && !brands.error && (
          <p className="audit-empty">Aucune marque.</p>
        )}
        {brands.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {brands.items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Taxes', taxes.items.length, taxes.loading)}
        {taxes.error && <p className="audit-error">{taxes.error}</p>}
        {!taxes.loading && taxes.items.length === 0 && !taxes.error && (
          <p className="audit-empty">Aucune taxe.</p>
        )}
        {taxes.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {taxes.items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.name}</td>
                    <td>{t.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Groupes de taxe', taxGroups.items.length, taxGroups.loading)}
        {taxGroups.error && <p className="audit-error">{taxGroups.error}</p>}
        {!taxGroups.loading && taxGroups.items.length === 0 && !taxGroups.error && (
          <p className="audit-empty">Aucun groupe de taxe.</p>
        )}
        {taxGroups.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {taxGroups.items.map((g) => (
                  <tr key={g.id}>
                    <td>{g.id}</td>
                    <td>{g.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Regles de taxe', taxRules.items.length, taxRules.loading)}
        {taxRules.error && <p className="audit-error">{taxRules.error}</p>}
        {!taxRules.loading && taxRules.items.length === 0 && !taxRules.error && (
          <p className="audit-empty">Aucune regle de taxe.</p>
        )}
        {taxRules.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Groupe</th>
                  <th>Taxe</th>
                  <th>Pays</th>
                </tr>
              </thead>
              <tbody>
                {taxRules.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.groupId}</td>
                    <td>{r.taxId}</td>
                    <td>{r.countryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Commandes locales', localOrders.items.length, localOrders.loading)}
        {localOrders.error && <p className="audit-error">{localOrders.error}</p>}
        {!localOrders.loading && localOrders.items.length === 0 && !localOrders.error && (
          <p className="audit-empty">Aucune commande locale.</p>
        )}
        {localOrders.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Email</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {localOrders.items.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.date}</td>
                    <td>{o.customerName}</td>
                    <td>{o.customerEmail}</td>
                    <td>{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ImportAudit;
===
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchProductsSample,
  fetchCategoriesSample,
  fetchCustomersSample,
  fetchAddressesSample,
  fetchSuppliersSample,
  fetchBrandsSample,
  fetchCombinationsSample,
  fetchStockSample,
  fetchTaxesSample,
  fetchTaxRuleGroupsSample,
  fetchTaxRulesSample,
  type ProductAudit,
  type CategoryAudit,
  type CustomerAudit,
  type AddressAudit,
  type SupplierAudit,
  type BrandAudit,
  type CombinationAudit,
  type StockAudit,
  type TaxAudit,
  type TaxRuleGroupAudit,
  type TaxRuleAudit,
} from '../services/importAuditService';
import './ImportAudit.css';

type SectionState<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

const DEFAULT_STATE = { items: [], loading: true, error: null } as const;

const ImportAudit: React.FC = () => {
  const [products, setProducts] = useState<SectionState<ProductAudit>>(DEFAULT_STATE);
  const [categories, setCategories] = useState<SectionState<CategoryAudit>>(DEFAULT_STATE);
  const [customers, setCustomers] = useState<SectionState<CustomerAudit>>(DEFAULT_STATE);
  const [addresses, setAddresses] = useState<SectionState<AddressAudit>>(DEFAULT_STATE);
  const [suppliers, setSuppliers] = useState<SectionState<SupplierAudit>>(DEFAULT_STATE);
  const [brands, setBrands] = useState<SectionState<BrandAudit>>(DEFAULT_STATE);
  const [combinations, setCombinations] = useState<SectionState<CombinationAudit>>(DEFAULT_STATE);
  const [stocks, setStocks] = useState<SectionState<StockAudit>>(DEFAULT_STATE);
  const [taxes, setTaxes] = useState<SectionState<TaxAudit>>(DEFAULT_STATE);
  const [taxGroups, setTaxGroups] = useState<SectionState<TaxRuleGroupAudit>>(DEFAULT_STATE);
  const [taxRules, setTaxRules] = useState<SectionState<TaxRuleAudit>>(DEFAULT_STATE);

  const loadAll = useCallback(async () => {
    setProducts((p) => ({ ...p, loading: true, error: null }));
    setCategories((p) => ({ ...p, loading: true, error: null }));
    setCustomers((p) => ({ ...p, loading: true, error: null }));
    setAddresses((p) => ({ ...p, loading: true, error: null }));
    setSuppliers((p) => ({ ...p, loading: true, error: null }));
    setBrands((p) => ({ ...p, loading: true, error: null }));
    setCombinations((p) => ({ ...p, loading: true, error: null }));
    setStocks((p) => ({ ...p, loading: true, error: null }));
    setTaxes((p) => ({ ...p, loading: true, error: null }));
    setTaxGroups((p) => ({ ...p, loading: true, error: null }));
    setTaxRules((p) => ({ ...p, loading: true, error: null }));

    const tasks = await Promise.allSettled([
      fetchProductsSample(),
      fetchCategoriesSample(),
      fetchCustomersSample(),
      fetchAddressesSample(),
      fetchSuppliersSample(),
      fetchBrandsSample(),
      fetchCombinationsSample(),
      fetchStockSample(),
      fetchTaxesSample(),
      fetchTaxRuleGroupsSample(),
      fetchTaxRulesSample(),
    ]);

    const applyResult = <T,>(
      result: PromiseSettledResult<T[]>,
      setter: React.Dispatch<React.SetStateAction<SectionState<T>>>
    ) => {
      if (result.status === 'fulfilled') {
        setter({ items: result.value, loading: false, error: null });
      } else {
        setter({ items: [], loading: false, error: result.reason?.message ?? 'Erreur' });
      }
    };

    applyResult(tasks[0] as PromiseSettledResult<ProductAudit[]>, setProducts);
    applyResult(tasks[1] as PromiseSettledResult<CategoryAudit[]>, setCategories);
    applyResult(tasks[2] as PromiseSettledResult<CustomerAudit[]>, setCustomers);
    applyResult(tasks[3] as PromiseSettledResult<AddressAudit[]>, setAddresses);
    applyResult(tasks[4] as PromiseSettledResult<SupplierAudit[]>, setSuppliers);
    applyResult(tasks[5] as PromiseSettledResult<BrandAudit[]>, setBrands);
    applyResult(tasks[6] as PromiseSettledResult<CombinationAudit[]>, setCombinations);
    applyResult(tasks[7] as PromiseSettledResult<StockAudit[]>, setStocks);
    applyResult(tasks[8] as PromiseSettledResult<TaxAudit[]>, setTaxes);
    applyResult(tasks[9] as PromiseSettledResult<TaxRuleGroupAudit[]>, setTaxGroups);
    applyResult(tasks[10] as PromiseSettledResult<TaxRuleAudit[]>, setTaxRules);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const renderHeader = (title: string, count: number, loading: boolean) => (
    <div className="audit-section-header">
      <h2 className="audit-section-title">{title}</h2>
      <span className="audit-count">{loading ? '...' : count}</span>
    </div>
  );

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1 className="audit-title">Audit import</h1>
          <p className="audit-subtitle">Verifier les donnees importees (extraits recents).</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll}>
          Actualiser
        </button>
      </div>

      <section className="audit-section">
        {renderHeader('Produits', products.items.length, products.loading)}
        {products.error && <p className="audit-error">{products.error}</p>}
        {!products.loading && products.items.length === 0 && !products.error && (
          <p className="audit-empty">Aucun produit.</p>
        )}
        {products.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Reference</th>
                  <th>Prix HT</th>
                  <th>Taxe</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {products.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.reference}</td>
                    <td>{p.priceHt}</td>
                    <td>{p.taxRulesGroupId}</td>
                    <td>{p.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Declinaisons', combinations.items.length, combinations.loading)}
        {combinations.error && <p className="audit-error">{combinations.error}</p>}
        {!combinations.loading && combinations.items.length === 0 && !combinations.error && (
          <p className="audit-empty">Aucune declinaison.</p>
        )}
        {combinations.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID Produit</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {combinations.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.productId}</td>
                    <td>{c.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Stock', stocks.items.length, stocks.loading)}
        {stocks.error && <p className="audit-error">{stocks.error}</p>}
        {!stocks.loading && stocks.items.length === 0 && !stocks.error && (
          <p className="audit-empty">Aucun stock.</p>
        )}
        {stocks.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID Produit</th>
                  <th>Quantite</th>
                </tr>
              </thead>
              <tbody>
                {stocks.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.productId}</td>
                    <td>{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Categories', categories.items.length, categories.loading)}
        {categories.error && <p className="audit-error">{categories.error}</p>}
        {!categories.loading && categories.items.length === 0 && !categories.error && (
          <p className="audit-empty">Aucune categorie.</p>
        )}
        {categories.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {categories.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Clients', customers.items.length, customers.loading)}
        {customers.error && <p className="audit-error">{customers.error}</p>}
        {!customers.loading && customers.items.length === 0 && !customers.error && (
          <p className="audit-empty">Aucun client.</p>
        )}
        {customers.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Prenom</th>
                  <th>Nom</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {customers.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.firstname}</td>
                    <td>{c.lastname}</td>
                    <td>{c.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Adresses', addresses.items.length, addresses.loading)}
        {addresses.error && <p className="audit-error">{addresses.error}</p>}
        {!addresses.loading && addresses.items.length === 0 && !addresses.error && (
          <p className="audit-empty">Aucune adresse.</p>
        )}
        {addresses.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Alias</th>
                  <th>Ville</th>
                  <th>Code postal</th>
                  <th>Pays</th>
                  <th>Client</th>
                </tr>
              </thead>
              <tbody>
                {addresses.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.alias}</td>
                    <td>{a.city}</td>
                    <td>{a.postcode}</td>
                    <td>{a.countryId}</td>
                    <td>{a.customerId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Fournisseurs', suppliers.items.length, suppliers.loading)}
        {suppliers.error && <p className="audit-error">{suppliers.error}</p>}
        {!suppliers.loading && suppliers.items.length === 0 && !suppliers.error && (
          <p className="audit-empty">Aucun fournisseur.</p>
        )}
        {suppliers.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Marques', brands.items.length, brands.loading)}
        {brands.error && <p className="audit-error">{brands.error}</p>}
        {!brands.loading && brands.items.length === 0 && !brands.error && (
          <p className="audit-empty">Aucune marque.</p>
        )}
        {brands.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {brands.items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Taxes', taxes.items.length, taxes.loading)}
        {taxes.error && <p className="audit-error">{taxes.error}</p>}
        {!taxes.loading && taxes.items.length === 0 && !taxes.error && (
          <p className="audit-empty">Aucune taxe.</p>
        )}
        {taxes.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {taxes.items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.name}</td>
                    <td>{t.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Groupes de taxe', taxGroups.items.length, taxGroups.loading)}
        {taxGroups.error && <p className="audit-error">{taxGroups.error}</p>}
        {!taxGroups.loading && taxGroups.items.length === 0 && !taxGroups.error && (
          <p className="audit-empty">Aucun groupe de taxe.</p>
        )}
        {taxGroups.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {taxGroups.items.map((g) => (
                  <tr key={g.id}>
                    <td>{g.id}</td>
                    <td>{g.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Regles de taxe', taxRules.items.length, taxRules.loading)}
        {taxRules.error && <p className="audit-error">{taxRules.error}</p>}
        {!taxRules.loading && taxRules.items.length === 0 && !taxRules.error && (
          <p className="audit-empty">Aucune regle de taxe.</p>
        )}
        {taxRules.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Groupe</th>
                  <th>Taxe</th>
                  <th>Pays</th>
                </tr>
              </thead>
              <tbody>
                {taxRules.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.groupId}</td>
                    <td>{r.taxId}</td>
                    <td>{r.countryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ImportAudit;
```

---

## Vérification

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreurs |
