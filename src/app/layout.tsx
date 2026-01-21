// src/app/layout.tsx (yours is already good)
import './globals.css';
import Providers from './providers';
import Header from './Header';
import { Suspense } from "react";

export const metadata = {
  title: 'Alvy',
  description: 'Simple e-commerce store built with Next.js, Supabase & Stripe',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <Providers>
          <Suspense fallback={null}>

          <Header />
          </Suspense>

          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
