// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-gray-600">
        The page you’re looking for doesn’t exist.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-gray-100"
      >
        Go back home
      </Link>
    </main>
  );
}
