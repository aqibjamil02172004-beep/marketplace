// supabase/functions/create-checkout-session/index.ts
// Supabase Edge Function (Deno) - create-checkout-session
// Called from your Next.js API route.
// Expects POST body: { items: Item[], success_url: string, cancel_url: string, user_id?: string }

import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- ENV ---
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[create-checkout-session] Missing env vars",
    JSON.stringify({
      hasStripe: !!STRIPE_SECRET_KEY,
      hasUrl: !!SUPABASE_URL,
      hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
    }),
  );
}

// --- Clients ---
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Types ---
type Item = {
  id: string;              // your product id
  slug?: string | null;    // your product slug
  name: string;
  price_cents: number;
  quantity: number;
  image?: string | null;
  seller_id?: string | null;
};

// --- CORS ---
const ALLOWED_ORIGINS = new Set([
  "https://alvy.co.uk",
  "https://www.alvy.co.uk",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://alvy.co.uk";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method Not Allowed" }, 405);
  }

  try {
    const bodyText = await req.text();
    let parsed: any;

    try {
      parsed = JSON.parse(bodyText || "{}");
    } catch {
      console.error("[create-checkout-session] Invalid JSON:", bodyText);
      return json(req, { error: "Invalid JSON" }, 400);
    }

    const { items, success_url, cancel_url, user_id } = parsed as {
      items: Item[];
      success_url: string;
      cancel_url: string;
      user_id?: string | null;
    };

    if (!Array.isArray(items) || items.length === 0) {
      console.error("[create-checkout-session] No items in request");
      return json(req, { error: "No items" }, 400);
    }

    if (!success_url || !cancel_url) {
      console.error("[create-checkout-session] Missing success_url or cancel_url");
      return json(req, { error: "Missing success_url/cancel_url" }, 400);
    }

    // Ensure seller_id is present per item (lookup by slug if needed)
    const enhanced: Item[] = [];

    for (const i of items) {
      let sellerId = i.seller_id ?? null;

      if (!sellerId && i.slug) {
        const { data: p, error: e } = await supabase
          .from("products")
          .select("seller_id")
          .eq("slug", i.slug)
          .maybeSingle();

        if (e) console.error("[create-checkout-session] DB error by slug:", e);
        sellerId = (p?.seller_id as string | undefined) ?? null;
      }

      enhanced.push({ ...i, seller_id: sellerId ?? null });
    }

    console.log("[create-checkout-session] Enhanced items:", enhanced);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
      enhanced.map((i) => ({
        price_data: {
          currency: "gbp",
          unit_amount: i.price_cents,
          product_data: {
            name: i.name,
            images: i.image ? [i.image] : undefined,
            metadata: {
              product_id: i.id,
              slug: i.slug ?? "",
              seller_id: i.seller_id ?? "",
            },
          },
        },
        quantity: i.quantity,
      }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url,
      cancel_url,
      line_items,

      // Collect phone number on Stripe Checkout
      phone_number_collection: { enabled: true },

      // Collect shipping address on Stripe Checkout (UK only)
      shipping_address_collection: { allowed_countries: ["GB"] },

      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "gbp" },
            display_name: "Standard delivery",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
      ],

      // Billing address required as fallback
      billing_address_collection: "required",

      // Used later by webhook
      metadata: user_id ? { user_id } : undefined,
    });

    console.log("[create-checkout-session] Created session:", session.id);
    return json(req, { url: session.url }, 200);
  } catch (e: any) {
    console.error("[create-checkout-session] Failed:", e);
    // 500 because this is a server failure
    return json(req, { error: e?.message ?? "Unknown error" }, 500);
  }
});
