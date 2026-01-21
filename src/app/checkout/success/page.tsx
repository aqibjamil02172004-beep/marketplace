// src/app/checkout/success/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

type OrderRow = {
  id: string;
  created_at: string;
  currency: string | null;
  amount_cents: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  stripe_session_id: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  title: string;
  qty: number;
  price_cents: number;
  image_url: string | null;
  product_slug: string | null;
};

function SuccessInner() {
  const sp = useSearchParams();
  const sid = sp.get('sid');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    const fn = order?.first_name ?? '';
    const ln = order?.last_name ?? '';
    const name = `${fn} ${ln}`.trim();
    return name || null;
  }, [order]);

  const addressLine = useMemo(() => {
    if (!order) return null;
    const parts = [
      order.address_line1,
      order.address_line2,
      order.city,
      order.state,
      order.postal_code,
      order.country,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }, [order]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!sid) {
          setLoading(false);
          return;
        }

        // 1) Fetch order by stripe_session_id
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select(
            `
            id,
            created_at,
            currency,
            amount_cents,
            first_name,
            last_name,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            country,
            stripe_session_id
          `
          )
          .eq('stripe_session_id', sid)
          .maybeSingle();

        if (orderErr) throw orderErr;

        if (!mounted) return;
        setOrder(orderData as OrderRow | null);

        // 2) Fetch items for that order (if found)
        if (orderData?.id) {
          const { data: itemsData, error: itemsErr } = await supabase
            .from('order_items')
            .select(
              `
              id,
              order_id,
              title,
              qty,
              price_cents,
              image_url,
              product_slug
            `
            )
            .eq('order_id', orderData.id)
            .order('created_at', { ascending: true });

          if (itemsErr) throw itemsErr;

          if (!mounted) return;
          setItems((itemsData ?? []) as OrderItemRow[]);
        } else {
          setItems([]);
        }
      } catch (e: any) {
        console.error('Success page load error:', e);
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load order details.');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [sid]);

  // Basic UI states
  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Payment successful 🎉</h1>
        <p className="mt-2 text-gray-600">Loading your order…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Payment successful 🎉</h1>
        <p className="mt-2 text-gray-600">Thanks for your order! We’ve recorded it.</p>
        <p className="mt-3 text-sm text-red-600">Error loading details: {error}</p>
        <Link href="/products" className="mt-6 inline-block rounded bg-black px-4 py-2 text-white">
          Continue shopping
        </Link>
      </main>
    );
  }

  // If we can’t find the order row (webhook delay / not inserted yet), show fallback
  if (!order) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Payment successful 🎉</h1>
        <p className="mt-2 text-gray-600">Thanks for your order! We’ve recorded it.</p>

        <div className="mt-4 rounded-lg border bg-white p-4 text-sm text-gray-700">
          <div className="font-medium">Order confirmation is processing.</div>
          <div className="text-gray-600">
            If this page doesn’t update, check your <Link className="underline" href="/orders">Orders</Link> in a minute.
          </div>
        </div>

        <Link href="/products" className="mt-6 inline-block rounded bg-black px-4 py-2 text-white">
          Continue shopping
        </Link>
      </main>
    );
  }

  // Show order summary
  const total = gbp.format(((order.amount_cents ?? 0) / 100) || 0);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">Payment successful 🎉</h1>
      <p className="mt-2 text-gray-600">Thanks for your order! Here’s your receipt.</p>

      <div className="mt-6 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm text-gray-600">
          <div>
            Order <code>{order.id.slice(0, 8)}…</code>
          </div>
          <div>{new Date(order.created_at).toLocaleString()}</div>
        </div>

        <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold">Ship to</div>
            <div className="mt-1 text-sm text-gray-800">{fullName ?? '—'}</div>
            {order.phone ? <div className="mt-1 text-sm text-gray-700">📞 {order.phone}</div> : null}
            <div className="mt-1 text-sm text-gray-600">{addressLine ?? '—'}</div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-600">Order total</div>
            <div className="text-2xl font-bold">{total}</div>
            <div className="mt-1 text-xs text-gray-500">
              Session: <code>{order.stripe_session_id?.slice(0, 10)}…</code>
            </div>
          </div>
        </div>

        <ul className="divide-y">
          {items.length === 0 ? (
            <li className="px-4 py-4 text-sm text-gray-600">Items are still loading—check Orders shortly.</li>
          ) : (
            items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                <div className="h-14 w-14 overflow-hidden rounded bg-gray-100">
                  {it.image_url ? (
                    // Using normal img to avoid Next Image host issues on random URLs
                    <img src={it.image_url} alt={it.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-gray-400">No image</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.title}</div>
                  <div className="text-sm text-gray-600">
                    Qty: {it.qty} · Unit: {gbp.format((it.price_cents ?? 0) / 100)}
                  </div>
                  {it.product_slug ? (
                    <div className="text-xs text-gray-500">
                      <Link className="underline" href={`/product/${it.product_slug}`}>
                        View product
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div className="whitespace-nowrap font-semibold">
                  {gbp.format(((it.qty ?? 0) * (it.price_cents ?? 0)) / 100)}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/products" className="rounded bg-black px-4 py-2 text-white">
          Continue shopping
        </Link>
        <Link href="/orders" className="rounded border px-4 py-2">
          View orders
        </Link>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  // ✅ This fixes the build error by putting the hook inside Suspense
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-6">Loading…</main>}>
      <SuccessInner />
    </Suspense>
  );
}
