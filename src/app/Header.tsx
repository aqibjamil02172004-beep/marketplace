// src/app/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { useCart } from '@/lib/CartProvider';

type SellerStatus = 'approved' | 'pending' | 'rejected' | null;

export default function Header() {
  const { count } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [initial, setInitial] = useState<string>('U');
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // --- Auth & seller status ---
  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!mounted) return;

      const email = user?.email ?? null;
      setUserEmail(email);

      const fullName =
        (user?.user_metadata as any)?.full_name ||
        (user?.user_metadata as any)?.name ||
        '';
      const sourceForInitial = (fullName || email || '').trim();
      setInitial(sourceForInitial ? sourceForInitial.charAt(0).toUpperCase() : 'U');

      // Try to read seller status (manual approval flow)
      if (user) {
        const { data: s, error } = await supabase
          .from('sellers')
          .select('status')
          .eq('id', user.id) // assuming sellers.id = auth.uid
          .maybeSingle();

        if (!mounted) return;
        if (error || !s) setSellerStatus(null);
        else setSellerStatus((s.status as SellerStatus) ?? null);
      } else {
        setSellerStatus(null);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      const fullName =
        (session?.user?.user_metadata as any)?.full_name ||
        (session?.user?.user_metadata as any)?.name ||
        '';
      const src = (fullName || email || '').trim();
      setInitial(src ? src.charAt(0).toUpperCase() : 'U');
      setSellerStatus(null); // will re-check below
      if (session?.user) {
  (async () => {
    try {
      const { data } = await supabase
        .from('sellers')
        .select('status')
        .eq('id', session.user.id)
        .maybeSingle();

      setSellerStatus((data?.status as SellerStatus) ?? null);
    } catch {
      setSellerStatus(null);
    }
  })();
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
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
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
            <button
              type="submit"
              className="rounded-full bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-500"
            >
              Search
            </button>
          </div>
        </form>

        {/* Auth / Profile */}
        {!userEmail ? (
          <Link
            href="/signin"
            className="hidden sm:inline-flex rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
          >
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
              {/* Initial only (no email text) */}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                {initial}
              </span>
              <svg
                className="h-4 w-4 text-gray-600 hidden sm:block"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
              </svg>
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 rounded-lg border bg-white p-2 shadow-xl"
              >
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

                {/* Sell: if approved → seller hub; else → apply */}
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
        <Link
          href="/cart"
          className="relative rounded-full border px-3 py-2 hover:bg-gray-50"
        >
          Cart
          <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-black px-1 text-xs font-semibold text-white">
            {count ?? 0}
          </span>
        </Link>
      </div>
    </header>
  );
}
