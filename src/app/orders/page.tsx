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

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * Reads the supabase auth token stored in localStorage.
 * Your console output shows it is stored as a JSON string containing access_token + refresh_token.
 */
function getStoredTokens(): { access_token: string; refresh_token: string } | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
    if (!key) return null;

    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    const access_token =
      parsed?.access_token ?? parsed?.currentSession?.access_token ?? parsed?.session?.access_token;
    const refresh_token =
      parsed?.refresh_token ?? parsed?.currentSession?.refresh_token ?? parsed?.session?.refresh_token;

    if (!access_token || !refresh_token) return null;

    return { access_token, refresh_token };
  } catch {
    return null;
  }
}

/**
 * Production fix: if Supabase gets into a stuck state on refresh,
 * force rehydrate the session from localStorage.
 *
 * IMPORTANT: DO NOT wrap this in a hard timeout (it can cause AbortError in prod).
 */
async function forceRestoreSession() {
  const tokens = getStoredTokens();
  if (!tokens) return;

  try {
    await supabase.auth.setSession(tokens);
  } catch {
    // ignore; we'll handle missing user below
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false); // soft "timeout" indicator
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ensures only latest load can update state
  const loadSeq = useRef(0);

  // track image failures so we stop retrying broken optimizer URLs
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});

  const gbp = useMemo(
    () => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    []
  );

  const loadOrders = useCallback(async () => {
    const seq = ++loadSeq.current;

    setLoading(true);
    setSlow(false);
    setError(null);

    // Soft "taking longer" indicator after 8s (does NOT abort requests)
    const slowTimer = window.setTimeout(() => {
      if (seq === loadSeq.current) setSlow(true);
    }, 8000);

    try {
      // ✅ Rehydrate session (helps prod refresh)
      await forceRestoreSession();
      if (seq !== loadSeq.current) return;

      // ✅ Use getUser (more reliable for UI than getSession)
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (seq !== loadSeq.current) return;
      if (userErr) throw userErr;

      const user = userRes.user ?? null;
      setUserId(user?.id ?? null);

      if (!user) {
        setOrders([]);
        setError('Please sign in to view your orders.');
        return;
      }

      // ✅ Orders query (NO hard timeout -> avoids AbortError)
      const { data, error: ordersErr } = await supabase
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

      if (seq !== loadSeq.current) return;
      if (ordersErr) throw ordersErr;

      setOrders((data as OrderRow[]) ?? []);
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      console.error('Orders load error:', err);
      setOrders([]);
      setError(err?.message || 'Failed to load orders.');
    } finally {
      window.clearTimeout(slowTimer);
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

    // refetch when auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      safeLoad();
    });

    // refetch when tab becomes visible again
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

      {loading && (
        <div className="space-y-2">
          <p>Loading your orders…</p>
          {slow && (
            <p className="text-sm text-amber-700">
              Taking longer than usual… (production cold starts / auth refresh can be slow)
            </p>
          )}
        </div>
      )}

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
                          // Avoid Next optimizer 400 for random external URLs
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
