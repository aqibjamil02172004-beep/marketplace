'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type CartItem = {
  id: string;
  name: string;
  price_cents: number;
  quantity?: number;
  image?: string | null;
  meta?: Record<string, any> | null;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  count: number;
  totalCents: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}

function readFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem('cart:v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  // Start empty on both server & client (first render)
  const [items, setItems] = useState<CartItem[]>([]);

  // After mount, hydrate from localStorage (prevents hydration mismatch)
  useEffect(() => {
    setItems(readFromStorage());
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem('cart:v1', JSON.stringify(items));
    } catch {}
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        const prevItem = copy[idx];
        copy[idx] = {
          ...prevItem,
          quantity: (prevItem.quantity ?? 1) + (item.quantity ?? 1),
          meta: { ...(prevItem.meta ?? {}), ...(item.meta ?? {}) },
        };
        return copy;
      }
      return [...prev, { ...item, quantity: item.quantity ?? 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const count = useMemo(
    () => items.reduce((n, it) => n + (it.quantity ?? 1), 0),
    [items]
  );

  const totalCents = useMemo(
    () => items.reduce((sum, it) => sum + (it.price_cents ?? 0) * (it.quantity ?? 1), 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, clear, count, totalCents }),
    [items, addItem, removeItem, clear, count, totalCents]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
