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

  stripe_session_id: string | null;
  stripe_payment_intent: string | null;

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
  const [statusMsg, setStatusMsg] = useState<string>('Confirming your order…');
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

  const calcItemsTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.qty ?? 0) * (it.price_cents ?? 0), 0);
  }, [items]);

  async function fetchOrderAndItems(sessionId: string) {
    // 1) Try find order by stripe_session_id
    let { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .select(
        `
        id,
        created_at,
        currency,
        amount_cents,
        stripe_session_id,
        stripe_payment_intent,
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
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (orderErr) throw orderErr;

    // 2) If not found, try use Stripe session to get payment_intent via your Edge Function
    //    (We call your existing function "create-checkout-session"? No.
    //    So we do a second DB lookup attempt only if webhook wrote payment_intent but not session_id.)
    //    If your webhook *does* store payment_intent, you can pass it in the success URL later.
    //    For now: fallback query by session_id only; and if orderData has payment_intent, great.

    if (!orderData) return { order: null as OrderRow | null, items: [] as OrderItemRow[] };

    // 3) Fetch items for that order
    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, order_id, title, qty, price_cents, image_url, product_slug')
      .eq('order_id', orderData.id)
      .order('created_at', { ascending: true });

    if (itemsErr) throw itemsErr;

    return { order: orderData as OrderRow, items: (itemsData ?? []) as OrderItemRow[] };
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!sid) {
          setStatusMsg('Missing checkout session. Please check your Orders.');
          return;
        }

        // Retry because webhook may be delayed
        const attempts = 6;          // ~6 tries
        const delayMs = 1200;        // ~1.2s between tries

        for (let i = 0; i < attempts; i++) {
          if (!mounted) return;

          setStatusMsg(i === 0 ? 'Confirming your order…' : 'Still confirming…');

          const res = await fetchOrderAndItems(sid);

          if (res.order) {
            if (!mounted) return;
            setOrder(res.order);
            setItems(res.items);
            setStatusMsg('Order confirmed!');
            return;
          }

          // wait before next try
          await new Promise((r) => setTimeout(r, delayMs));
        }

        // Not found after retries
        setOrder(null);
        setItems([]);
        setStatusMsg('Payment received. Your order is still processing.');
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

  // ---- UI ----

  const niceTotal = gbp.format(((order?.amount_cents ?? 0) / 100) || 0);
  const itemsTotal = gbp.format((calcItemsTotal ?? 0) / 100);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Payment successful 🎉</h1>
            <p className="mt-2 text-gray-600">
              {error ? 'We received your payment, but couldn’t load the receipt.' : statusMsg}
            </p>
          </div>

          <div className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
            Paid
          </div>
        </div>

        {/* Top actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products" className="rounded-lg bg-black px-4 py-2 text-white">
            Continue shopping
          </Link>
          <Link href="/orders" className="rounded-lg border px-4 py-2">
            View orders
          </Link>
        </div>

        {/* Receipt block */}
        <div className="mt-6 overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <div>
              {order ? (
                <>
                  Order <code>{order.id.slice(0, 8)}…</code>
                </>
              ) : (
                <>Receipt</>
              )}
            </div>
            <div>
              {order ? new Date(order.created_at).toLocaleString() : (sid ? `Session ${sid.slice(0, 10)}…` : '—')}
            </div>
          </div>

          {/* If order exists: show ship-to + totals */}
          {order ? (
            <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold">Ship to</div>
                <div className="mt-1 text-sm text-gray-800">{fullName ?? '—'}</div>
                {order.phone ? <div className="mt-1 text-sm text-gray-700">📞 {order.phone}</div> : null}
                <div className="mt-1 text-sm text-gray-600">{addressLine ?? '—'}</div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-600">Order total</div>
                <div className="text-2xl font-bold">{niceTotal}</div>
                <div className="mt-2 text-xs text-gray-500">
                  Items: {itemsTotal}
                </div>
              </div>
            </div>
          ) : (
            // Fallback receipt look (still nice)
            <div className="border-b px-4 py-4 text-sm text-gray-700">
              <div className="font-semibold">What happens next?</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
                <li>We’ve received your payment.</li>
                <li>Your order will appear in <Link className="underline" href="/orders">Orders</Link> shortly.</li>
                <li>If it takes more than a minute, refresh this page.</li>
              </ul>
            </div>
          )}

          {/* Items */}
          <div className="px-4 py-3">
            <div className="mb-2 text-sm font-semibold">Items</div>

            {order && items.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-4 p-3">
                    <div className="h-14 w-14 overflow-hidden rounded bg-gray-100">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.title} className="h-full w-full object-cover" />
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
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                {loading ? 'Loading items…' : 'Items will appear here once the order is confirmed.'}
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        {/* Small help text */}
        <p className="mt-4 text-xs text-gray-500">
          If you paid and don’t see the order, check <Link className="underline" href="/orders">Orders</Link>.
        </p>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-6">Loading…</main>}>
      <SuccessInner />
    </Suspense>
  );
}
