import Link from 'next/link';
import ProductsGrid from './products/ProductsGrid';

export const dynamic = 'force-dynamic'; // show fresh products

export default async function Home() {
  return (
    <main>
      {/* Hero banner */}
      <section className="border-b bg-yellow-100">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-3xl font-bold">Every grail has a story</h1>
          <p className="mt-1 text-gray-700">Find deals across electronics, fashion, home & more.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/products?q=hoodie" className="rounded-md bg-black px-4 py-2 text-white hover:bg-black/80">
              Shop now
            </Link>
            <Link href="/products" className="rounded-md border px-4 py-2 hover:bg-gray-50">
              Browse all
            </Link>
          </div>
        </div>
      </section>

      {/* Product feed */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Latest products</h2>
          <Link href="/products" className="text-sm text-blue-600 hover:underline">
            See all →
          </Link>
        </div>
        {/* Reuse the same grid component the /products page uses */}
        {/* Empty q shows all */}
        <ProductsGrid q="" limit={12} />
      </section>
    </main>
  );
}
