import ProductsGrid from './ProductsGrid';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>; // 👈 Next 15: searchParams is a Promise
}) {
  const sp = await searchParams;               // 👈 await it
  const q = (sp?.q ?? '').toString();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          {q ? <p className="text-gray-600">Results for “{q}”</p> : <p className="text-gray-600">Browse our latest items</p>}
        </div>
      </div>
      <ProductsGrid q={q} />
    </main>
  );
}
