// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient"; // your browser/server anon client

export async function POST(req: Request) {
  try {
    const { items, user_id } = await req.json();

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const success_url = `${origin}/checkout/success?sid={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/checkout`;

    const { data, error } = await supabase.functions.invoke(
      "create-checkout-session",
      {
        body: { items, success_url, cancel_url, user_id },
      }
    );

    if (error) {
      console.error("create-checkout-session error:", error);
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    return NextResponse.json({ url: data?.url });
  } catch (e: any) {
    console.error("Checkout route failed:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
