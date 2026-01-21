'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/CartProvider';

export default function SuccessPage() {
  const { clear } = useCart();

  // Clear the cart exactly once after success
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Payment successful 🎉</h1>
      <p className="mb-6 text-gray-700">Thanks for your order! We&apos;ve recorded it.</p>
      <Link
        href="/products"
        className="inline-block rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Continue shopping
      </Link>
    </main>
  );
}
