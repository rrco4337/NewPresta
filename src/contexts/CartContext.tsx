import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useCustomer } from './CustomerContext';
import { syncRemoteCart, fetchCustomerCart } from '../services/cartSyncService';
import { fetchShopProductDetail } from '../services/shopService';

const CART_KEY = 'shopCart';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export interface CartItem {
  id: string;
  attributeId?: string;
  variantLabel?: string;
  name: string;
  priceHt: number;
  priceTtc: number;
  taxRate: number;
  qty: number;
  imageUrl?: string;
}

function itemKey(id: string, attributeId?: string): string {
  return attributeId ? `${id}::${attributeId}` : id;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  removeItem: (id: string, attributeId?: string) => void;
  updateQty: (id: string, qty: number, attributeId?: string) => void;
  clear: () => void;
  totalPrice: number;
  totalPriceHt: number;
  totalTax: number;
  totalItems: number;
  remoteCartId: string | null;
  loadingRemoteCart: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

// ── Helpers for sessionStorage persistence ────────────────────────────────────

function readCartFromSession(): CartItem[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CART_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return null;
        const r = item as Record<string, unknown>;
        const legacyPrice = typeof r.price === 'number' ? r.price
          : typeof r.price === 'string' ? parseFloat(r.price) || 0
          : 0;
        const priceHt = typeof r.priceHt === 'number' ? r.priceHt
          : typeof r.priceHt === 'string' ? parseFloat(r.priceHt) || 0
          : legacyPrice;
        const priceTtc = typeof r.priceTtc === 'number' ? r.priceTtc
          : typeof r.priceTtc === 'string' ? parseFloat(r.priceTtc) || 0
          : priceHt;
        const taxRate = typeof r.taxRate === 'number' ? r.taxRate
          : (priceHt > 0 ? Math.max(0, priceTtc / priceHt - 1) : 0);
        const qty = typeof r.qty === 'number' ? r.qty
          : typeof r.qty === 'string' ? parseInt(r.qty, 10) || 1
          : 1;
        const id = String(r.id ?? '');
        if (!id) return null;
        return {
          id,
          attributeId: typeof r.attributeId === 'string' ? r.attributeId : undefined,
          variantLabel: typeof r.variantLabel === 'string' ? r.variantLabel : undefined,
          name: String(r.name ?? ''),
          priceHt,
          priceTtc,
          taxRate,
          qty,
          imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : undefined,
        } as CartItem;
      })
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

function writeCartToSession(items: CartItem[]): void {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customer } = useCustomer();
  const [items, setItems] = useState<CartItem[]>(readCartFromSession);
  const [remoteCartId, setRemoteCartId] = useState<string | null>(null);
  const [loadingRemoteCart, setLoadingRemoteCart] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCustomerIdRef = useRef<string | null>(null);

  // ── Persist to sessionStorage on every change ──
  useEffect(() => {
    writeCartToSession(items);
  }, [items]);

  // ── Load remote cart when customer logs in ──
  useEffect(() => {
    const customerId = customer?.id ?? null;

    // Skip if customer hasn't changed
    if (customerId === prevCustomerIdRef.current) return;
    prevCustomerIdRef.current = customerId;

    if (!customerId) {
      // Customer logged out → clear cart
      setItems([]);
      setRemoteCartId(null);
      sessionStorage.removeItem(CART_KEY);
      return;
    }

    // Customer logged in → fetch their remote cart
    let cancelled = false;
    setLoadingRemoteCart(true);

    (async () => {
      try {
        const remote = await fetchCustomerCart(customerId);
        if (cancelled) return;

        if (remote && remote.items.length > 0) {
          setRemoteCartId(remote.cartId);

          // Load full product details for each remote cart item
          const loadedItems: CartItem[] = [];
          for (const row of remote.items) {
            try {
              const detail = await fetchShopProductDetail(row.productId);
              if (cancelled) return;
              if (detail) {
                loadedItems.push({
                  id: detail.product.id,
                  name: detail.product.name,
                  priceHt: detail.product.priceHt,
                  priceTtc: detail.product.priceTtc,
                  taxRate: detail.product.taxRate,
                  qty: row.quantity,
                  imageUrl: detail.images[0],
                });
              }
            } catch {
              // Skip products that can't be loaded
              console.warn('[CartContext] Could not load product', row.productId);
            }
          }

          if (!cancelled && loadedItems.length > 0) {
            setItems(loadedItems);
            console.log('[CartContext] Loaded remote cart with', loadedItems.length, 'items');
          }
        } else {
          // No remote cart — start fresh
          setItems([]);
          setRemoteCartId(null);
        }
      } catch (err) {
        console.error('[CartContext] Failed to load remote cart:', err);
      } finally {
        if (!cancelled) setLoadingRemoteCart(false);
      }
    })();

    return () => { cancelled = true; };
  }, [customer]);

  // ── Debounced remote sync ──
  const scheduleSyncRef = useRef<((newItems: CartItem[]) => void) | undefined>(undefined);

  const scheduleSync = useCallback((newItems: CartItem[]) => {
    if (!customer) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      const cartId = await syncRemoteCart({
        customerId: customer.id,
        items: newItems,
        existingCartId: remoteCartId ?? undefined,
      });
      if (cartId) {
        setRemoteCartId(cartId);
      }
    }, 500);
  }, [customer, remoteCartId]);

  // Keep ref in sync
  useEffect(() => {
    scheduleSyncRef.current = scheduleSync;
  }, [scheduleSync]);

  // ── Cart operations ──

  const addItem = (item: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems(prev => {
      const key = itemKey(item.id, item.attributeId);
      const idx = prev.findIndex(i => itemKey(i.id, i.attributeId) === key);
      let next: CartItem[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
      } else {
        next = [...prev, { ...item, qty }];
      }
      scheduleSyncRef.current?.(next);
      return next;
    });
  };

  const removeItem = (id: string, attributeId?: string) => {
    const key = itemKey(id, attributeId);
    setItems(prev => {
      const next = prev.filter(i => itemKey(i.id, i.attributeId) !== key);
      scheduleSyncRef.current?.(next);
      return next;
    });
  };

  const updateQty = (id: string, qty: number, attributeId?: string) => {
    if (qty <= 0) { removeItem(id, attributeId); return; }
    const key = itemKey(id, attributeId);
    setItems(prev => {
      const next = prev.map(i => itemKey(i.id, i.attributeId) === key ? { ...i, qty } : i);
      scheduleSyncRef.current?.(next);
      return next;
    });
  };

  const clear = () => {
    setItems([]);
    setRemoteCartId(null);
    sessionStorage.removeItem(CART_KEY);
  };

  // ── Computed values ──

  const totalPriceHt = roundMoney(items.reduce((sum, i) => sum + i.priceHt * i.qty, 0));
  const totalPrice = roundMoney(items.reduce((sum, i) => sum + i.priceTtc * i.qty, 0));
  const totalTax = roundMoney(totalPrice - totalPriceHt);
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQty,
      clear,
      totalPrice,
      totalPriceHt,
      totalTax,
      totalItems,
      remoteCartId,
      loadingRemoteCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
