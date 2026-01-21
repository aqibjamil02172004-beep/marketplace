// src/app/seller/products/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';

type SellerStatus = 'approved' | 'pending' | 'rejected' | 'none';
type Product = { id: string; title: string; price_cents: number; slug: string | null };

export default function SellerHub() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SellerStatus>('none');
  const [products, setProducts] = useState<Product[]>([]);

  // 1) Get session on mount + subscribe to changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 2) When we have a user id, fetch seller status and listings
  useEffect(() => {
    let mounted = true;

    async function loadSellerAndProducts(uid: string) {
      setLoading(true);

      // seller status
      const { data: seller, error: sellerErr } = await supabase
        .from('sellers')
        .select('status')
        .eq('id', uid) // assuming sellers.id = auth.uid
        .maybeSingle();

      if (!mounted) return;

      if (sellerErr) {
        setStatus('none');
      } else {
        setStatus((seller?.status as SellerStatus) ?? 'none');
      }

      // listings if approved
      if ((seller?.status as SellerStatus) === 'approved') {
        const { data: prods } = await supabase
          .from('products')
          .select('id, title, price_cents, slug')
          .eq('seller_id', uid)
          .order('created_at', { ascending: false });

        if (!mounted) return;
        setProducts(prods ?? []);
      } else {
        setProducts([]);
      }

      setLoading(false);
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
        <Link
          href="/seller/products/new"
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
        >
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
                  <Link
                    href={`/product/${p.slug}`}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
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

      {(products ?? []).length === 0 && (
        <p className="mt-4 text-gray-600">No listings yet.</p>
      )}
    </main>
  );
}
