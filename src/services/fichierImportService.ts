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
    dateIdx: findIdx(['date_produit', 'date produit', 'date'], fallback.date),
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
