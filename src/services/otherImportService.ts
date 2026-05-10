import axios from 'axios';
import type { AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ==========================================
// TYPES COMMUNS
// ==========================================

export type ProgressCallback = (done: number, total: number) => void;

export interface ImportResult {
  rowIndex: number;
  label: string;
  success: boolean;
  error?: string;
  id?: string;
}

export interface CleanResult {
  total: number;
  deleted: number;
  errors: number;
}

// ==========================================
// UTILITAIRES
// ==========================================

function cleanCell(v: string): string {
  return v.trim().replace(/^["']|["']$/g, '');
}

function parseCsvLines(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim() !== '')
    .map((l) => l.split(';').map(cleanCell));
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function extractXmlError(xmlString: string): string {
  try {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const msg = doc.querySelector('message')?.textContent?.trim();
    if (msg) return msg;
    const err = doc.querySelector('error')?.textContent?.trim();
    if (err) return err;
  } catch { /* ignore */ }
  return typeof xmlString === 'string' ? xmlString.slice(0, 140) : 'Erreur API';
}

function getCreatedId(xmlString: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    return doc.querySelector('id')?.textContent?.trim() || null;
  } catch { return null; }
}

async function postEntity(endpoint: string, xml: string): Promise<string> {
  const res = await api.post(endpoint, xml);
  return getCreatedId(res.data) || '?';
}

function parseIdList(xmlString: string): string[] {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const ids: string[] = [];
  const elements = doc.getElementsByTagName('id');
  for (let i = 0; i < elements.length; i++) {
    const id = elements[i].textContent?.trim();
    if (id) ids.push(id);
  }
  return ids;
}

// ==========================================
// NETTOYAGE GÉNÉRIQUE
// ==========================================

export async function cleanEntities(
  endpoint: string,
  protectedIds: string[] = [],
  onProgress?: ProgressCallback,
): Promise<CleanResult> {
  const res  = await api.get(`${endpoint}?display=[id]`);
  const ids  = parseIdList(res.data).filter((id) => !protectedIds.includes(id));
  let deleted = 0;
  let errors  = 0;

  for (let i = 0; i < ids.length; i++) {
    try {
      await api.delete(`${endpoint}/${ids[i]}`);
      deleted++;
    } catch {
      errors++;
    }
    onProgress?.(i + 1, ids.length);
  }
  return { total: ids.length, deleted, errors };
}

// Fonctions de nettoyage par entité
export const cleanCategories   = (cb?: ProgressCallback) => cleanEntities('/categories',   ['1', '2'], cb);
export const cleanCustomers    = (cb?: ProgressCallback) => cleanEntities('/customers',    [], cb);
export const cleanAddresses    = (cb?: ProgressCallback) => cleanEntities('/addresses',    [], cb);
export const cleanSuppliers    = (cb?: ProgressCallback) => cleanEntities('/suppliers',    [], cb);
export const cleanBrands       = (cb?: ProgressCallback) => cleanEntities('/manufacturers',[], cb);
export const cleanCombinations = (cb?: ProgressCallback) => cleanEntities('/combinations', [], cb);
export const cleanProducts     = (cb?: ProgressCallback) => cleanEntities('/products',     [], cb);

// ==========================================
// 1. CATÉGORIES
// ==========================================

export interface CategoryRow {
  active: string;
  name: string;
  parentCategory: string;
  description: string;
  metaTitle: string;
  metaKeywords: string;
  metaDescription: string;
  linkRewrite: string;
}

export function parseCategoryCsv(content: string): CategoryRow[] {
  return parseCsvLines(content)
    .map((c) => ({
      active:          c[1] ?? '1',
      name:            c[2] ?? '',
      parentCategory:  c[3] ?? 'Home',
      description:     c[5] ?? '',
      metaTitle:       c[6] ?? '',
      metaKeywords:    c[7] ?? '',
      metaDescription: c[8] ?? '',
      linkRewrite:     c[9] ?? '',
    }))
    .filter((r) => r.name !== '');
}

function resolveParentId(parentName: string): number {
  if (!parentName || parentName.toLowerCase() === 'home') return 2;
  if (parentName.toLowerCase() === 'root') return 1;
  const n = parseInt(parentName, 10);
  return isNaN(n) ? 2 : n;
}

function buildCategoryXml(row: CategoryRow): string {
  const lr = row.linkRewrite || slug(row.name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <category>
    <active><![CDATA[${row.active || '1'}]]></active>
    <id_parent><![CDATA[${resolveParentId(row.parentCategory)}]]></id_parent>
    <name><language id="1"><![CDATA[${row.name}]]></language></name>
    <description><language id="1"><![CDATA[${row.description}]]></language></description>
    <link_rewrite><language id="1"><![CDATA[${lr}]]></language></link_rewrite>
    <meta_title><language id="1"><![CDATA[${row.metaTitle}]]></language></meta_title>
    <meta_keywords><language id="1"><![CDATA[${row.metaKeywords}]]></language></meta_keywords>
    <meta_description><language id="1"><![CDATA[${row.metaDescription}]]></language></meta_description>
  </category>
</prestashop>`;
}

export async function importCategories(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ImportResult[]> {
  const rows = parseCategoryCsv(await file.text());
  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const id = await postEntity('/categories', buildCategoryXml(row));
      results.push({ rowIndex: i, label: row.name, success: true, id });
    } catch (err: any) {
      results.push({ rowIndex: i, label: row.name, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}

// ==========================================
// 2. CLIENTS
// ==========================================

export interface CustomerRow {
  active: string;
  titleId: string;
  email: string;
  password: string;
  birthday: string;
  lastName: string;
  firstName: string;
  newsletter: string;
  optin: string;
  defaultGroupId: string;
}

export function parseCustomerCsv(content: string): CustomerRow[] {
  return parseCsvLines(content)
    .map((c) => ({
      active:         c[1] ?? '1',
      titleId:        c[2] ?? '0',
      email:          c[3] ?? '',
      password:       c[4] ?? '',
      birthday:       c[5] ?? '',
      lastName:       c[6] ?? '',
      firstName:      c[7] ?? '',
      newsletter:     c[8] ?? '0',
      optin:          c[9] ?? '0',
      defaultGroupId: c[12] ?? '3',
    }))
    .filter((r) => r.email !== '');
}

function buildCustomerXml(row: CustomerRow): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <active><![CDATA[${row.active || '1'}]]></active>
    <id_gender><![CDATA[${row.titleId || '0'}]]></id_gender>
    <email><![CDATA[${row.email}]]></email>
    <passwd><![CDATA[${row.password}]]></passwd>
    <birthday><![CDATA[${row.birthday}]]></birthday>
    <lastname><![CDATA[${row.lastName}]]></lastname>
    <firstname><![CDATA[${row.firstName}]]></firstname>
    <newsletter><![CDATA[${row.newsletter || '0'}]]></newsletter>
    <optin><![CDATA[${row.optin || '0'}]]></optin>
    <id_default_group><![CDATA[${row.defaultGroupId || '3'}]]></id_default_group>
  </customer>
</prestashop>`;
}

export async function importCustomers(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ImportResult[]> {
  const rows = parseCustomerCsv(await file.text());
  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `${row.firstName} ${row.lastName} (${row.email})`;
    try {
      const id = await postEntity('/customers', buildCustomerXml(row));
      results.push({ rowIndex: i, label, success: true, id });
    } catch (err: any) {
      results.push({ rowIndex: i, label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}

// ==========================================
// 3. ADRESSES
// ==========================================

// Cache pays : nom (minuscule) → id
async function buildCountryCache(): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  try {
    const res = await api.get('/countries?display=[id,name]');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    doc.querySelectorAll('country').forEach((c) => {
      const id = c.querySelector('id')?.textContent?.trim();
      const name = c.querySelector('name language')?.textContent?.trim()
               ?? c.querySelector('name')?.textContent?.trim();
      if (id && name) cache.set(name.toLowerCase(), id);
    });
  } catch { /* API unreachable: cache stays empty */ }
  return cache;
}

// Cache client : email (minuscule) → id
async function buildCustomerCache(): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  try {
    const res = await api.get('/customers?display=[id,email]');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    doc.querySelectorAll('customer').forEach((c) => {
      const id    = c.querySelector('id')?.textContent?.trim();
      const email = c.querySelector('email')?.textContent?.trim();
      if (id && email) cache.set(email.toLowerCase(), id);
    });
  } catch { /* ignore */ }
  return cache;
}

export interface AddressRow {
  alias: string;
  active: string;
  customerEmail: string;
  company: string;
  lastName: string;
  firstName: string;
  address1: string;
  address2: string;
  postcode: string;
  city: string;
  country: string;
  phone: string;
  phoneMobile: string;
}

export function parseAddressCsv(content: string): AddressRow[] {
  return parseCsvLines(content)
    .map((c) => ({
      alias:         c[1] ?? '',
      active:        c[2] ?? '1',
      customerEmail: c[3] ?? '',
      company:       c[7] ?? '',
      lastName:      c[8] ?? '',
      firstName:     c[9] ?? '',
      address1:      c[10] ?? '',
      address2:      c[11] ?? '',
      postcode:      c[12] ?? '',
      city:          c[13] ?? '',
      country:       c[14] ?? '',
      phone:         c[17] ?? '',
      phoneMobile:   c[18] ?? '',
    }))
    .filter((r) => r.lastName !== '');
}

function buildAddressXml(
  row: AddressRow,
  customerId: string,
  countryId: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <active><![CDATA[${row.active || '1'}]]></active>
    <deleted><![CDATA[0]]></deleted>
    <id_customer><![CDATA[${customerId}]]></id_customer>
    <id_country><![CDATA[${countryId}]]></id_country>
    <alias><![CDATA[${row.alias}]]></alias>
    <company><![CDATA[${row.company}]]></company>
    <lastname><![CDATA[${row.lastName}]]></lastname>
    <firstname><![CDATA[${row.firstName}]]></firstname>
    <address1><![CDATA[${row.address1}]]></address1>
    <address2><![CDATA[${row.address2}]]></address2>
    <postcode><![CDATA[${row.postcode}]]></postcode>
    <city><![CDATA[${row.city}]]></city>
    <phone><![CDATA[${row.phone}]]></phone>
    <phone_mobile><![CDATA[${row.phoneMobile}]]></phone_mobile>
  </address>
</prestashop>`;
}

export async function importAddresses(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ImportResult[]> {
  const [countryCache, customerCache] = await Promise.all([
    buildCountryCache(),
    buildCustomerCache(),
  ]);

  const rows = parseAddressCsv(await file.text());
  const results: ImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `${row.firstName} ${row.lastName}`;
    try {
      const countryId = countryCache.get(row.country.toLowerCase());
      if (!countryId) throw new Error(`Pays introuvable : "${row.country}"`);

      const customerId = customerCache.get(row.customerEmail.toLowerCase()) ?? '0';
      const xml = buildAddressXml(row, customerId, countryId);
      const id = await postEntity('/addresses', xml);
      results.push({ rowIndex: i, label, success: true, id });
    } catch (err: any) {
      results.push({ rowIndex: i, label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}

// ==========================================
// 4. FOURNISSEURS
// ==========================================

export interface SupplierRow {
  active: string;
  name: string;
  description: string;
  metaTitle: string;
  metaKeywords: string;
  metaDescription: string;
}

export function parseSupplierCsv(content: string): SupplierRow[] {
  return parseCsvLines(content)
    .map((c) => ({
      active:          c[1] ?? '1',
      name:            c[2] ?? '',
      description:     c[3] ?? '',
      metaTitle:       c[4] ?? '',
      metaKeywords:    c[5] ?? '',
      metaDescription: c[6] ?? '',
    }))
    .filter((r) => r.name !== '');
}

function buildSupplierXml(row: SupplierRow): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <supplier>
    <active><![CDATA[${row.active || '1'}]]></active>
    <name><![CDATA[${row.name}]]></name>
    <description><language id="1"><![CDATA[${row.description}]]></language></description>
    <meta_title><language id="1"><![CDATA[${row.metaTitle}]]></language></meta_title>
    <meta_keywords><language id="1"><![CDATA[${row.metaKeywords}]]></language></meta_keywords>
    <meta_description><language id="1"><![CDATA[${row.metaDescription}]]></language></meta_description>
  </supplier>
</prestashop>`;
}

export async function importSuppliers(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ImportResult[]> {
  const rows = parseSupplierCsv(await file.text());
  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const id = await postEntity('/suppliers', buildSupplierXml(row));
      results.push({ rowIndex: i, label: row.name, success: true, id });
    } catch (err: any) {
      results.push({ rowIndex: i, label: row.name, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}

// ==========================================
// 5. MARQUES (manufacturers)
// ==========================================

export interface BrandRow {
  active: string;
  name: string;
  description: string;
  shortDescription: string;
  metaTitle: string;
  metaKeywords: string;
  metaDescription: string;
}

export function parseBrandCsv(content: string): BrandRow[] {
  return parseCsvLines(content)
    .map((c) => ({
      active:           c[1] ?? '1',
      name:             c[2] ?? '',
      description:      c[3] ?? '',
      shortDescription: c[4] ?? '',
      metaTitle:        c[5] ?? '',
      metaKeywords:     c[6] ?? '',
      metaDescription:  c[7] ?? '',
    }))
    .filter((r) => r.name !== '');
}

function buildBrandXml(row: BrandRow): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <manufacturer>
    <active><![CDATA[${row.active || '1'}]]></active>
    <name><![CDATA[${row.name}]]></name>
    <description><language id="1"><![CDATA[${row.description}]]></language></description>
    <short_description><language id="1"><![CDATA[${row.shortDescription}]]></language></short_description>
    <meta_title><language id="1"><![CDATA[${row.metaTitle}]]></language></meta_title>
    <meta_keywords><language id="1"><![CDATA[${row.metaKeywords}]]></language></meta_keywords>
    <meta_description><language id="1"><![CDATA[${row.metaDescription}]]></language></meta_description>
  </manufacturer>
</prestashop>`;
}

export async function importBrands(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ImportResult[]> {
  const rows = parseBrandCsv(await file.text());
  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const id = await postEntity('/manufacturers', buildBrandXml(row));
      results.push({ rowIndex: i, label: row.name, success: true, id });
    } catch (err: any) {
      results.push({ rowIndex: i, label: row.name, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}

// ==========================================
// 6. DÉCLINAISONS (combinations)
// ==========================================

export interface CombinationRow {
  productId: string;
  attributeSpec: string;   // "Color:color:0, Disk space:select:1"
  valueSpec: string;        // "Blue:0, 16GB:1"
  reference: string;
  ean13: string;
  wholesalePrice: string;
  impactPrice: string;
  quantity: string;
  minimalQuantity: string;
  isDefault: string;
  availableDate: string;
}

export function parseCombinationCsv(content: string): CombinationRow[] {
  return parseCsvLines(content)
    .map((c) => ({
      productId:      c[0] ?? '',
      attributeSpec:  c[1] ?? '',
      valueSpec:      c[2] ?? '',
      reference:      c[4] ?? '',
      ean13:          c[5] ?? '',
      wholesalePrice: c[7] ?? '0',
      impactPrice:    c[8] ?? '0',
      quantity:       c[10] ?? '0',
      minimalQuantity: c[11] ?? '1',
      isDefault:      c[14] ?? '0',
      availableDate:  c[15] ?? '',
    }))
    .filter((r) => r.productId !== '');
}

interface AttributeDef { name: string; type: string; position: number }
interface ValueDef     { value: string; position: number }

function parseAttributeSpec(spec: string): AttributeDef[] {
  return spec.split(', ').filter(Boolean).map((part) => {
    const lastColon = part.lastIndexOf(':');
    const position  = parseInt(part.slice(lastColon + 1), 10) || 0;
    const rest      = part.slice(0, lastColon);
    const midColon  = rest.lastIndexOf(':');
    const type      = rest.slice(midColon + 1);
    const name      = rest.slice(0, midColon);
    return { name, type, position };
  });
}

function parseValueSpec(spec: string): ValueDef[] {
  return spec.split(', ').filter(Boolean).map((part) => {
    const lastColon = part.lastIndexOf(':');
    const position  = parseInt(part.slice(lastColon + 1), 10) || 0;
    const value     = part.slice(0, lastColon);
    return { value, position };
  });
}

// Load existing product_options into cache (name → id)
async function loadOptionCache(): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  try {
    const res = await api.get('/product_options?display=full');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    doc.querySelectorAll('product_option').forEach((opt) => {
      const id   = opt.querySelector('id')?.textContent?.trim();
      const name = opt.querySelector('name language')?.textContent?.trim()
               ?? opt.querySelector('name')?.textContent?.trim();
      if (id && name) cache.set(name.toLowerCase(), id);
    });
  } catch { /* ignore */ }
  return cache;
}

// Load existing product_option_values into cache ("optionId:valueName" → id)
async function loadOptionValueCache(): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  try {
    const res = await api.get('/product_option_values?display=full');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    doc.querySelectorAll('product_option_value').forEach((v) => {
      const id       = v.querySelector('id')?.textContent?.trim();
      const groupId  = v.querySelector('id_attribute_group')?.textContent?.trim();
      const name     = v.querySelector('name language')?.textContent?.trim()
                   ?? v.querySelector('name')?.textContent?.trim();
      if (id && groupId && name) cache.set(`${groupId}:${name.toLowerCase()}`, id);
    });
  } catch { /* ignore */ }
  return cache;
}

async function getOrCreateOption(
  name: string,
  type: string,
  position: number,
  cache: Map<string, string>,
): Promise<string> {
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <name><language id="1"><![CDATA[${name}]]></language></name>
    <public_name><language id="1"><![CDATA[${name}]]></language></public_name>
    <group_type><![CDATA[${type || 'select'}]]></group_type>
    <is_color_group><![CDATA[${type === 'color' ? 1 : 0}]]></is_color_group>
    <position><![CDATA[${position}]]></position>
  </product_option>
</prestashop>`;
  const id = await postEntity('/product_options', xml);
  cache.set(key, id);
  return id;
}

async function getOrCreateOptionValue(
  optionId: string,
  valueName: string,
  position: number,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${optionId}:${valueName.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group><![CDATA[${optionId}]]></id_attribute_group>
    <name><language id="1"><![CDATA[${valueName}]]></language></name>
    <position><![CDATA[${position}]]></position>
  </product_option_value>
</prestashop>`;
  const id = await postEntity('/product_option_values', xml);
  cache.set(key, id);
  return id;
}

function buildCombinationXml(row: CombinationRow, optionValueIds: string[]): string {
  const assocXml = optionValueIds
    .map((id) => `<product_option_value><id><![CDATA[${id}]]></id></product_option_value>`)
    .join('\n        ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product><![CDATA[${row.productId}]]></id_product>
    <reference><![CDATA[${row.reference}]]></reference>
    <ean13><![CDATA[${/^\d{13}$/.test(row.ean13) ? row.ean13 : ''}]]></ean13>
    <wholesale_price><![CDATA[${row.wholesalePrice || '0'}]]></wholesale_price>
    <price><![CDATA[${row.impactPrice || '0'}]]></price>
    <minimal_quantity><![CDATA[${row.minimalQuantity || '1'}]]></minimal_quantity>
    <default_on><![CDATA[${row.isDefault || '0'}]]></default_on>
    <available_date><![CDATA[${row.availableDate}]]></available_date>
    <associations>
      <product_option_values>
        ${assocXml}
      </product_option_values>
    </associations>
  </combination>
</prestashop>`;
}

export async function importCombinations(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ImportResult[]> {
  const [optionCache, optionValueCache] = await Promise.all([
    loadOptionCache(),
    loadOptionValueCache(),
  ]);

  const rows = parseCombinationCsv(await file.text());
  const results: ImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Produit ${row.productId} — ${row.valueSpec}`;
    try {
      const attrDefs  = parseAttributeSpec(row.attributeSpec);
      const valueDefs = parseValueSpec(row.valueSpec);

      if (attrDefs.length !== valueDefs.length) {
        throw new Error('Nombre d\'attributs et de valeurs incohérent');
      }

      const optionValueIds: string[] = [];
      for (let j = 0; j < attrDefs.length; j++) {
        const attr  = attrDefs[j];
        const val   = valueDefs[j];
        const optId = await getOrCreateOption(attr.name, attr.type, attr.position, optionCache);
        const valId = await getOrCreateOptionValue(optId, val.value, val.position, optionValueCache);
        optionValueIds.push(valId);
      }

      const xml = buildCombinationXml(row, optionValueIds);
      const id  = await postEntity('/combinations', xml);
      results.push({ rowIndex: i, label, success: true, id });
    } catch (err: any) {
      results.push({ rowIndex: i, label, success: false,
        error: err.response?.data ? extractXmlError(err.response.data) : err.message });
    }
    onProgress?.(i + 1, rows.length);
  }
  return results;
}
