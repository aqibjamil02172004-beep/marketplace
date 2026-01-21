// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";

function getOrigin(req: Request) {
  // Best: use the real request origin if present
  const origin = req.headers.get("origin");
  if (origin) return origin;

  // Fallback: build from host header
  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }

  // Last fallback: env
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function POST(req: Request) {
  try {
    const { items, user_id } = await req.json();

    const origin = getOrigin(req);

    const success_url = `${origin}/checkout/success?sid={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/checkout`;

    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { items, success_url, cancel_url, user_id },
    });

    if (error) {
      console.error("create-checkout-session error:", error);
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    if (!data?.url) {
      return NextResponse.json({ error: "Missing checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: data.url });
  } catch (e: any) {
    console.error("Checkout route failed:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
