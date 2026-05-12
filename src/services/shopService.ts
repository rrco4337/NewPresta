import axios from 'axios';
import { productService, type Product } from './produitApi';
import { getTaxRateByGroup } from './taxService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

export type ShopProduct = Product & {
  quantity: number;
  priceHt: number;
  priceTtc: number;
  taxRate: number;
};

export interface ShopCategory {
  id: number;
  name: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function calcTtc(priceHt: number, taxRate: number): number {
  return roundMoney(priceHt * (1 + taxRate));
}

// ── Stock ─────────────────────────────────────────────────────────────────────

function parseStockXml(xml: string): Map<string, number> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const map = new Map<string, number>();
  doc.querySelectorAll('stock_available').forEach(el => {
    const pid = el.querySelector('id_product')?.textContent?.trim();
    const qty = parseInt(el.querySelector('quantity')?.textContent ?? '0', 10);
    if (pid) map.set(pid, qty);
  });
  return map;
}

export async function fetchStockMap(): Promise<Map<string, number>> {
  try {
    const res = await api.get(
      '/stock_availables?display=[id_product,quantity]&filter[id_product_attribute]=[0]'
    );
    return parseStockXml(res.data);
  } catch { return new Map(); }
}

// ── Images ────────────────────────────────────────────────────────────────────

export async function fetchProductImages(productId: string): Promise<string[]> {
  try {
    const res = await api.get(`/images/products/${productId}`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const urls: string[] = [];
    doc.querySelectorAll('declination').forEach(el => {
      const id = el.getAttribute('id');
      if (id) urls.push(`/api/images/products/${productId}/${id}`);
    });
    return urls;
  } catch { return []; }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function fetchShopCategories(): Promise<ShopCategory[]> {
  try {
    const res = await api.get('/categories?display=[id,name]&filter[active]=[1]');
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const cats: ShopCategory[] = [];
    doc.querySelectorAll('category').forEach(c => {
      const id = parseInt(c.querySelector(':scope > id')?.textContent ?? '0', 10);
      const name =
        c.querySelector('name language')?.textContent?.trim() ??
        c.querySelector('name')?.textContent?.trim() ?? '';
      if (id > 2 && name) cats.push({ id, name });
    });
    return cats.sort((a, b) => a.name.localeCompare('fr'));
  } catch { return []; }
}

// ── Products listing ──────────────────────────────────────────────────────────

export async function fetchShopProducts(opts: { categoryId?: number } = {}): Promise<ShopProduct[]> {
  const [products, stockMap] = await Promise.all([
    productService.getAllProducts({ active: true, categoryId: opts.categoryId }),
    fetchStockMap(),
  ]);

  const groupIds = Array.from(
    new Set(products.map((p) => (Number.isFinite(p.id_tax_rules_group) ? p.id_tax_rules_group : 0)))
  );

  const taxRates = new Map<number, number>();
  await Promise.all(
    groupIds.map(async (groupId) => {
      taxRates.set(groupId, await getTaxRateByGroup(groupId));
    })
  );

  return products.map((p) => {
    const taxRate = taxRates.get(p.id_tax_rules_group) ?? 0;
    const priceHt = p.price;
    const priceTtc = calcTtc(priceHt, taxRate);
    return {
      ...p,
      quantity: stockMap.get(p.id) ?? 0,
      priceHt,
      priceTtc,
      taxRate,
    };
  });
}

// ── Product detail ────────────────────────────────────────────────────────────

export async function fetchShopProductDetail(
  id: string
): Promise<{ product: ShopProduct; images: string[] } | null> {
  try {
    const [product, stockMap, images] = await Promise.all([
      productService.getProduct(id),
      fetchStockMap(),
      fetchProductImages(id),
    ]);
    if (!product) return null;
    const taxRate = await getTaxRateByGroup(product.id_tax_rules_group);
    const priceHt = product.price;
    const priceTtc = calcTtc(priceHt, taxRate);
    const allImages = images.length > 0 ? images : (product.imageUrl ? [product.imageUrl] : []);
    return {
      product: {
        ...product,
        quantity: stockMap.get(id) ?? 0,
        priceHt,
        priceTtc,
        taxRate,
      },
      images: allImages,
    };
  } catch { return null; }
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatPrice(price: number): string {
  return price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function stockStatus(qty: number): { label: string; level: 'ok' | 'low' | 'out' } {
  if (qty === 0)   return { label: 'Rupture de stock',        level: 'out' };
  if (qty <= 5)    return { label: `Plus que ${qty} en stock`, level: 'low' };
  return               { label: 'En stock',                  level: 'ok' };
}
