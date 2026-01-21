// src/app/product/[slug]/ProductClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/CartProvider";

type Variant = {
  id?: string;
  sku?: string | null;
  color?: string | null;
  storage?: string | null;
  price_cents?: number | null;
  stock?: number | null;
};

type ProductClientProduct = {
  id: string;
  slug: string;
  title: string;
  price_cents: number | null;
  compare_at_cents?: number | null;

  // images for display / cart
  image_url?: string | null;
  images?: Array<string | { url: string; alt?: string | null }> | null;

  variants?: Variant[] | null;

  // ✅ IMPORTANT: seller_id comes from the products table
  seller_id?: string | null;
};

type Props = { product: ProductClientProduct };

function money(cents?: number | null) {
  const v = typeof cents === "number" ? cents : 0;
  return `£${(v / 100).toFixed(2)}`;
}

export default function ProductClient({ product }: Props) {
  const { addItem } = useCart();

  const [qty, setQty] = useState<number>(1);

  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState<string | undefined>(
    variants.find((v) => (v.stock ?? 0) > 0)?.id
  );

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId),
    [variants, variantId]
  );

  const unitPrice = selectedVariant?.price_cents ?? product.price_cents ?? 0;

  // Choose a thumbnail for the cart
  const primaryImage = useMemo(() => {
    if (product.image_url) return product.image_url;
    if (Array.isArray(product.images) && product.images.length > 0) {
      const first = product.images[0];
      return typeof first === "string" ? first : first?.url ?? null;
    }
    return null;
  }, [product.image_url, product.images]);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  const handleAddToCart = () => {
    // Stable cart id (variant-specific if selected)
    const cartId = variantId ? `${product.id}:${variantId}` : product.id;

    // ✅ This is the seller’s user id from products.seller_id
    const sellerId = product.seller_id ?? null;

    addItem({
      id: cartId,
      name: product.title,
      price_cents: unitPrice,
      quantity: qty,
      image: primaryImage ?? undefined,
      meta: {
        slug: product.slug,
        seller_id: sellerId, // ✅ critical for seller hub / orders
        variantId: variantId || undefined,
        // Optional extra attributes to show in cart
        color: selectedVariant?.color,
        storage: selectedVariant?.storage,
        sku: selectedVariant?.sku,
      },
    });

    setToast("Added to cart");
    // setQty(1); // if you want to reset quantity
  };

  return (
    <div className="relative rounded-xl border p-4 shadow-sm">
      {variants.length > 0 && (
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-600">Variant</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.color, v.storage, v.sku].filter(Boolean).join(" / ") ||
                  "Default"}{" "}
                – {money(v.price_cents)}
                {(v.stock ?? 0) <= 0 ? " (Out of stock)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">Quantity</span>
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="h-8 w-8 rounded border text-lg leading-none"
        >
          –
        </button>
        <span className="w-8 text-center text-lg">{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          className="h-8 w-8 rounded border text-lg leading-none"
        >
          +
        </button>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600">Price</div>
        <div className="text-2xl font-semibold">{money(unitPrice)}</div>
        {product.compare_at_cents && product.compare_at_cents > unitPrice ? (
          <div className="text-sm text-gray-500 line-through">
            {money(product.compare_at_cents)}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleAddToCart}
        className="w-full rounded-md bg-black px-4 py-2 text-white hover:bg-black/80 disabled:opacity-60"
        disabled={
          (selectedVariant && (selectedVariant.stock ?? 0) <= 0) || qty < 1
        }
      >
        Add to cart
      </button>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute -top-3 right-3 rounded-full bg-black px-3 py-1 text-xs text-white shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
