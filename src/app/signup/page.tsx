'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import supabase from '@/lib/supabaseClient';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmations are on, user may need to verify; still route home.
    router.push('/');
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="inline-block h-6 w-6 rounded-sm bg-gradient-to-br from-indigo-500 to-blue-600" />
          <span className="text-xl font-bold">Alvy</span>
        </div>

        <h1 className="mb-1 text-2xl font-bold">Create your Alvy account</h1>
        <p className="text-sm text-gray-600">All fields are required</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Your name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least six characters"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Re-enter password</span>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-yellow-400 px-4 py-2 font-semibold hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Continue'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/signin" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
