'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

const CATEGORIES = [
  'Phones & Accessories',
  'Computers & Tablets',
  'Gaming',
  'TV & Home Entertainment',
  'Cameras & Photography',
  'Audio (Headphones, Speakers)',
  'Wearables (Watches, Fitness)',
  'Home & Kitchen',
  'Appliances',
  'Clothing & Fashion',
  'Shoes',
  'Bags & Luggage',
  'Beauty & Personal Care',
  'Health',
  'Sports & Outdoors',
  'Toys & Baby',
  'Books & Stationery',
  'Automotive',
  'DIY & Tools',
  'Pets',
  'Collectibles',
  'Other',
];

type VariantRow = {
  color?: string;
  storage?: string;
  sku?: string;
  price_cents?: number | null;
  stock?: number | null;
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // check collisions
  while (true) {
    const { count, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('slug', candidate);
    if (error) throw error;
    if (!count || count === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

export default function NewProductPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');

  const [price, setPrice] = useState<string>(''); // £
  const [compareAt, setCompareAt] = useState<string>(''); // £
  const [currency] = useState<'GBP'>('GBP');

  const [colors, setColors] = useState<string[]>([]);
  const [storages, setStorages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [manualImageUrl, setManualImageUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // auto slug
  useEffect(() => {
    if (!title) return;
    setSlug(slugify(title));
  }, [title]);

  const priceCents = useMemo(
    () => (price ? Math.round(parseFloat(price) * 100) : 0),
    [price]
  );
  const compareAtCents = useMemo(
    () => (compareAt ? Math.round(parseFloat(compareAt) * 100) : null),
    [compareAt]
  );

  // tag helpers
  function TagInput({
    values, onAdd, onRemove, placeholder,
  }: {
    values: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void; placeholder?: string;
  }) {
    const [temp, setTemp] = useState('');
    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = temp.trim();
        if (v) onAdd(v);
        setTemp('');
      }
    }
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
              {v}
              <button type="button" onClick={() => onRemove(v)} className="rounded-full bg-gray-100 px-2 hover:bg-gray-200">×</button>
            </span>
          ))}
        </div>
        <input
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="mt-2 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">Press Enter to add. Click × to remove.</p>
      </div>
    );
  }

  // image url add/remove
  function addManualImage() {
    const url = manualImageUrl.trim();
    if (!url) return;
    setImageUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setManualImageUrl('');
  }
  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((x) => x !== url));
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) { setError('Please sign in before uploading images.'); return; }

    const bucket = 'products-public'; // create in Supabase (public)
    for (const f of Array.from(files)) {
      try {
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
        const { data, error } = await supabase.storage.from(bucket).upload(path, f, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
        setImageUrls((prev) => [...prev, pub.publicUrl]);
      } catch (e: any) {
        setError(e.message || 'Upload failed');
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) return setError('Please sign in first.');
    if (!title) return setError('Please enter a title.');
    if (!priceCents || priceCents <= 0) return setError('Please enter a valid price.');

    setSubmitting(true);
    try {
      const base = slug ? slugify(slug) : slugify(title);
      if (!base) throw new Error('Could not generate slug.');
      const finalSlug = await ensureUniqueSlug(base);

      const cleanedVariants =
        Array.isArray(variants) && variants.length > 0
          ? variants.map((v) => ({
              color: v.color ?? null,
              storage: v.storage ?? null,
              sku: v.sku ?? null,
              price_cents: v.price_cents ?? null,
              stock: v.stock ?? null,
            }))
          : null;

      const payload = {
        seller_id: userId,
        title,
        slug: finalSlug,
        description: description || null,
        brand: brand || null,
        category: category || 'Other',
        currency,
        price_cents: priceCents,
        compare_at_cents: compareAtCents,
        attributes: { colors, storages },
        variants: cleanedVariants,
        images: imageUrls.length ? imageUrls : null,
        lifecycle: 'draft',
      };

      const { data, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error) throw error;

      // Go to edit page after create
      router.push(`/seller/products/${data.id}/edit`);
    } catch (err: any) {
      setError(err.message || 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">New Product</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        {/* Basics */}
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Basics</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="iPhone 16 Pro Max"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Slug (auto)</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="iphone-16-pro-max"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Brand</span>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Apple"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the item, specs, condition, etc."
            />
          </label>
        </section>

        {/* Pricing */}
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Pricing</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Currency</span>
              <input value={currency} readOnly className="w-full cursor-not-allowed rounded-md border bg-gray-50 px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Price</span>
              <input
                type="number" step="0.01" min="0"
                value={price} onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1099.00"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Compare at (RRP)</span>
              <input
                type="number" step="0.01" min="0"
                value={compareAt} onChange={(e) => setCompareAt(e.target.value)}
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1199.00"
              />
            </label>
          </div>
        </section>

        {/* Options */}
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Options</h2>

          <div className="mb-4">
            <div className="mb-1 text-sm font-medium">Colors</div>
            <TagInput
              values={colors}
              onAdd={(v) => setColors((prev) => (prev.includes(v) ? prev : [...prev, v]))}
              onRemove={(v) => setColors((prev) => prev.filter((x) => x !== v))}
              placeholder="e.g. Black"
            />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Storage (GB)</div>
            <TagInput
              values={storages}
              onAdd={(v) => setStorages((prev) => (prev.includes(v) ? prev : [...prev, v]))}
              onRemove={(v) => setStorages((prev) => prev.filter((x) => x !== v))}
              placeholder="e.g. 128GB"
            />
          </div>
        </section>

        {/* Variants */}
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Variants</h2>
            <button type="button" onClick={() => setVariants((p) => [...p, {}])}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              Add variant
            </button>
          </div>

          {variants.length === 0 ? (
            <p className="text-sm text-gray-600">
              Add rows for specific combinations (e.g. Black / 256GB) with SKU, price and stock.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left">Color</th>
                    <th className="p-2 text-left">Storage</th>
                    <th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Price (override)</th>
                    <th className="p-2 text-left">Stock</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">
                        <select
                          value={v.color ?? ''}
                          onChange={(e) =>
                            setVariants((prev) => prev.map((row, idx) => idx === i ? { ...row, color: e.target.value || undefined } : row))
                          }
                          className="w-full rounded-md border px-2 py-1.5"
                        >
                          <option value="">—</option>
                          {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={v.storage ?? ''}
                          onChange={(e) =>
                            setVariants((prev) => prev.map((row, idx) => idx === i ? { ...row, storage: e.target.value || undefined } : row))
                          }
                          className="w-full rounded-md border px-2 py-1.5"
                        >
                          <option value="">—</option>
                          {storages.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          value={v.sku ?? ''}
                          onChange={(e) =>
                            setVariants((prev) => prev.map((row, idx) => idx === i ? { ...row, sku: e.target.value } : row))
                          }
                          className="w-full rounded-md border px-2 py-1.5"
                          placeholder="SKU-123"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number" step="0.01" min="0"
                          value={v.price_cents != null ? (v.price_cents / 100).toFixed(2) : ''}
                          onChange={(e) =>
                            setVariants((prev) => prev.map((row, idx) => idx === i
                              ? { ...row, price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }
                              : row))
                          }
                          className="w-full rounded-md border px-2 py-1.5"
                          placeholder="(optional)"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number" min="0"
                          value={v.stock ?? ''}
                          onChange={(e) =>
                            setVariants((prev) => prev.map((row, idx) => idx === i
                              ? { ...row, stock: e.target.value ? parseInt(e.target.value) : null }
                              : row))
                          }
                          className="w-full rounded-md border px-2 py-1.5"
                          placeholder="(optional)"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}
                          className="rounded-md border px-2 py-1.5 hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Images */}
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Images</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Upload from device</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>

            <div className="block">
              <span className="mb-1 block text-sm font-medium">Add image by URL</span>
              <div className="flex gap-2">
                <input
                  value={manualImageUrl}
                  onChange={(e) => setManualImageUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={addManualImage} className="shrink-0 rounded-md border px-3 py-2 hover:bg-gray-50">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Thumbs */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {imageUrls.map((url) => (
              <div key={url} className="relative rounded-md border p-2">
                <img src={url} alt="" className="h-28 w-full rounded object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-black px-4 py-2 text-white hover:bg-black/80 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Create (draft)'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/seller/products')}
            className="rounded-md border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
