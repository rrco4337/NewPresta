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

function extractXmlError(xmlString: string): string {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const message = xmlDoc.getElementsByTagName("message")[0]?.textContent;
    return message || "Erreur API inconnue";
  } catch {
    return "Erreur de formatage de la réponse serveur";
  }
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

interface ParsedItem {
  reference: string;
  qty: number;
  variant: string;
}

interface PricedItem extends ParsedItem {
  productId: string;
  price: number;          // prix unitaire HT
  combinationId?: string;
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
let productPriceCache: Map<string, number> = new Map();
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
     
        productPriceCache.set(reference, ttc);
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

async function createAddress(customerId: string, nom: string, adresseStr: string): Promise<string | null> {
  const parts = nom.trim().split(' ');
  const firstname = parts[0] ?? nom;
  const lastname = parts.slice(1).join(' ') || nom;

  // PrestaShop exige un code postal et une ville. 
  // On utilise l'adresse du CSV pour la ville et l'adresse1 par défaut.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <id_customer><![CDATA[${customerId}]]></id_customer>
    <id_country><![CDATA[1]]></id_country> <alias><![CDATA[Adresse Import]]></alias>
    <lastname><![CDATA[${lastname}]]></lastname>
    <firstname><![CDATA[${firstname}]]></firstname>
    <address1><![CDATA[${adresseStr}]]></address1>
    <city><![CDATA[${adresseStr}]]></city>
    <postcode><![CDATA[00000]]></postcode> </address>
</prestashop>`;

  try {
    return await postXml('/addresses', xml);
  } catch (err) {
    console.error("Erreur création adresse:", err);
    return null;
  }
}

async function createCart(customerId: string, addressId: string, items: any[]): Promise<string> {
  const orderRows = await Promise.all(items.map(async (item) => {
    const productId = await getProductIdByRef(item.reference);
    return `
      <cart_row>
        <id_product><![CDATA[${productId || 0}]]></id_product>
        <id_product_attribute><![CDATA[0]]></id_product_attribute>
        <quantity><![CDATA[${item.qty}]]></quantity>
      </cart_row>`;
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_customer><![CDATA[${customerId}]]></id_customer>
    <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${addressId}]]></id_address_invoice>
    <id_currency><![CDATA[2]]></id_currency>
    <id_lang><![CDATA[1]]></id_lang>
    <id_carrier><![CDATA[6]]></id_carrier>
    <associations>
      <cart_rows>${orderRows.join('')}</cart_rows>
    </associations>
  </cart>
</prestashop>`;

  return await postXml('/carts', xml);
}

async function fetchProductPrice(ref: string): Promise<{ productId: string; price: number; combinationId?: string }> {
  // 1. Chercher le produit par référence
  const searchRes = await api.get(
    `/products?filter[reference]=[${ref}]&display=[id,price,reference]`
  );
  const doc = new DOMParser().parseFromString(searchRes.data, 'text/xml');
  const productEl = doc.querySelector('product');

  if (!productEl) throw new Error(`Produit introuvable: ${ref}`);

  const productId = productEl.querySelector('id')?.textContent?.trim() || '';
  const price     = parseFloat(productEl.querySelector('price')?.textContent?.trim() || '0');

  return { productId, price };
}

// ─── Résoudre les prix de tous les items ─────────────────────────────────────
async function resolvePrices(items: ParsedItem[]): Promise<PricedItem[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const { productId, price } = await fetchProductPrice(item.reference);
        console.log(`💰 ${item.reference} → ${price} (x${item.qty})`);
        return { ...item, productId, price };
      } catch (err) {
        console.warn(`⚠️ Prix introuvable pour ${item.reference}, utilisation de 0`);
        return { ...item, productId: '', price: 0 };
      }
    })
  );
}

// ─── Création de commande corrigée ───────────────────────────────────────────
async function createPrestaOrder(
  customerId: string,
  addressId: string,
  cartId: string,
  items: ParsedItem[]          // ← items bruts du CSV : { ref, qty, variant }
) {
  console.log("=== CRÉATION COMMANDE ===");
  console.log("Items reçus:", items); // debug pour vérifier les vrais noms de champs

  // 1. Secure key
  let secureKey = '';
  try {
    const customerRes = await api.get(`/customers/${customerId}?display=[secure_key]`);
    const customerDoc = new DOMParser().parseFromString(customerRes.data, 'text/xml');
    secureKey = customerDoc.querySelector('secure_key')?.textContent?.trim() || '';
  } catch {
    secureKey = '00000000000000000000000000000000';
  }

  // 2. Résoudre les prix depuis PrestaShop
  const pricedItems = await resolvePrices(items);

  // 3. Calculer les totaux
  const totalProducts = pricedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxRate        = 0;     // adapter si TVA (ex: 0.20)
  const totalShipping  = 0;     // adapter si frais de port
  const totalProdTTC   = totalProducts * (1 + taxRate);
  const totalPaid      = totalProdTTC + totalShipping;
  const fmt = (n: number) => n.toFixed(6);

  console.log(`💰 Totaux → produits HT: ${fmt(totalProducts)}, TTC: ${fmt(totalProdTTC)}, total: ${fmt(totalPaid)}`);

  // Sécurité : ne pas créer de commande avec total à 0
  if (totalPaid === 0) {
    throw new Error(`Total à 0 pour le panier ${cartId} — vérifier les références produits`);
  }

  // 4. Mettre à jour le panier
  const updateCartXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <cart>
    <id><![CDATA[${cartId}]]></id>
    <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${addressId}]]></id_address_invoice>
    <id_customer><![CDATA[${customerId}]]></id_customer>
    <id_currency><![CDATA[2]]></id_currency>
    <id_lang><![CDATA[1]]></id_lang>
    <id_carrier><![CDATA[6]]></id_carrier>
    <secure_key><![CDATA[${secureKey}]]></secure_key>
  </cart>
</prestashop>`;

  try {
    await api.put(`/carts/${cartId}`, updateCartXml);
    console.log("✅ Panier mis à jour");
  } catch (err: any) {
    throw new Error(`Impossible de mettre à jour le panier: ${err.message}`);
  }

  const orderRowsXml = pricedItems.map((item, index) => `
      <order_row id="${index + 1}">
        <product_id><![CDATA[${item.productId}]]></product_id>
        <product_attribute_id><![CDATA[${item.combinationId || '0'}]]></product_attribute_id>
        <product_quantity><![CDATA[${item.qty}]]></product_quantity>
        <product_name><![CDATA[${item.reference}]]></product_name>
        <product_reference><![CDATA[${item.reference}]]></product_reference>
        <product_price><![CDATA[${fmt(item.price)}]]></product_price>
        <unit_price_tax_incl><![CDATA[${fmt(item.price * (1 + taxRate))}]]></unit_price_tax_incl>
        <unit_price_tax_excl><![CDATA[${fmt(item.price)}]]></unit_price_tax_excl>
      </order_row>`
).join('');

  // 5. Créer la commande
 const orderXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <order>
    <id_cart><![CDATA[${cartId}]]></id_cart>
    <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${addressId}]]></id_address_invoice>
    <id_currency><![CDATA[2]]></id_currency>
    <id_lang><![CDATA[1]]></id_lang>
    <id_customer><![CDATA[${customerId}]]></id_customer>
    <id_carrier><![CDATA[6]]></id_carrier>
    <id_shop><![CDATA[1]]></id_shop>
    <id_shop_group><![CDATA[1]]></id_shop_group>
    <current_state><![CDATA[1]]></current_state>
    <module><![CDATA[ps_checkpayment]]></module>
    <payment><![CDATA[Chèque]]></payment>
    <secure_key><![CDATA[${secureKey}]]></secure_key>
    <total_products><![CDATA[${fmt(totalProducts)}]]></total_products>
    <total_products_wt><![CDATA[${fmt(totalProdTTC)}]]></total_products_wt>
    <total_shipping><![CDATA[${fmt(totalShipping)}]]></total_shipping>
    <total_shipping_tax_excl><![CDATA[${fmt(totalShipping)}]]></total_shipping_tax_excl>
    <total_shipping_tax_incl><![CDATA[${fmt(totalShipping)}]]></total_shipping_tax_incl>
    <total_discounts><![CDATA[0.000000]]></total_discounts>
    <total_discounts_tax_excl><![CDATA[0.000000]]></total_discounts_tax_excl>
    <total_discounts_tax_incl><![CDATA[0.000000]]></total_discounts_tax_incl>
    <total_paid><![CDATA[${fmt(totalPaid)}]]></total_paid>
    <total_paid_tax_excl><![CDATA[${fmt(totalProducts + totalShipping)}]]></total_paid_tax_excl>
    <total_paid_tax_incl><![CDATA[${fmt(totalPaid)}]]></total_paid_tax_incl>
    <total_paid_real><![CDATA[${fmt(totalPaid)}]]></total_paid_real>
    <total_wrapping><![CDATA[0.000000]]></total_wrapping>
    <total_wrapping_tax_excl><![CDATA[0.000000]]></total_wrapping_tax_excl>
    <total_wrapping_tax_incl><![CDATA[0.000000]]></total_wrapping_tax_incl>
    <conversion_rate><![CDATA[1.000000]]></conversion_rate>
    <associations>
      <order_rows>
        ${orderRowsXml}
      </order_rows>
    </associations>
  </order>
</prestashop>`;

  try {
    const result = await api.post('/orders', orderXml);
    console.log("✅ Commande créée!");
    const idMatch = result.data.match(/<id><!\[CDATA\[(\d+)\]\]>/);
    const orderId = idMatch ? idMatch[1] : null;
    console.log("ID Commande:", orderId);
    return orderId;

  } catch (error: any) {
   
    const errData = error.response?.data || '';
    const errStatus = error.response?.status || '?';
    console.error(`❌ Erreur ${errStatus} création commande:`, errData || '(corps vide)');

    // Vérifier si une commande existe déjà pour ce panier
    try {
      const searchRes = await api.get(`/orders?filter[id_cart]=[${cartId}]`);
      const idMatch = searchRes.data.match(/<id><!\[CDATA\[(\d+)\]\]>/);
      if (idMatch) {
        console.log("✅ Commande existante trouvée:", idMatch[1]);
        return idMatch[1];
      }
    } catch {}

    throw error;
  }
}

async function debugPrestaOrder(customerId: string, addressId: string, cartId: string, items: any[]) {
  console.log("=== DÉBOGAGE COMMANDE PRESTASHOP ===");
  
  // Vérifier le client
  try {
    const customerRes = await api.get(`/customers/${customerId}?display=full`);
    console.log("✅ Client existe:", customerRes.data.substring(0, 500));
  } catch (err) {
    console.error("❌ Client invalide:", err);
  }
  
  // Vérifier l'adresse
  try {
    const addressRes = await api.get(`/addresses/${addressId}?display=full`);
    console.log("✅ Adresse existe:", addressRes.data.substring(0, 500));
  } catch (err) {
    console.error("❌ Adresse invalide:", err);
  }
  
  // Vérifier le panier
  if (cartId !== '0') {
    try {
      const cartRes = await api.get(`/carts/${cartId}?display=full`);
      console.log("✅ Panier existe:", cartRes.data.substring(0, 500));
    } catch (err) {
      console.error("❌ Panier invalide:", err);
    }
  }
  
  // Vérifier les produits
  for (const item of items) {
    const productId = await getProductIdByRef(item.reference);
    if (productId) {
      try {
        const productRes = await api.get(`/products/${productId}?display=[id,reference,price]`);
        console.log(`✅ Produit ${item.reference} existe:`, productRes.data);
      } catch (err) {
        console.error(`❌ Produit ${item.reference} invalide:`, err);
      }
    } else {
      console.error(`❌ Produit ${item.reference} non trouvé`);
    }
  }
  
  // Vérifier les états de commande disponibles
  try {
    const statesRes = await api.get('/order_states?display=[id,name]');
    console.log("États de commande disponibles:", statesRes.data);
  } catch (err) {
    console.error("❌ Impossible de récupérer les états:", err);
  }
}


export async function importFichier3(
  file: File,
  onProgress?: FichierProgressCallback,
): Promise<FichierImportResult[]> {
  const lines = parseCsvContent(await file.text());
  const rows = lines.slice(1).filter((r) => r[1]);
  const results: FichierImportResult[] = [];
  const newOrders: LocalOrder[] = [];

  for (let i = 0; i < rows.length; i++) {
    const [date, nom, email, pwd, adresse, achat, etat] = rows[i];
    const label = `${nom} (${email})`;
    onProgress?.(i, rows.length, label);

    try {
      // 1. Créer le client (ou récupérer son ID si déjà existant)
      const customerId = await createCustomer(nom, email, pwd);
      if (!customerId || customerId === '?') {
        throw new Error("Échec de la création du client (Email déjà utilisé ou données invalides)");
      }
      
      if (customerId && customerId !== '?') {
        // 2. Créer l'adresse (indispensable pour l'étape suivante)
        const addressId = await createAddress(customerId, nom, adresse ?? 'Non précisée');
        if (!addressId || addressId === '?') {
          throw new Error(`Impossible de lier l'adresse au client ID: ${customerId}`);
        }

        if (addressId && addressId !== '?') {
          const items = parseAchat(achat ?? '');
          
          // 3. Créer la commande dans PrestaShop
        let cartId;
        try {
          cartId = await createCart(customerId, addressId, items);
          if (!cartId || cartId === '?') throw new Error("ID de panier invalide");
        } catch (e: any) {
          throw new Error(`[PANIER] ${e.message}`);
        }
        
        // 2. Créer la commande liée à ce panier
        let prestaOrderId;
        try {
          prestaOrderId = await createPrestaOrder(customerId, addressId, cartId, items);
          if (!prestaOrderId || prestaOrderId === '?') throw new Error("ID de commande vide");
        } catch (e: any) {
          // C'est ici que ça risque de coincer
          throw new Error(`[COMMANDE] ${e.message}`);
        }
          // 4. Ajouter à la liste locale pour l'affichage dans NewApp
          const status = mapEtatToStatus(etat ?? '');
          const order: LocalOrder = {
            id: prestaOrderId, // On utilise l'ID généré par PrestaShop
            date: date ?? new Date().toLocaleDateString('fr-FR'),
            customerName: nom,
            customerEmail: email,
            address: adresse ?? '',
            items,
            status,
            totalTTC: 0, // Idéalement, calculez-le ici
            source: 'local',
          };
          newOrders.push(order);
          results.push({ label, success: true, id: prestaOrderId });
        }
      }
    } catch (err: any) {
      const detail = err.response?.data ? extractXmlError(err.response.data) : err.message;
      results.push({
        label,
        success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message,
      });
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

