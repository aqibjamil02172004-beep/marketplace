// src/app/checkout/page.tsx
"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import supabase from "@/lib/supabaseClient";
import { useCart } from "@/lib/CartProvider";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

type CheckoutItem = {
  id: string;
  slug?: string | null;
  name: string;
  image?: string | null;
  price_cents: number;
  quantity: number;
  seller_id?: string | null;
  options?: unknown | null;
};

export default function CheckoutPage() {
  const { items, count, totalCents, clear } = useCart();
  const [loading, setLoading] = React.useState(false);

  async function handleCheckout() {
    try {
      setLoading(true);

      // Get current user so we can attach user_id to the order
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        console.error("Failed to get user:", userErr);
        alert("Please sign in before checking out.");
        setLoading(false);
        return;
      }
      const user_id = userRes.user.id;

      // Map cart items → payload for Edge function
      const payloadItems: CheckoutItem[] = items.map((i: any) => ({
        id: i.id,
        slug: i.meta?.slug ?? null,
        name: i.name,
        image: i.image ?? null,
        price_cents: i.price_cents ?? 0,
        quantity: i.quantity ?? 1,
        seller_id: i.meta?.seller_id ?? i.meta?.sellerId ?? null,

        options: i.options ?? null,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems, user_id }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Checkout failed");
      }

      const { url } = await res.json();
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (e) {
      console.error("Checkout error:", e);
      alert("Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Empty cart state – same logic as /cart page
  if (!count || count === 0) {
    return (
      <main className="mx-auto max-w-4xl p-6 text-center">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <p className="text-gray-600 mb-6">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
        >
          Browse products →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <p className="text-gray-600 mt-1">
        {count} item{count > 1 ? "s" : ""}
      </p>

      {/* Items list */}
      <ul className="mt-8 divide-y divide-gray-200">
        {items.map((item: any) => {
          const lineTotal = (item.price_cents ?? 0) * (item.quantity ?? 1);
          return (
            <li key={item.id} className="py-4 flex items-center gap-4">
              <div className="h-20 w-20 relative flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400 text-sm">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.name}</p>
                {item.meta?.slug ? (
                  <Link
                    href={`/product/${item.meta.slug}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View product
                  </Link>
                ) : null}
                <div className="mt-1 text-sm text-gray-600">
                  Qty: <span className="font-medium">{item.quantity}</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Unit:{" "}
                  <span className="font-medium">
                    {gbp.format((item.price_cents ?? 0) / 100)}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold">
                  {gbp.format(lineTotal / 100)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary + actions */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={clear}
          className="text-sm underline underline-offset-4 hover:no-underline self-start"
        >
          Clear cart
        </button>

        <div className="sm:text-right">
          <p className="text-lg">
            Subtotal:{" "}
            <span className="font-semibold">
              {gbp.format(totalCents / 100)}
            </span>
          </p>
          <p className="text-xs text-gray-500">
            Taxes and shipping calculated at checkout.
          </p>

          <div className="mt-3 flex gap-3 justify-end">
            <Link
              href="/products"
              className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Continue shopping
            </Link>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/80 disabled:opacity-60"
            >
              {loading ? "Redirecting…" : "Pay with Stripe →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
