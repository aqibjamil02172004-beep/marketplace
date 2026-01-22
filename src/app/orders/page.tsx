'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';

type OrderItem = {
  product_slug: string | null;
  title: string | null;
  qty: number;
  price_cents: number;
  image_url: string | null;
};

type OrderRow = {
  id: string;
  user_id: string;
  created_at: string;
  amount_cents: number;
  order_items: OrderItem[] | null;
};

// ✅ Accept PromiseLike because Supabase query builders are "thenable", not typed as Promise<T>
function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  // ✅ Promise.resolve converts PromiseLike into a real Promise for Promise.race
  return Promise.race([Promise.resolve(promiseLike), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ✅ ensures only latest load can update state
  const loadSeq = useRef(0);

  // ✅ track image failures so we stop retrying broken optimizer URLs
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});

  const gbp = useMemo(
    () => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    []
  );

  const loadOrders = useCallback(async () => {
    const seq = ++loadSeq.current;

    setLoading(true);
    setError(null);

    try {
      // 1) Session
      const sessionRes = await withTimeout(supabase.auth.getSession(), 8000, 'Session lookup timed out');

      if (seq !== loadSeq.current) return;

      if (sessionRes.error) throw sessionRes.error;

      const user = sessionRes.data.session?.user ?? null;
      setUserId(user?.id ?? null);

      if (!user) {
        setOrders([]);
        setError('Please sign in to view your orders.');
        return;
      }

      // 2) Orders query
      const { data, error } = await withTimeout(
        supabase
          .from('orders')
          .select(
            `
              id,
              user_id,
              created_at,
              amount_cents,
              order_items (
                product_slug,
                title,
                qty,
                price_cents,
                image_url
              )
            `
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        12000,
        'Orders query timed out'
      );

      if (seq !== loadSeq.current) return;

      if (error) throw error;

      setOrders((data as OrderRow[]) ?? []);
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      console.error('Orders load error:', err);
      setOrders([]);
      setError(err?.message || 'Failed to load orders.');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const safeLoad = async () => {
      if (!mounted) return;
      await loadOrders();
    };

    safeLoad();

    // ✅ refetch when auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      safeLoad();
    });

    // ✅ refetch when tab becomes visible again
    const onVis = () => {
      if (document.visibilityState === 'visible') safeLoad();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadOrders]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your orders</h1>
          <div className="text-sm text-gray-500 mt-1">
            <div>
              Current user: <code>{userId ?? '—'}</code>
            </div>
            <div>
              Orders visible via RLS: <strong>{orders.length}</strong>
            </div>
          </div>
        </div>

        <button
          onClick={loadOrders}
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && <p>Loading your orders…</p>}

      {error && (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-red-600">Error: {error}</p>
          <div className="mt-3 flex gap-3">
            <button onClick={loadOrders} className="rounded bg-black px-3 py-2 text-sm text-white">
              Try again
            </button>
            <Link href="/signin" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Sign in
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && orders.length === 0 && <p>No orders yet.</p>}

      <div className="space-y-6">
        {orders.map((o) => (
          <div key={o.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Order: {o.id.slice(0, 8)}…</span>
              <span>{new Date(o.created_at).toLocaleString()}</span>
            </div>

            <div className="space-y-3">
              {o.order_items?.map((it, idx) => {
                const imgKey = `${o.id}:${idx}:${it.image_url ?? ''}`;
                const imgBroken = !!brokenImages[imgKey];

                return (
                  <div key={idx} className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-3">
                      {it.image_url && !imgBroken ? (
                        <Image
                          src={it.image_url}
                          alt={it.title ?? 'Item'}
                          width={60}
                          height={60}
                          className="rounded-md"
                          // ✅ Avoid Next optimizer 400 for random external URLs
                          unoptimized={isExternalUrl(it.image_url)}
                          onError={() => setBrokenImages((prev) => ({ ...prev, [imgKey]: true }))}
                        />
                      ) : (
                        <div className="h-[60px] w-[60px] rounded-md bg-gray-100" />
                      )}

                      <div>
                        <div className="font-semibold">{it.title ?? 'Item'}</div>
                        <div className="text-sm text-gray-500">
                          Qty: {it.qty} × {gbp.format((it.price_cents ?? 0) / 100)}
                        </div>
                        {it.product_slug && (
                          <Link
                            href={`/product/${it.product_slug}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View product
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="font-semibold">
                      {gbp.format(((it.price_cents ?? 0) * (it.qty ?? 0)) / 100)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-right mt-3 font-bold">
              Total: {gbp.format((o.amount_cents ?? 0) / 100)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
