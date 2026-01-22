'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  order_items: OrderItem[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const gbp = useMemo(
    () => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    []
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
       const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
if (sessionErr) throw sessionErr;

const user = sessionRes.session?.user ?? null;
setUserId(user?.id ?? null);

if (!user) {
  setOrders([]);
  setError('Please sign in to view your orders.');
  return;
}


      const { data, error } = await supabase
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders((data as OrderRow[]) || []);
    } catch (err: any) {
      console.error(err);
      setOrders([]);
      setError(err?.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Wrap loadOrders so we don't update state after unmount
    const safeLoad = async () => {
      if (!mounted) return;
      await loadOrders();
    };

    safeLoad();

    // ✅ Critical: refetch when auth/session changes (fixes "works only in new tab")
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      safeLoad();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
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
              {o.order_items?.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between border-t pt-2">
                  <div className="flex items-center gap-3">
                    {it.image_url ? (
                      <Image
                        src={it.image_url}
                        alt={it.title ?? 'Item'}
                        width={60}
                        height={60}
                        className="rounded-md"
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
              ))}
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
