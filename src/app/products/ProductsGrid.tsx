// src/app/products/ProductsGrid.tsx
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

type Props = {
  q?: string;
  limit?: number;
};

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  price_cents: number | null;
  compare_at_cents?: number | null;
  images?: string[] | null;
  image_url?: string | null;
  lifecycle?: string | null;
};

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function firstImageOf(p: ProductRow): string {
  if (Array.isArray(p.images) && p.images.length > 0 && typeof p.images[0] === 'string') {
    return p.images[0]!;
  }
  return p.image_url ?? '';
}

export default async function ProductsGrid({ q = '', limit }: Props) {
  const supabase = createClient();

  // Build query
  let query = supabase
    .from('products')
    .select(
      `
        id,
        title,
        slug,
        price_cents,
        compare_at_cents,
        images,
        image_url,
        lifecycle
      `
    )
    .order('created_at', { ascending: false });

  if (q.trim()) {
    query = query.ilike('title', `%${q.trim()}%`);
  }
  if (typeof limit === 'number' && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Products query error:', error);
    return <p className="text-red-600">Failed to load products.</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-gray-600">No products found.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((p: ProductRow) => {
        const img = firstImageOf(p);
        const price = p.price_cents ?? 0;
        const rrp = p.compare_at_cents ?? null;
        const hasDiscount = !!rrp && rrp > price;
        const discountPct = hasDiscount ? Math.round(((rrp - price) / rrp) * 100) : 0;

        return (
          <li key={p.id}>
            <Link href={`/product/${p.slug}`} className="block">
              <div className="relative mb-3 aspect-square overflow-hidden rounded-md bg-gray-100">
                {img ? (
                  <>
                    {hasDiscount && (
                      <span className="absolute left-2 top-2 z-10 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        -{discountPct}%
                      </span>
                    )}
                    <img
                       src={img}
  alt={p.title}
  className="h-full w-full object-cover"
  loading="lazy"
  referrerPolicy="no-referrer"
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">
                    No image
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="line-clamp-1 text-sm text-gray-900">{p.title}</h3>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {gbp.format((price ?? 0) / 100)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-gray-400 line-through">
                      {gbp.format((rrp ?? 0) / 100)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
