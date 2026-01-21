'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';

const Tab = ({ href, label }: { href: string; label: string }) => {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md border text-sm ${
        active
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  );
};

export default function SellerLayout({ children }: PropsWithChildren) {
  return (
    <main className="p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Seller hub</h1>
          <div className="flex gap-2">
            <Tab href="/seller/products" label="Listings" />
            <Tab href="/seller/orders" label="Sales" />
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
