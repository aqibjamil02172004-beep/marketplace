// supabase/functions/stripe-webhook/index.ts
// Supabase Edge Function (Deno) - Stripe webhook
// Handles checkout.session.completed and inserts orders + order_items.

import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- ENV ---
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- Clients ---
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Split name helper
function splitName(full?: string | null) {
  const s = (full ?? "").trim();
  if (!s) return { first: null, last: null };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[stripe-webhook] Webhook signature verification failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[stripe-webhook] checkout.session.completed:", session.id);

      // Fetch line items and expand product to read metadata
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        expand: ["data.price.product"],
      });

      const customer = session.customer_details;
      const shipping = session.shipping_details as
        | { name: string | null; phone: string | null; address?: Stripe.Address | null }
        | null;

      const name = splitName(shipping?.name ?? customer?.name);
      const amount_cents = session.amount_total ?? 0;
      const user_id = (session.metadata?.user_id as string | undefined) ?? null;

      // ✅ Insert order (now includes session/payment/currency too)
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          stripe_session_id: session.id,
          stripe_payment_intent: (session.payment_intent as string | null) ?? null,
          currency: session.currency ?? "gbp",

          user_id,
          amount_cents,
          status: "paid",

          first_name: name.first,
          last_name: name.last,

          // These will now be filled because Stripe checkout is collecting them
          phone: shipping?.phone ?? customer?.phone ?? null,
          address_line1: shipping?.address?.line1 ?? customer?.address?.line1 ?? null,
          address_line2: shipping?.address?.line2 ?? customer?.address?.line2 ?? null,
          city: shipping?.address?.city ?? customer?.address?.city ?? null,
          state: shipping?.address?.state ?? customer?.address?.state ?? null,
          postal_code: shipping?.address?.postal_code ?? customer?.address?.postal_code ?? null,
          country: shipping?.address?.country ?? customer?.address?.country ?? null,
        })
        .select()
        .single();

      if (orderErr || !order) {
        console.error("[stripe-webhook] Failed to insert order:", orderErr);
        return new Response("ok", { status: 200 });
      }

      console.log("[stripe-webhook] Created order:", order.id);

      // Insert order_items
      for (const li of lineItems.data) {
        const qty = li.quantity ?? 1;
        const unitPrice = li.price?.unit_amount ?? 0;

        // Stripe product metadata
        const product = li.price?.product as Stripe.Product | null;
        const meta = product?.metadata ?? {};

        const productId = meta.product_id ?? null;
        const slug = meta.slug ?? null;
        const seller_id = meta.seller_id ? String(meta.seller_id) : null;

        const title = product?.name ?? li.description ?? "Item";
        const imageUrl = product?.images?.[0] ?? null;

        const { error: itemErr } = await supabase.from("order_items").insert({
          order_id: order.id,
          product_slug: slug,
          title,
          qty,
          price_cents: unitPrice,
          seller_id,
          image_url: imageUrl,
        });

        if (itemErr) {
          console.error("[stripe-webhook] Failed to insert order_item:", itemErr, {
            order_id: order.id,
            meta,
          });
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[stripe-webhook] Processing error:", err);
    // Still return 200 to avoid endless retries; errors are in logs
    return new Response("ok", { status: 200 });
  }
});
