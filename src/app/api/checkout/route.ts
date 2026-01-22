// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";

// ✅ Always prefer your custom domain for Stripe redirects (prevents "old Vercel success page")
function getPublicBaseUrl(req: Request) {
  // 1) Explicit env wins (set this in Vercel):
  //    NEXT_PUBLIC_SITE_URL = https://alvy.co.uk
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  // 2) Otherwise, try the request origin (preview/prod)
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  // 3) Host fallback
  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  // 4) Last fallback
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const items = body?.items;
    const user_id = body?.user_id ?? null;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // ✅ Force Stripe redirects to your real domain (set NEXT_PUBLIC_SITE_URL in Vercel)
    const baseUrl = getPublicBaseUrl(req);

    // ✅ Stripe placeholder must be exactly {CHECKOUT_SESSION_ID}
    const success_url = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${baseUrl}/checkout`;

    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { items, success_url, cancel_url, user_id },
    });

    if (error) {
      console.error("create-checkout-session error:", error);
      return NextResponse.json(
        { error: error?.message ?? "create-checkout-session failed" },
        { status: 500 }
      );
    }

    if (!data?.url) {
      return NextResponse.json({ error: "Missing checkout URL" }, { status: 500 });
    }

    // Helpful for debugging which domain is being used
    return NextResponse.json({ url: data.url, success_url, cancel_url });
  } catch (e: any) {
    console.error("Checkout route failed:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
