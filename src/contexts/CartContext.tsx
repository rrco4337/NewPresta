import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useCustomer } from './CustomerContext';
import { syncRemoteCart, fetchCustomerCart } from '../services/cartSyncService';
import { fetchShopProductDetail } from '../services/shopService';

const CART_KEY = 'shopCart';
const REMOTE_CART_ID_KEY = 'shopRemoteCartId';

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

// ── Persistence helpers (localStorage) ────────────────────────────────────────

function readCartFromStorage(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as unknown;
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

function writeCartToStorage(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

// ── Merge helper ──────────────────────────────────────────────────────────────
// Prioritise remote items; append local items absent from remote.
function mergeCartItems(remote: CartItem[], local: CartItem[]): CartItem[] {
  const merged = [...remote];
  for (const localItem of local) {
    const key = itemKey(localItem.id, localItem.attributeId);
    const alreadyPresent = merged.some(i => itemKey(i.id, i.attributeId) === key);
    if (!alreadyPresent) merged.push(localItem);
  }
  return merged;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customer } = useCustomer();
  const [items, setItems] = useState<CartItem[]>(readCartFromStorage);
  const [remoteCartId, setRemoteCartId] = useState<string | null>(
    () => localStorage.getItem(REMOTE_CART_ID_KEY)
  );
  const [loadingRemoteCart, setLoadingRemoteCart] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCustomerIdRef = useRef<string | null>(null);

  // ── Persist cart items to localStorage on every change ──
  useEffect(() => {
    writeCartToStorage(items);
  }, [items]);

  // ── Persist remoteCartId to localStorage ──
  useEffect(() => {
    if (remoteCartId) {
      localStorage.setItem(REMOTE_CART_ID_KEY, remoteCartId);
    } else {
      localStorage.removeItem(REMOTE_CART_ID_KEY);
    }
  }, [remoteCartId]);

  // ── Handle customer login/logout ──────────────────────────────────────────
  useEffect(() => {
    const customerId = customer?.id ?? null;

    // Skip if same customer (no change)
    if (customerId === prevCustomerIdRef.current) return;
    prevCustomerIdRef.current = customerId;

    if (!customerId) {
      // Logout → wipe everything
      setItems([]);
      setRemoteCartId(null);
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(REMOTE_CART_ID_KEY);
      return;
    }

    // Login → reconcile local + remote carts
    let cancelled = false;
    setLoadingRemoteCart(true);

    (async () => {
      try {
        // Snapshot local items before any async operations can mutate them
        const localItems = readCartFromStorage();

        const remote = await fetchCustomerCart(customerId);
        if (cancelled) return;

        if (remote && remote.items.length > 0) {
          // Remote cart exists with items — load full product details
          setRemoteCartId(remote.cartId);

          const loadedItems: CartItem[] = [];
          for (const row of remote.items) {
            try {
              const detail = await fetchShopProductDetail(row.productId);
              if (cancelled) return;
              if (detail) {
                let priceHt  = detail.product.priceHt;
                let priceTtc = detail.product.priceTtc;
                let variantLabel: string | undefined;

                if (row.attributeId) {
                  const combo = detail.combinations.find(c => c.id === row.attributeId);
                  if (combo) {
                    priceHt  = detail.product.priceHt + combo.priceImpact;
                    priceTtc = priceHt * (1 + detail.product.taxRate);
                    variantLabel = combo.label;
                  }
                }

                loadedItems.push({
                  id: detail.product.id,
                  attributeId: row.attributeId,
                  variantLabel,
                  name: detail.product.name,
                  priceHt,
                  priceTtc,
                  taxRate: detail.product.taxRate,
                  qty: row.quantity,
                  imageUrl: detail.images[0],
                });
              }
            } catch {
              console.warn('[CartContext] Could not load product', row.productId);
            }
          }

          if (!cancelled && loadedItems.length > 0) {
            if (localItems.length > 0) {
              // Both have items → merge and sync back to keep remote up to date
              const merged = mergeCartItems(loadedItems, localItems);
              setItems(merged);
              console.log('[CartContext] Merged local + remote cart:', merged.length, 'items');
              // Sync merged cart to remote (no debounce — do it now)
              const updatedId = await syncRemoteCart({
                customerId,
                items: merged,
                existingCartId: remote.cartId,
                secureKey: customer?.secureKey,
              });
              if (!cancelled && updatedId) setRemoteCartId(updatedId);
            } else {
              setItems(loadedItems);
              console.log('[CartContext] Restored remote cart:', loadedItems.length, 'items');
            }
          }
        } else {
          // No remote free cart — keep local items and create a brand-new PS cart.
          // Do NOT reuse any stored cartId: fetchCustomerCart already confirmed there
          // is no free cart, so any stored ID belongs to an already-ordered cart.
          localStorage.removeItem(REMOTE_CART_ID_KEY);
          if (localItems.length > 0) {
            setItems(localItems);
            console.log('[CartContext] No free remote cart — creating new PS cart with local items:', localItems.length);
            const newCartId = await syncRemoteCart({
              customerId,
              items: localItems,
              // existingCartId intentionally omitted → always POST a fresh cart
              secureKey: customer?.secureKey,
            });
            if (!cancelled && newCartId) setRemoteCartId(newCartId);
          } else {
            setItems([]);
            setRemoteCartId(null);
          }
        }
      } catch (err) {
        console.error('[CartContext] Failed to reconcile remote cart:', err);
      } finally {
        if (!cancelled) setLoadingRemoteCart(false);
      }
    })();

    return () => { cancelled = true; };
  }, [customer]);

  // ── Debounced remote sync (triggered by cart mutations) ──
  const scheduleSyncRef = useRef<((newItems: CartItem[]) => void) | undefined>(undefined);

  const scheduleSync = useCallback((newItems: CartItem[]) => {
    if (!customer) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      const cartId = await syncRemoteCart({
        customerId: customer.id,
        items: newItems,
        existingCartId: remoteCartId ?? undefined,
        secureKey: customer.secureKey,
      });
      if (cartId) setRemoteCartId(cartId);
    }, 500);
  }, [customer, remoteCartId]);

  // Keep ref up to date
  useEffect(() => {
    scheduleSyncRef.current = scheduleSync;
  }, [scheduleSync]);

  // ── Cart mutations ────────────────────────────────────────────────────────

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

  // Called after successful checkout — wipes everything cleanly
  const clear = () => {
    setItems([]);
    setRemoteCartId(null);
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(REMOTE_CART_ID_KEY);
  };

  // ── Computed totals ────────────────────────────────────────────────────────

  const totalPriceHt = roundMoney(items.reduce((sum, i) => sum + i.priceHt * i.qty, 0));
  const totalPrice   = roundMoney(items.reduce((sum, i) => sum + i.priceTtc * i.qty, 0));
  const totalTax     = roundMoney(totalPrice - totalPriceHt);
  const totalItems   = items.reduce((sum, i) => sum + i.qty, 0);

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
