import axios from 'axios';
import { productService, type Product } from './produitApi';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

export type ShopProduct = Product & { quantity: number };

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

// ── Products listing ──────────────────────────────────────────────────────────

export async function fetchShopProducts(): Promise<ShopProduct[]> {
  const [products, stockMap] = await Promise.all([
    productService.getAllProducts({ active: true }),
    fetchStockMap(),
  ]);
  return products.map(p => ({
    ...p,
    quantity: stockMap.get(p.id) ?? 0,
  }));
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
    const allImages = images.length > 0 ? images : (product.imageUrl ? [product.imageUrl] : []);
    return {
      product: { ...product, quantity: stockMap.get(id) ?? 0 },
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
