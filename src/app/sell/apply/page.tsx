'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';

export default function ApplySellerPage() {
  const [status, setStatus] = useState<'none'|'pending'|'approved'|'rejected'>('none');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: s } = await supabase.from('sellers').select('status').eq('id', uid).maybeSingle();
      if (s?.status) setStatus(s.status);
    });
  }, []);

  async function apply() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please sign in first.');
    await supabase.from('sellers').upsert({ id: user.id, status: 'pending' }, { onConflict: 'id' });
    setStatus('pending');
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold">Apply to sell</h1>
      <p className="mt-2 text-gray-600">Your application is reviewed manually.</p>

      <div className="mt-6 rounded-md border p-4">
        <p>Current status: <strong>{status}</strong></p>
        {status !== 'pending' && status !== 'approved' && (
          <button
            onClick={apply}
            className="mt-3 rounded-md bg-black px-4 py-2 text-white hover:bg-black/80"
          >
            Submit application
          </button>
        )}
        {status === 'pending' && <p className="mt-3 text-sm text-gray-600">We’ll email you when approved.</p>}
      </div>
    </main>
  );
}
