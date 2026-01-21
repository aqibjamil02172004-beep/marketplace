// src/app/providers.tsx
'use client';
import { ReactNode } from 'react';
import CartProvider  from '@/lib/CartProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
