'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import supabase from '@/lib/supabaseClient';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

/* --- Helpers --- */
function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([Promise.resolve(promiseLike), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

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
  created_at: string;
  order_id: string;
  seller_id: string | null;
  product_slug: string | null;
  title: string;
  qty: number;
  price_cents: number;
  image_url: string | null;
  orders?: JoinedOrder;
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

  // ✅ prevents old loads overwriting newer results
  const loadSeq = useRef(0);

  // ✅ track broken images to avoid repeated Next optimizer issues
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      const seq = ++loadSeq.current;

      setLoading(true);
      setError(null);

      try {
        // 0) session (timeout prevents infinite "Loading…")
        const sessionRes = await withTimeout(supabase.auth.getSession(), 8000, 'Session lookup timed out');
        if (!mounted || seq !== loadSeq.current) return;

        if (sessionRes.error) throw sessionRes.error;

        const uid = sessionRes.data.session?.user?.id ?? null;

        if (!uid) {
          setUserId(null);
          setItems([]);
          setError('Please sign in first.');
          return;
        }

        setUserId(uid);

        // 1) Try joined query first
        const joinedRes = await withTimeout(
          supabase
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
            .order('created_at', { ascending: false }),
          12000,
          'Sales query timed out'
        );

        if (!mounted || seq !== loadSeq.current) return;

        if (!joinedRes.error && Array.isArray(joinedRes.data)) {
          setItems(joinedRes.data as unknown as ItemRow[]);
          return;
        }

        // 2) Fallback if join blocked by RLS
        console.warn('Join failed/blocked; fallback. Details:', joinedRes.error);

        const plainRes = await withTimeout(
          supabase
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
            .order('created_at', { ascending: false }),
          12000,
          'Order items query timed out'
        );

        if (!mounted || seq !== loadSeq.current) return;
        if (plainRes.error) throw plainRes.error;

        const plainItems = (plainRes.data ?? []) as any[];

        const orderIds = Array.from(new Set(plainItems.map((i) => i.order_id)));
        let ordersById = new Map<string, JoinedOrder>();

        if (orderIds.length) {
          const ordersRes = await withTimeout(
            supabase
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
              .in('id', orderIds),
            12000,
            'Orders lookup timed out'
          );

          if (!mounted || seq !== loadSeq.current) return;

          if (!ordersRes.error && ordersRes.data) {
            ordersById = new Map((ordersRes.data as any[]).map((o) => [o.id, o as JoinedOrder]));
          } else {
            console.warn('Orders fetch blocked/failed; showing items without shipping info.', ordersRes.error);
          }
        }

        const stitched = plainItems.map((it) => ({
          ...it,
          orders: ordersById.get(it.order_id),
        })) as ItemRow[];

        setItems(stitched);
      } catch (e: any) {
        if (!mounted) return;
        console.error('Seller sales load error:', e);
        setItems([]);
        setError(e?.message ?? 'Failed to load sales.');
      } finally {
        if (mounted && loadSeq.current === loadSeq.current) setLoading(false);
      }
    }

    // Initial load
    load();

    // Re-run when auth session changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    // Re-run when tab becomes visible
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const grouped: OrderGroup[] = useMemo(() => {
    const map = new Map<string, OrderGroup>();

    for (const it of items) {
      if (!it.orders) continue;
      const key = it.order_id;
      const existing = map.get(key);
      if (existing) existing.items.push(it);
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
              <li key={order.id} className="overflow-hidden rounded-xl border bg-white">
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
                      {ship.lines.length ? ship.lines.map((line, idx) => <div key={idx}>{line}</div>) : <div>—</div>}
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-700">
                    Order total:{' '}
                    <span className="font-semibold">{gbp.format((order.amount_cents ?? 0) / 100)}</span>
                  </div>
                </div>

                <ul className="divide-y">
                  {itemsInOrder.map((it) => {
                    const imgKey = `${it.id}:${it.image_url ?? ''}`;
                    const imgBroken = !!brokenImages[imgKey];

                    return (
                      <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="relative h-14 w-14 overflow-hidden rounded bg-gray-100">
                          {it.image_url && !imgBroken ? (
                            <Image
                              src={it.image_url}
                              alt={it.title}
                              fill
                              className="object-cover"
                              unoptimized={isExternalUrl(it.image_url)}
                              onError={() => setBrokenImages((p) => ({ ...p, [imgKey]: true }))}
                            />
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
                    );
                  })}
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

          <ul className="divide-y rounded-xl border bg-white">
            {items.map((it) => {
              const imgKey = `${it.id}:${it.image_url ?? ''}`;
              const imgBroken = !!brokenImages[imgKey];

              return (
                <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded bg-gray-100">
                    {it.image_url && !imgBroken ? (
                      <Image
                        src={it.image_url}
                        alt={it.title}
                        fill
                        className="object-cover"
                        unoptimized={isExternalUrl(it.image_url)}
                        onError={() => setBrokenImages((p) => ({ ...p, [imgKey]: true }))}
                      />
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
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
