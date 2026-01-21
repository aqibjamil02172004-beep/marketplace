'use client';

import type { ReactNode } from 'react';
import CartProvider from '@/lib/CartProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
