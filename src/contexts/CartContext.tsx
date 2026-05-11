import React, { createContext, useContext, useState, useEffect } from 'react';

const CART_KEY = 'ps_shop_cart';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export interface CartItem {
  id: string;
  name: string;
  priceHt: number;
  priceTtc: number;
  taxRate: number;
  qty: number;
  imageUrl?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  totalPrice: number;
  totalPriceHt: number;
  totalTax: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as unknown;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const anyItem = item as Partial<CartItem> & { price?: number };
          const legacyPrice = typeof anyItem.price === 'number'
            ? anyItem.price
            : (typeof (anyItem as { price?: string }).price === 'string'
              ? parseFloat((anyItem as { price?: string }).price ?? '0')
              : 0);
          const priceHt = typeof anyItem.priceHt === 'number'
            ? anyItem.priceHt
            : (typeof (anyItem as { priceHt?: string }).priceHt === 'string'
              ? parseFloat((anyItem as { priceHt?: string }).priceHt ?? '0')
              : legacyPrice);
          const priceTtc = typeof anyItem.priceTtc === 'number'
            ? anyItem.priceTtc
            : (typeof (anyItem as { priceTtc?: string }).priceTtc === 'string'
              ? parseFloat((anyItem as { priceTtc?: string }).priceTtc ?? '0')
              : priceHt);
          const taxRate = typeof anyItem.taxRate === 'number'
            ? anyItem.taxRate
            : (priceHt > 0 ? Math.max(0, priceTtc / priceHt - 1) : 0);
          const qty = typeof anyItem.qty === 'number'
            ? anyItem.qty
            : (typeof (anyItem as { qty?: string }).qty === 'string'
              ? parseInt((anyItem as { qty?: string }).qty ?? '1', 10) || 1
              : 1);
          return {
            id: String((anyItem.id ?? '')),
            name: String((anyItem.name ?? '')),
            priceHt,
            priceTtc,
            taxRate,
            qty,
            imageUrl: anyItem.imageUrl,
          } satisfies CartItem;
        })
        .filter((item): item is CartItem => Boolean(item && item.id));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };

  const clear = () => setItems([]);

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
