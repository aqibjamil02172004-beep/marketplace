'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
};

const Ctx = createContext<CartContextType | null>(null);

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('CartProvider missing');
  return c;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Add a new item or increase quantity if already in cart
  const addItem = (item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  };

  // Remove an item
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Update quantity
  const updateQuantity = (id: string, quantity: number) => {
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, quantity } : i))
    );
  };

  // Empty the cart
  const clear = () => setItems([]);

  // Derived values
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clear,
      totalItems,
      totalPrice,
    }),
    [items]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
