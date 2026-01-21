'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import Image from 'next/image';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) {
          setError('Please sign in to view your orders.');
          setLoading(false);
          return;
        }
        setUserId(u.user.id);

        const { data, error } = await supabase
          .from('orders')
          .select(`
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
          `)
          .eq('user_id', u.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Your orders</h1>
      <div className="text-sm text-gray-500">
        <div>Current user: <code>{userId ?? '—'}</code></div>
        <div>Orders visible via RLS: <strong>{orders.length}</strong></div>
      </div>

      {loading && <p>Loading your orders...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      {!loading && !error && orders.length === 0 && <p>No orders yet.</p>}

      <div className="space-y-6">
        {orders.map((o) => (
          <div key={o.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Order: {o.id.slice(0,8)}…</span>
              <span>{new Date(o.created_at).toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {o.order_items?.map((it: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-t pt-2">
                  <div className="flex items-center gap-3">
                    {it.image_url && (
                      <Image src={it.image_url} alt={it.title} width={60} height={60} className="rounded-md" />
                    )}
                    <div>
                      <div className="font-semibold">{it.title}</div>
                      <div className="text-sm text-gray-500">
                        Qty: {it.qty} × £{(it.price_cents / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold">
                    £{((it.price_cents * it.qty) / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right mt-3 font-bold">
              Total: £{(o.amount_cents / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
