// src/app/api/checkout/route.ts

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { items, user_id } = await req.json();

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items in request" },
        { status: 400 }
      );
    }

    // Clean origin to avoid long auth callback URLs
    const rawOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const origin = rawOrigin.split("?")[0]; // 🔥 IMPORTANT FIX

    const success_url = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/checkout`;

    // Supabase env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 500 }
      );
    }

    const functionUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;

    // Call Supabase Edge Function
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`, // Edge Function auth
      },
      body: JSON.stringify({
        items,
        user_id,
        success_url,
        cancel_url,
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("Edge function error:", res.status, text);
      return NextResponse.json({ error: text }, { status: 500 });
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from function" },
        { status: 500 }
      );
    }

    if (!data?.url) {
      return NextResponse.json(
        { error: "Function did not return checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (e: any) {
    console.error("Checkout route failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
