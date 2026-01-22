// src/app/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useCart } from '@/lib/CartProvider';

type SellerStatus = 'approved' | 'pending' | 'rejected' | null;

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([Promise.resolve(promiseLike), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

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

async function forceRestoreSession() {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await withTimeout(supabase.auth.setSession(tokens), 8000, 'Session rehydrate timed out');
  } catch {
    // ignore
  }
}

export default function Header() {
  const { count } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [initial, setInitial] = useState<string>('U');
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function computeInitial(email: string | null, user: any) {
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    const src = (fullName || email || '').trim();
    return src ? src.charAt(0).toUpperCase() : 'U';
  }

  async function loadSellerStatus(uid: string) {
    try {
      const { data, error } = await withTimeout(
        supabase.from('sellers').select('status').eq('id', uid).maybeSingle(),
        8000,
        'Seller status timed out'
      );

      if (error) return null;
      return (data?.status as SellerStatus) ?? null;
    } catch {
      return null;
    }
  }

  // --- Auth & seller status (robust) ---
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // ✅ Fix for prod: force restore before reading session
        await forceRestoreSession();

        const { data, error } = await withTimeout(supabase.auth.getSession(), 8000, 'Session lookup timed out');
        if (!mounted) return;

        if (error) throw error;

        const session = data.session ?? null;
        const email = session?.user?.email ?? null;

        setUserEmail(email);
        setInitial(computeInitial(email, session?.user));
        setAuthReady(true);

        if (session?.user?.id) {
          const status = await loadSellerStatus(session.user.id);
          if (!mounted) return;
          setSellerStatus(status);
        } else {
          setSellerStatus(null);
        }
      } catch {
        if (!mounted) return;
        setUserEmail(null);
        setInitial('U');
        setSellerStatus(null);
        setAuthReady(true);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user?.email ?? null;

      setUserEmail(email);
      setInitial(computeInitial(email, session?.user));
      setAuthReady(true);

      if (session?.user?.id) {
        const status = await loadSellerStatus(session.user.id);
        setSellerStatus(status);
      } else {
        setSellerStatus(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Close dropdown on outside click / Esc
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener('mousedown', onClick);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchRef.current?.value?.trim() ?? '';
    const params = new URLSearchParams(searchParams?.toString());
    if (q) params.set('q', q);
    else params.delete('q');
    router.push(`/products?${params.toString()}`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  }

  const isProducts = pathname?.startsWith('/products');

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="inline-block h-6 w-6 rounded-sm bg-gradient-to-br from-indigo-500 to-blue-600" />
          <span>Alvy</span>
        </Link>

        {/* Products link */}
        <Link
          href="/products"
          className={`hidden md:inline-flex items-center rounded-md px-3 py-2 text-sm hover:bg-gray-100 ${
            isProducts ? 'font-semibold' : ''
          }`}
        >
          Products
        </Link>

        {/* Search */}
        <form onSubmit={onSearchSubmit} className="flex flex-1">
          <div className="flex w-full items-center gap-2 rounded-full border px-3 py-2 shadow-sm">
            <input
              ref={searchRef}
              name="q"
              placeholder="Search for anything…"
              className="w-full bg-transparent outline-none"
              defaultValue={searchParams?.get('q') ?? ''}
            />
            <button type="submit" className="rounded-full bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-500">
              Search
            </button>
          </div>
        </form>

        {/* Auth / Profile */}
        {!authReady ? null : !userEmail ? (
          // ✅ SHOW ON ALL SCREEN SIZES (removed "hidden sm:inline-flex")
          <Link href="/signin" className="inline-flex rounded-full border px-3 py-2 text-sm hover:bg-gray-50">
            Sign in / Sign up
          </Link>
        ) : (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border px-2 py-2 hover:bg-gray-50"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                {initial}
              </span>
              <svg className="h-4 w-4 text-gray-600 hidden sm:block" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
              </svg>
            </button>

            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-lg border bg-white p-2 shadow-xl">
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
                  role="menuitem"
                >
                  Account
                </Link>

                <Link
                  href="/orders"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
                  role="menuitem"
                >
                  Orders
                </Link>

                {sellerStatus === 'approved' ? (
                  <Link
                    href="/seller/products"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
                    role="menuitem"
                  >
                    Sell (Seller hub)
                  </Link>
                ) : (
                  <Link
                    href="/sell/apply"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
                    role="menuitem"
                  >
                    Sell (Apply)
                  </Link>
                )}

                <button
                  onClick={signOut}
                  className="mt-1 block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cart */}
        <Link href="/cart" className="relative rounded-full border px-3 py-2 hover:bg-gray-50">
          Cart
          <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-black px-1 text-xs font-semibold text-white">
            {count ?? 0}
          </span>
        </Link>
      </div>
    </header>
  );
}
