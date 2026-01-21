import ImageGallery from "./ImageGallery";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";
import supabase from "@/lib/supabaseClient";


/* ------------------------------- Types ------------------------------- */
export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  brand: string | null;
  price_cents: number | null;
  compare_at_cents?: number | null;
  images?: Array<string | { url: string; alt?: string | null }> | null;
  image_url?: string | null;
  seller_id?: string | null;
};

/* ----------------------------- Data Fetch ---------------------------- */
async function getProduct(slug: string): Promise<ProductRow | null> {
 

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      slug,
      title,
      description,
      brand,
      price_cents,
      compare_at_cents,
      images,
      image_url,
      seller_id
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Failed to load product:", error);
    return null;
  }

  return (data ?? null) as ProductRow | null;
}

/* ----------------------------- Utilities ---------------------------- */
function money(cents?: number | null) {
  const v = typeof cents === "number" ? cents : 0;
  return `£${(v / 100).toFixed(2)}`;
}

function coerceGallery(product: ProductRow): string[] {
  if (Array.isArray(product.images)) {
    const out: string[] = [];
    for (const item of product.images) {
      if (typeof item === "string") out.push(item);
      else if (item && typeof item === "object" && "url" in item && typeof item.url === "string") {
        out.push(item.url);
      }
    }
    if (out.length) return out;
  }
  if (product.image_url) return [product.image_url];
  return [];
}

/* ------------------------------ Page UI ----------------------------- */
// In your setup, params is a Promise (Next 16) — await it.
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await getProduct(slug);
  if (!product) notFound();

  const price = product.price_cents ?? 0;
  const comparePrice = product.compare_at_cents ?? 0;
  const showDiscount = comparePrice > price && price > 0;
  const discountPct = showDiscount
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;

  const gallery = coerceGallery(product);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-10 md:grid-cols-2">
        {/* Gallery */}
        <section>
          <ImageGallery images={gallery} title={product.title} />
        </section>

        {/* Product info */}
        <section>
          <div className="mb-4 text-sm text-gray-500">
            <Link href="/products" className="hover:underline">
              ← All products
            </Link>
          </div>

          <h1 className="text-3xl font-semibold leading-tight">{product.title}</h1>
          {product.brand && (
            <p className="mt-1 text-sm text-gray-500">by {product.brand}</p>
          )}

          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-bold">{money(price)}</span>
            {showDiscount && (
              <>
                <span className="text-sm text-gray-500 line-through">
                  {money(comparePrice)}
                </span>
                <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">
                  -{discountPct}%
                </span>
              </>
            )}
          </div>

          {product.description && (
            <article className="prose prose-sm mt-6 max-w-none">
              <p>{product.description}</p>
            </article>
          )}

          <div className="mt-8">
            <ProductClient product={product} />
          </div>

          <div className="mt-8">
            <Link href="/products" className="text-blue-600 text-sm underline">
              ← Continue shopping
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
