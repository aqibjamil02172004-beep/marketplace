'use client';

import { useCart } from '@/lib/CartProvider';

type ProductForCart = {
  id: string;
  title: string;
  price_cents: number;
  slug: string;
  image_url?: string | null;
  // Your products table may use either seller_id or owner_id — we accept both.
  seller_id?: string | null;
  owner_id?: string | null;

  // Optional variant fields you might have on the page
  color?: string | null;
  storage?: string | null;
  size?: string | null;
};

export default function AddToCartButton({ product }: { product: ProductForCart }) {
  const { addItem } = useCart();

  function onAdd() {
    const seller = product.seller_id ?? product.owner_id ?? null;

    // ✅ Add to cart with both top-level fields (for your current checkout)
    // ✅ Also keep everything in meta (future-proof / type-safe)
    addItem({
      id: product.id,
      name: product.title,
      price_cents: product.price_cents ?? 0,
      quantity: 1,
      image: product.image_url ?? null,

      // These two are critical for orders/seller hub:
      // (TS might not know these props on CartItem; keep them in meta too.)
      // @ts-expect-error extra fields used by checkout mapping
      slug: product.slug,
      
       seller_id: product.seller_id, 

      meta: {
        slug: product.slug,
        seller_id: seller,
        color: product.color ?? null,
        storage: product.storage ?? null,
        size: product.size ?? null,
      },
    });

    alert('Added to cart');
  }

  return (
    <button
      onClick={onAdd}
      className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
    >
      Add to cart
    </button>
  );
}
