'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';

type SellerStatus = 'approved' | 'pending' | 'rejected' | 'none';
type Product = { id: string; title: string; price_cents: number; slug: string | null };

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([Promise.resolve(promiseLike), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export default function SellerHub() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SellerStatus>('none');
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Prevent older loads overwriting newer ones
  const loadSeq = useRef(0);

  // 1) Get session on mount + subscribe to changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await withTimeout(supabase.auth.getSession(), 8000, 'Session lookup timed out');
        if (!mounted) return;
        if (res.error) throw res.error;
        setUserId(res.data.session?.user?.id ?? null);
      } catch (_e) {
        if (!mounted) return;
        setUserId(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // don’t block UI here; just update uid
      setUserId(session?.user?.id ?? null);
    });

    // Helps after refresh/redirect quirks
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        // triggers the second effect again if session/userId changes
        // but we also re-check session on visibility to be safe
        supabase.auth.getSession().then(({ data }) => {
          setUserId(data.session?.user?.id ?? null);
        });
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // 2) When we have a user id, fetch seller status and listings
  useEffect(() => {
    let mounted = true;
    const seq = ++loadSeq.current;

    async function loadSellerAndProducts(uid: string) {
      setLoading(true);
      setError(null);

      try {
        // Seller status
        const sellerRes = await withTimeout(
          supabase.from('sellers').select('status').eq('id', uid).maybeSingle(),
          12000,
          'Seller status query timed out'
        );

        if (!mounted || seq !== loadSeq.current) return;

        if (sellerRes.error) {
          // If table is protected or row doesn't exist, treat as none
          setStatus('none');
          setProducts([]);
          return;
        }

        const sellerStatus = (sellerRes.data?.status as SellerStatus) ?? 'none';
        setStatus(sellerStatus);

        if (sellerStatus !== 'approved') {
          setProducts([]);
          return;
        }

        // Products
        const productsRes = await withTimeout(
          supabase
            .from('products')
            .select('id, title, price_cents, slug')
            .eq('seller_id', uid)
            .order('created_at', { ascending: false }),
          12000,
          'Products query timed out'
        );

        if (!mounted || seq !== loadSeq.current) return;

        if (productsRes.error) throw productsRes.error;

        setProducts((productsRes.data as Product[]) ?? []);
      } catch (e: any) {
        if (!mounted || seq !== loadSeq.current) return;
        setStatus('none');
        setProducts([]);
        setError(e?.message ?? 'Failed to load seller hub.');
      } finally {
        if (mounted && seq === loadSeq.current) setLoading(false);
      }
    }

    if (userId) {
      loadSellerAndProducts(userId);
    } else {
      // no user → show sign-in prompt
      setStatus('none');
      setProducts([]);
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [userId]);

  // ---- UI ----
  if (loading) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-bold">Seller hub</h1>
        <p className="mt-2 text-gray-600">Loading…</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-bold">Seller hub</h1>
        <p className="mt-2">Please sign in first.</p>
        <Link href="/signin" className="mt-4 inline-flex rounded-md border px-4 py-2 hover:bg-gray-50">
          Sign in
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-bold">Seller hub</h1>
        <p className="mt-2 text-red-600">Error: {error}</p>
        <button
          onClick={() => setUserId((u) => u)} // re-trigger effect
          className="mt-4 inline-flex rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
        >
          Try again
        </button>
      </main>
    );
  }

  if (status !== 'approved') {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-bold">Seller hub</h1>
        <p className="mt-2">
          Your seller account isn’t approved yet{status === 'pending' ? ' (pending review)' : ''}.
        </p>
        <Link href="/sell/apply" className="mt-4 inline-flex rounded-md border px-4 py-2 hover:bg-gray-50">
          Apply to sell
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Your listings</h1>
        <Link href="/seller/products/new" className="rounded-md bg-black px-4 py-2 text-white hover:bg-black/80">
          New listing
        </Link>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {(products ?? []).map((p) => (
          <li key={p.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-sm text-gray-600">£{(p.price_cents / 100).toFixed(2)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {p.slug && (
                  <Link href={`/product/${p.slug}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                    View
                  </Link>
                )}
                <Link
                  href={`/seller/products/${p.id}/edit`}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Edit
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {(products ?? []).length === 0 && <p className="mt-4 text-gray-600">No listings yet.</p>}
    </main>
  );
}
