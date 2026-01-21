'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import supabase from '@/lib/supabaseClient';



const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

/* --- Types --- */
type JoinedOrder = {
  id: string;
  created_at: string;
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
};

type ItemRow = {
  id: string;
  created_at: string; // order_items.created_at
  order_id: string;
  seller_id: string | null;
  product_slug: string | null;
  title: string;
  qty: number;
  price_cents: number;
  image_url: string | null;
  orders?: JoinedOrder; // join result
};

type OrderGroup = {
  order: JoinedOrder;
  items: ItemRow[];
};

function formatShipTo(order: JoinedOrder) {
  const fullName = `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim() || '—';

  const line1 = order.address_line1 ?? '';
  const line2 = order.address_line2 ?? '';
  const cityState = [order.city, order.state].filter(Boolean).join(', ');
  const post = order.postal_code ?? '';
  const country = order.country ?? '';

  const lines = [line1, line2, [cityState, post].filter(Boolean).join(' ').trim(), country].filter(
    (x) => x && x.trim().length > 0
  );

  return { fullName, phone: order.phone ?? null, lines };
}

export default function SellerSalesPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!mounted) return;

      setLoading(true);
      setError(null);

      // Safety timeout so the UI never stays stuck forever
      const timeout = setTimeout(() => {
        if (!mounted) return;
        setLoading(false);
        setError('Timed out loading sales. Please refresh.');
      }, 12000);

      try {
        // 1) Wait for session to be ready
        // (getSession is often more reliable immediately after refresh)
        const { data: sRes, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;

        const uid = sRes?.session?.user?.id ?? null;

        if (!uid) {
          // Not signed in (or session not restored yet)
          // Don’t throw — just show friendly message.
          setUserId(null);
          setItems([]);
          setLoading(false);
          setError('Please sign in to view seller sales.');
          return;
        }

        setUserId(uid);

        // 2) Try JOIN query (best UX)
        const { data: joined, error: joinErr } = await supabase
          .from('order_items')
          .select(
            `
            id,
            created_at,
            order_id,
            seller_id,
            product_slug,
            title,
            qty,
            price_cents,
            image_url,
            orders:orders!inner(
              id,
              created_at,
              amount_cents,
              first_name,
              last_name,
              phone,
              address_line1,
              address_line2,
              city,
              state,
              postal_code,
              country
            )
          `
          )
          .eq('seller_id', uid)
          .order('created_at', { ascending: false });

        if (!mounted) return;

        if (!joinErr && Array.isArray(joined)) {
          setItems(joined as unknown as ItemRow[]);
          setLoading(false);
          return;
        }

        // 3) Fallback path (if orders join blocked by RLS)
        console.warn('Join blocked/failed; fallback path. Details:', joinErr?.message);

        const { data: plainItems, error: itemsErr } = await supabase
          .from('order_items')
          .select(
            `
            id,
            created_at,
            order_id,
            seller_id,
            product_slug,
            title,
            qty,
            price_cents,
            image_url
          `
          )
          .eq('seller_id', uid)
          .order('created_at', { ascending: false });

        if (itemsErr) throw itemsErr;

        // Try to fetch orders (may still be blocked by RLS for sellers)
        const orderIds = Array.from(new Set((plainItems ?? []).map((i) => i.order_id)));
        let ordersById = new Map<string, JoinedOrder>();

        if (orderIds.length) {
          const { data: ordersData, error: ordersErr } = await supabase
            .from('orders')
            .select(
              `
              id,
              created_at,
              amount_cents,
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
            .in('id', orderIds);

          if (!ordersErr && ordersData) {
            ordersById = new Map(ordersData.map((o) => [o.id, o as JoinedOrder]));
          } else {
            console.warn('Orders fetch blocked by RLS; items only. Details:', ordersErr?.message);
          }
        }

        const stitched = (plainItems ?? []).map((it) => ({
          ...it,
          orders: ordersById.get(it.order_id),
        })) as ItemRow[];

        setItems(stitched);
        setLoading(false);
      } catch (e: any) {
        console.error('Seller sales load error:', e);
        if (!mounted) return;
        setLoading(false);
        setError(e?.message ?? 'Failed to load sales.');
      } finally {
        clearTimeout(timeout);
      }
    }

    // Initial load
    load();

    // ✅ Key fix: re-run load when auth changes (after refresh / token restore)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const grouped: OrderGroup[] = useMemo(() => {
    const map = new Map<string, OrderGroup>();

    for (const it of items) {
      if (!it.orders) continue;
      const key = it.order_id;
      const exist = map.get(key);
      if (exist) exist.items.push(it);
      else map.set(key, { order: it.orders, items: [it] });
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime()
    );
  }, [items]);

  if (loading) return <main className="p-6">Loading…</main>;
  if (error) return <main className="p-6 text-red-600">Error: {error}</main>;

  const noOrdersVisible = grouped.length === 0 && items.length > 0 && !items[0].orders;

  return (
    <main className="p-6">
      <h1 className="mb-2 text-2xl font-bold">Seller hub — Sales</h1>
      <p className="mb-6 text-sm text-gray-500">
        Seller: {userId ?? '—'} • Orders: {grouped.length}
      </p>

      {grouped.length === 0 && !noOrdersVisible && <p>No sales yet.</p>}

      {grouped.length > 0 && (
        <ul className="space-y-6">
          {grouped.map(({ order, items: itemsInOrder }) => {
            const ship = formatShipTo(order);

            return (
              <li key={order.id} className="overflow-hidden rounded-xl border">
                <header className="flex items-center justify-between border-b px-4 py-3 text-sm text-gray-600">
                  <div>
                    Order <code>{order.id.slice(0, 8)}…</code>
                  </div>
                  <div>{new Date(order.created_at).toLocaleString()}</div>
                </header>

                <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2">
                  <div>
                    <div className="font-semibold">Ship to</div>
                    <div className="text-sm text-gray-800">{ship.fullName}</div>

                    {ship.phone && (
                      <div className="text-sm text-gray-700">
                        <span className="mr-1">📞</span>
                        {ship.phone}
                      </div>
                    )}

                    <div className="mt-1 text-sm text-gray-600">
                      {ship.lines.length ? ship.lines.map((l, i) => <div key={i}>{l}</div>) : <div>—</div>}
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-700">
                    Order total:{' '}
                    <span className="font-semibold">{gbp.format((order.amount_cents ?? 0) / 100)}</span>
                  </div>
                </div>

                <ul className="divide-y">
                  {itemsInOrder.map((it) => (
                    <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="relative h-14 w-14 overflow-hidden rounded bg-gray-100">
                        {it.image_url ? (
                          <Image src={it.image_url} alt={it.title} fill className="object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-gray-400">No image</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{it.title}</div>
                        <div className="text-sm text-gray-600">
                          Qty: {it.qty} · Unit: {gbp.format((it.price_cents ?? 0) / 100)}
                        </div>
                        {it.product_slug && <div className="text-xs text-gray-500">slug: {it.product_slug}</div>}
                      </div>

                      <div className="whitespace-nowrap font-semibold">
                        {gbp.format(((it.qty ?? 0) * (it.price_cents ?? 0)) / 100)}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {noOrdersVisible && (
        <>
          <p className="mb-3 text-sm text-amber-700">
            Some order details are hidden by security policies. Showing item list only.
          </p>

          <ul className="divide-y rounded-xl border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                <div className="relative h-14 w-14 overflow-hidden rounded bg-gray-100">
                  {it.image_url ? (
                    <Image src={it.image_url} alt={it.title} fill className="object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-gray-400">No image</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.title}</div>
                  <div className="text-sm text-gray-600">
                    Qty: {it.qty} · Unit: {gbp.format((it.price_cents ?? 0) / 100)}
                  </div>
                  {it.product_slug && <div className="text-xs text-gray-500">slug: {it.product_slug}</div>}
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">Order {it.order_id.slice(0, 8)}…</div>
                  <div className="font-semibold">{gbp.format(((it.qty ?? 0) * (it.price_cents ?? 0)) / 100)}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
