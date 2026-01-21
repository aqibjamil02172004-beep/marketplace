"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import supabase from "@/lib/supabaseClient";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

type OrderRow = {
  id: string;
  created_at: string;
  amount_cents: number | null;
  currency: string | null;
  stripe_session_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

type OrderItemRow = {
  id: string;
  title: string;
  qty: number;
  price_cents: number;
  image_url: string | null;
  product_slug: string | null;
};

export default function SuccessClient() {
  const searchParams = useSearchParams();
  const sid = searchParams.get("sid");

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    if (!order) return "";
    return `${order.first_name ?? ""} ${order.last_name ?? ""}`.trim();
  }, [order]);

  const addressLine = useMemo(() => {
    if (!order) return "";
    const parts = [
      order.address_line1,
      order.address_line2,
      order.city,
      order.state,
      order.postal_code,
      order.country,
    ].filter(Boolean);
    return parts.join(", ");
  }, [order]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!sid) {
          setOrder(null);
          setItems([]);
          setError("Missing checkout session id (sid).");
          return;
        }

        // 1) fetch the order by Stripe session id
        const { data: orderRow, error: orderErr } = await supabase
          .from("orders")
          .select(`
            id,
            created_at,
            amount_cents,
            currency,
            stripe_session_id,
            first_name,
            last_name,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            country
          `)
          .eq("stripe_session_id", sid)
          .maybeSingle();

        if (orderErr) throw orderErr;

        if (!orderRow) {
          // order not created yet (webhook delay) or not saved
          setOrder(null);
          setItems([]);
          setError("We couldn’t find your order yet. If you just paid, refresh in a few seconds.");
          return;
        }

        if (!mounted) return;
        setOrder(orderRow as OrderRow);

        // 2) fetch items for this order
        const { data: itemRows, error: itemsErr } = await supabase
          .from("order_items")
          .select(`id, title, qty, price_cents, image_url, product_slug`)
          .eq("order_id", orderRow.id)
          .order("created_at", { ascending: false });

        if (itemsErr) throw itemsErr;

        if (!mounted) return;
        setItems((itemRows ?? []) as OrderItemRow[]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load order details.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [sid]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.qty ?? 0) * (it.price_cents ?? 0), 0);
  }, [items]);

  const orderTotal = order?.amount_cents ?? subtotal;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-green-50">
            <span className="text-2xl">✅</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Payment successful</h1>
            <p className="mt-1 text-sm text-gray-600">
              Thanks for your order. Your payment has been confirmed.
            </p>
            {sid && (
              <p className="mt-2 text-xs text-gray-400">
                Session: <span className="font-mono">{sid}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
          >
            Continue shopping
          </Link>
          <Link
            href="/orders"
            className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            View my orders
          </Link>
        </div>

        <hr className="my-6" />

        {loading && (
          <div className="text-sm text-gray-600">Loading your order details…</div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
            <div className="mt-2">
              <button
                onClick={() => location.reload()}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {!loading && !error && order && (
          <div className="space-y-6">
            {/* Order summary header */}
            <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Order details
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Order ID:</span>{" "}
                    <span className="font-mono">{order.id.slice(0, 8)}…</span>
                  </div>
                  <div>
                    <span className="font-semibold">Date:</span>{" "}
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Total paid
                </div>
                <div className="mt-1 text-xl font-bold">
                  {gbp.format((orderTotal ?? 0) / 100)}
                </div>
                <div className="text-xs text-gray-500">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {/* Shipping */}
            <div className="rounded-xl border p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Shipping to
              </div>
              <div className="mt-2 text-sm text-gray-800">
                <div className="font-semibold">{fullName || "—"}</div>
                {order.phone && <div className="mt-1">📞 {order.phone}</div>}
                <div className="mt-1 text-gray-600">{addressLine || "—"}</div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl border">
              <div className="border-b px-4 py-3 text-sm font-semibold">Items</div>
              <ul className="divide-y">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded bg-gray-100">
                      {it.image_url ? (
                        <Image src={it.image_url} alt={it.title} fill className="object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs text-gray-400">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{it.title}</div>
                      <div className="text-sm text-gray-600">
                        Qty: {it.qty} · Unit: {gbp.format((it.price_cents ?? 0) / 100)}
                      </div>
                      {it.product_slug && (
                        <div className="text-xs text-gray-500">
                          <Link className="hover:underline" href={`/product/${it.product_slug}`}>
                            View product
                          </Link>
                        </div>
                      )}
                    </div>

                    <div className="whitespace-nowrap font-semibold">
                      {gbp.format(((it.qty ?? 0) * (it.price_cents ?? 0)) / 100)}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Totals */}
              <div className="border-t px-4 py-3 text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span>Items subtotal</span>
                  <span className="font-semibold">{gbp.format((subtotal ?? 0) / 100)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-gray-900">
                  <span className="font-semibold">Total</span>
                  <span className="text-base font-bold">{gbp.format((orderTotal ?? 0) / 100)}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Tip: if you don’t see address/phone here, it means Stripe checkout didn’t collect it or your webhook
              didn’t save it into the <span className="font-mono">orders</span> table.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
