'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient'; // ✅ default import (NOT { supabase })

type Product = {
  id: string;
  seller_id: string | null;
  title: string;
  slug: string | null;
  description: string | null;
  brand: string | null;
  category: string | null;
  currency: string | null;
  price_cents: number | null;
  compare_at_cents: number | null;
  condition: string | null;
  condition_notes: string | null;
  images: string[] | null;
  lifecycle: 'draft' | 'active' | 'archived' | null;
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [price, setPrice] = useState<string>('0'); // GBP as string
  const [compareAt, setCompareAt] = useState<string>(''); // optional
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [lifecycle, setLifecycle] = useState<'draft' | 'active' | 'archived'>('draft');

  // Load product (client-side so we have auth context)
  useEffect(() => {
    if (!productId) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      // Ensure user is signed in (optional guard)
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        setErr('Please sign in first.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select(
          'id, seller_id, title, slug, description, brand, category, currency, price_cents, compare_at_cents, images, lifecycle'
        )
        .eq('id', productId)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        setErr(error?.message || 'Product not found');
        setLoading(false);
        return;
      }

      // populate form
      setTitle(data.title ?? '');
      setSlug(data.slug ?? '');
      setPrice(
        data.price_cents != null ? (data.price_cents / 100).toFixed(2) : '0'
      );
      setCompareAt(
        data.compare_at_cents != null ? (data.compare_at_cents / 100).toFixed(2) : ''
      );
      setBrand(data.brand ?? '');
      setDescription(data.description ?? '');
      setImages(Array.isArray(data.images) ? data.images.filter(Boolean) : []);
      setLifecycle((data.lifecycle as any) ?? 'draft');

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [productId]);

  async function save() {
    if (!productId) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        title,
        slug: slug || null,
        brand: brand || null,
        description: description || null,
        price_cents: Math.round(parseFloat(price || '0') * 100),
        compare_at_cents: compareAt ? Math.round(parseFloat(compareAt) * 100) : null,
        images: images.length ? images : null,
      };

      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', productId);

      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(next: 'draft' | 'active' | 'archived') {
    if (!productId) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from('products')
        .update({ lifecycle: next })
        .eq('id', productId);

      if (error) throw error;
      setLifecycle(next);
    } catch (e: any) {
      setErr(e?.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!productId) return;
    if (!confirm('Delete this product?')) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      router.push('/seller/products');
    } catch (e: any) {
      setErr(e?.message || 'Failed to delete.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        <p className="mt-2 text-gray-600">Loading…</p>
      </main>
    );
  }

  if (err) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        <p className="mt-2 text-red-600">{err}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Edit Product</h1>

      <div className="mt-6 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug"
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="Price"
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          value={compareAt}
          onChange={(e) => setCompareAt(e.target.value)}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="Compare at (RRP) – optional"
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand (optional)"
          className="w-full rounded-md border px-3 py-2"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={5}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      {/* Images simple editor */}
      <div className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Images</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, i) =>
            url ? (
              <div key={url + i} className="relative rounded-md border p-2">
                {/* Only render <img> if url is truthy to avoid Next warnings */}
                <img src={url} alt="" className="h-28 w-full rounded object-cover" />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
                  onClick={() =>
                    setImages((prev) => prev.filter((x, idx) => !(idx === i && x === url)))
                  }
                >
                  Remove
                </button>
              </div>
            ) : null
          )}
        </div>
        {/* quick add-by-URL for edit page */}
        <div className="mt-3 flex gap-2">
          <input
            placeholder="Add image URL"
            className="w-full rounded-md border px-3 py-2"
            onKeyDown={(e) => {
              const el = e.currentTarget;
              if (e.key === 'Enter') {
                const v = el.value.trim();
                if (v) setImages((prev) => [...prev, v]);
                el.value = '';
              }
            }}
          />
          <button
            className="rounded-md border px-3 py-2 hover:bg-gray-50"
            onClick={(e) => {
              const input = (e.currentTarget.previousSibling as HTMLInputElement) || null;
              if (!input) return;
              const v = input.value.trim();
              if (v) setImages((prev) => [...prev, v]);
              input.value = '';
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-black/80 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => setStatus('active')}
          disabled={saving || lifecycle === 'active'}
          className="rounded-md bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-400 disabled:opacity-60"
        >
          Activate
        </button>
        <button
          onClick={() => setStatus('draft')}
          disabled={saving || lifecycle === 'draft'}
          className="rounded-md bg-amber-500 px-4 py-2 text-white hover:bg-amber-400 disabled:opacity-60"
        >
          Draft
        </button>
        <button
          onClick={() => setStatus('archived')}
          disabled={saving || lifecycle === 'archived'}
          className="rounded-md bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 disabled:opacity-60"
        >
          Archive
        </button>
        <button
          onClick={remove}
          disabled={saving}
          className="ml-auto rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </main>
  );
}
