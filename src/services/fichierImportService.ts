import axios from 'axios';
import JSZip from 'jszip';
import { addLocalOrders } from './orderService';
import type { LocalOrder, LocalOrderStatus } from './orderService';

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

function parseFrenchNumber(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
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
// FICHIER 1 — Produits (date_produit,nom,reference,prix_ttc,Taxe,categorie)
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
  const rows  = lines.slice(1).filter((r) => r[1]); // skip header
  const results: FichierImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const [, nom, reference, prix_ttc_str, taxe_str, categorie] = rows[i];
    const label = `${nom} (${reference})`;
    onProgress?.(i, rows.length, label);
    try {
      const taxRate  = parseTaxRate(taxe_str ?? '0%');
      const ttc      = parseFrenchNumber(prix_ttc_str ?? '0');
      const ht       = ttcToHt(ttc, taxRate);
      const catId    = await findOrCreateCategory(categorie ?? 'Général');
      taxRateCache.set(reference, taxRate);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <active><![CDATA[1]]></active>
    <state><![CDATA[1]]></state>
    <id_category_default><![CDATA[${catId}]]></id_category_default>
    <id_tax_rules_group><![CDATA[1]]></id_tax_rules_group>
    <type><![CDATA[simple]]></type>
    <reference><![CDATA[${reference}]]></reference>
    <price><![CDATA[${ht.toFixed(6)}]]></price>
    <wholesale_price><![CDATA[0]]></wholesale_price>
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

        const optionId = await getOrCreateOption(specificite);
        const valId    = await getOrCreateOptionValue(optionId, karazany);

        const combXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product><![CDATA[${productId}]]></id_product>
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

function estimateTotal(
  items: Array<{ reference: string; qty: number }>,
): number {
  // On ne connait pas les prix côté client à ce stade, on retourne 0
  return 0;
}

async function createCustomer(nom: string, email: string, pwd: string): Promise<string | null> {
  const parts     = nom.trim().split(' ');
  const firstname = parts[0] ?? nom;
  const lastname  = parts.slice(1).join(' ') || nom;
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
    return await postXml('/customers', xml);
  } catch { return null; }
}

let orderCounter = Date.now();

export async function importFichier3(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  const lines = parseCsvContent(await file.text());
  const rows  = lines.slice(1).filter((r) => r[1]);
  const results: FichierImportResult[] = [];
  const newOrders: LocalOrder[] = [];

  for (let i = 0; i < rows.length; i++) {
    const [date, nom, email, pwd, adresse, achat, etat] = rows[i];
    const label = `${nom} (${email})`;
    onProgress?.(i, rows.length, label);

    try {
      await createCustomer(nom, email, pwd);
      const items  = parseAchat(achat ?? '');
      const status = mapEtatToStatus(etat ?? '');
      const order: LocalOrder = {
        id:            String(++orderCounter),
        date:          date ?? new Date().toLocaleDateString('fr-FR'),
        customerName:  nom,
        customerEmail: email,
        address:       adresse ?? '',
        items,
        status,
        totalTTC:      estimateTotal(items),
        source:        'local',
      };
      newOrders.push(order);
      results.push({ label, success: true, id: order.id });
    } catch (err: any) {
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
      results.push({ filename, reference, success: false, error: err.message });
    }
    onProgress?.(i + 1, entries.length, filename);
  }
  return results;
}
