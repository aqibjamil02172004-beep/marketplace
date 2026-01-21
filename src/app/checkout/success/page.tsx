'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

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

type ItemRow = {
  id: string;
  order_id: string;
  title: string;
  qty: number;
  price_cents: number;
  image_url: string | null;
  product_slug: string | null;
};

export default function SuccessPage() {
  const sp = useSearchParams();
  const sid = sp.get('sid');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    if (!order) return '';
    return `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim();
  }, [order]);

  const addressLine = useMemo(() => {
    if (!order) return '';
    const parts = [
      order.address_line1,
      order.address_line2,
      order.city,
      order.state,
      order.postal_code,
      order.country,
    ].filter(Boolean);
    return parts.join(', ');
  }, [order]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!sid) {
          setError('Missing checkout session id.');
          return;
        }

        // 1) fetch order by stripe_session_id
        const { data: orderRow, error: oErr } = await supabase
          .from('orders')
          .select(
            `
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
          `
          )
          .eq('stripe_session_id', sid)
          .maybeSingle();

        if (oErr) throw oErr;
        if (!orderRow) {
          setError('Order not found yet. If you just paid, refresh in a moment.');
          return;
        }

        // 2) fetch items for that order
        const { data: itemRows, error: iErr } = await supabase
          .from('order_items')
          .select('id, order_id, title, qty, price_cents, image_url, product_slug')
          .eq('order_id', orderRow.id)
          .order('created_at', { ascending: true });

        if (iErr) throw iErr;

        if (!mounted) return;
        setOrder(orderRow as OrderRow);
        setItems((itemRows ?? []) as ItemRow[]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load order.');
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Payment successful 🎉</h1>
      <p className="mt-2 text-gray-700">Thanks for your order! We’ve recorded it.</p>

      {loading && <p className="mt-6">Loading order…</p>}
      {error && <p className="mt-6 text-red-600">Error: {error}</p>}

      {!loading && !error && order && (
        <div className="mt-6 overflow-hidden rounded-xl border bg-white">
          <div className="flex items-start justify-between gap-4 border-b p-4">
            <div>
              <div className="text-sm text-gray-500">Order</div>
              <div className="font-semibold">
                <code>{order.id.slice(0, 8)}…</code>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-xl font-bold">
                {gbp.format((order.amount_cents ?? 0) / 100)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b p-4 sm:grid-cols-2">
            <div>
              <div className="font-semibold">Ship to</div>
              <div className="text-sm text-gray-800">{fullName || '—'}</div>
              {order.phone && <div className="text-sm text-gray-700">📞 {order.phone}</div>}
              <div className="text-sm text-gray-600">{addressLine || '—'}</div>
            </div>

            <div className="sm:text-right">
              <div className="font-semibold">What’s next</div>
              <div className="text-sm text-gray-600">
                You can track this order in your orders page.
              </div>
              <Link
                href="/orders"
                className="mt-2 inline-block rounded-md border px-3 py-2 text-sm font-semibold"
              >
                View my orders
              </Link>
            </div>
          </div>

          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 p-4">
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
                    <div className="text-xs text-gray-500">slug: {it.product_slug}</div>
                  )}
                </div>

                <div className="whitespace-nowrap font-semibold">
                  {gbp.format(((it.qty ?? 0) * (it.price_cents ?? 0)) / 100)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <Link href="/products" className="inline-block rounded bg-black px-4 py-2 text-white">
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
