import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

function text(el: Element, selector: string): string {
  return el.querySelector(selector)?.textContent?.trim() ?? '';
}

function langText(el: Element, selector: string): string {
  const lang = el.querySelector(`${selector} > language`);
  if (lang?.textContent) return lang.textContent.trim();
  return text(el, selector);
}

function parseList(xml: string, tag: string): Element[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.querySelectorAll(tag));
}

function withLimit(limit: number): string {
  return `0,${limit}`;
}

export interface ProductAudit {
  id: string;
  name: string;
  reference: string;
  priceHt: string;
  taxRulesGroupId: string;
  active: string;
}

export interface CategoryAudit {
  id: string;
  name: string;
}

export interface CustomerAudit {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
}

export interface AddressAudit {
  id: string;
  alias: string;
  city: string;
  postcode: string;
  countryId: string;
  customerId: string;
}

export interface SupplierAudit {
  id: string;
  name: string;
}

export interface BrandAudit {
  id: string;
  name: string;
}

export interface CombinationAudit {
  id: string;
  productId: string;
  reference: string;
}

export interface StockAudit {
  id: string;
  productId: string;
  quantity: string;
}

export interface TaxAudit {
  id: string;
  name: string;
  rate: string;
}

export interface TaxRuleGroupAudit {
  id: string;
  name: string;
}

export interface TaxRuleAudit {
  id: string;
  groupId: string;
  taxId: string;
  countryId: string;
}

export async function fetchProductsSample(limit = 50): Promise<ProductAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,name,reference,price,id_tax_rules_group,active]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/products?${params.toString()}`);
  return parseList(res.data, 'product').map((el) => ({
    id: text(el, 'id'),
    name: langText(el, 'name'),
    reference: text(el, 'reference'),
    priceHt: text(el, 'price'),
    taxRulesGroupId: text(el, 'id_tax_rules_group'),
    active: text(el, 'active') === '1' ? 'yes' : 'no',
  }));
}

export async function fetchCategoriesSample(limit = 50): Promise<CategoryAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,name]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/categories?${params.toString()}`);
  return parseList(res.data, 'category').map((el) => ({
    id: text(el, 'id'),
    name: langText(el, 'name'),
  }));
}

export async function fetchCustomersSample(limit = 50): Promise<CustomerAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,firstname,lastname,email]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/customers?${params.toString()}`);
  return parseList(res.data, 'customer').map((el) => ({
    id: text(el, 'id'),
    firstname: text(el, 'firstname'),
    lastname: text(el, 'lastname'),
    email: text(el, 'email'),
  }));
}

export async function fetchAddressesSample(limit = 50): Promise<AddressAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,alias,city,postcode,id_country,id_customer]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/addresses?${params.toString()}`);
  return parseList(res.data, 'address').map((el) => ({
    id: text(el, 'id'),
    alias: text(el, 'alias'),
    city: text(el, 'city'),
    postcode: text(el, 'postcode'),
    countryId: text(el, 'id_country'),
    customerId: text(el, 'id_customer'),
  }));
}

export async function fetchSuppliersSample(limit = 50): Promise<SupplierAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,name]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/suppliers?${params.toString()}`);
  return parseList(res.data, 'supplier').map((el) => ({
    id: text(el, 'id'),
    name: text(el, 'name'),
  }));
}

export async function fetchBrandsSample(limit = 50): Promise<BrandAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,name]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/manufacturers?${params.toString()}`);
  return parseList(res.data, 'manufacturer').map((el) => ({
    id: text(el, 'id'),
    name: text(el, 'name'),
  }));
}

export async function fetchCombinationsSample(limit = 50): Promise<CombinationAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,id_product,reference]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/combinations?${params.toString()}`);
  return parseList(res.data, 'combination').map((el) => ({
    id: text(el, 'id'),
    productId: text(el, 'id_product'),
    reference: text(el, 'reference'),
  }));
}

export async function fetchStockSample(limit = 50): Promise<StockAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,id_product,quantity]');
  params.set('filter[id_product_attribute]', '[0]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/stock_availables?${params.toString()}`);
  return parseList(res.data, 'stock_available').map((el) => ({
    id: text(el, 'id'),
    productId: text(el, 'id_product'),
    quantity: text(el, 'quantity'),
  }));
}

export async function fetchTaxesSample(limit = 50): Promise<TaxAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,name,rate]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/taxes?${params.toString()}`);
  return parseList(res.data, 'tax').map((el) => ({
    id: text(el, 'id'),
    name: langText(el, 'name'),
    rate: text(el, 'rate'),
  }));
}

export async function fetchTaxRuleGroupsSample(limit = 50): Promise<TaxRuleGroupAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,name]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/tax_rule_groups?${params.toString()}`);
  return parseList(res.data, 'tax_rule_group').map((el) => ({
    id: text(el, 'id'),
    name: text(el, 'name'),
  }));
}

export async function fetchTaxRulesSample(limit = 50): Promise<TaxRuleAudit[]> {
  const params = new URLSearchParams();
  params.set('display', '[id,id_tax_rules_group,id_tax,id_country]');
  params.set('limit', withLimit(limit));
  params.set('sort', '[id_DESC]');
  const res = await api.get(`/tax_rules?${params.toString()}`);
  return parseList(res.data, 'tax_rule').map((el) => ({
    id: text(el, 'id'),
    groupId: text(el, 'id_tax_rules_group'),
    taxId: text(el, 'id_tax'),
    countryId: text(el, 'id_country'),
  }));
}
