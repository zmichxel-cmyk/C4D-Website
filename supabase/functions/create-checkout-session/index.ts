// Supabase Edge Function — creates a real Stripe Checkout Session for a
// pending customizer_orders row and returns its URL.
//
// Called from the customizer (CustomerEditor.tsx's saveForCheckout) with
// just { orderId, addOnsTotal } — never the full config, and never anything
// price-related that the browser could tamper with beyond what's already
// stored server-side in the order row itself. The Stripe secret key lives
// only here, never in browser code.
//
// Deploy: supabase functions deploy create-checkout-session
// Secrets needed (supabase secrets set ...):
//   STRIPE_SECRET_KEY   — from the Stripe Dashboard (use a test key while developing)
//   SITE_URL            — e.g. https://customs4daez.com, used for success/cancel redirect URLs
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase,
// no need to set those yourself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:4173";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  try {
    const { orderId, addOnsTotal } = await req.json();
    if (!orderId) return json({ error: "orderId is required" }, 400);

    // Re-fetch the order server-side rather than trusting anything about
    // price from the request body beyond addOnsTotal (which itself only
    // matters until real product/base-price wiring exists — see TODO below).
    const { data: order, error } = await supabaseAdmin
      .from("customizer_orders")
      .select("id, product_slug, status")
      .eq("id", orderId)
      .single();
    if (error || !order) return json({ error: "Order not found" }, 404);
    if (order.status !== "pending") return json({ error: `Order is already ${order.status}` }, 400);

    // TODO: base controller price isn't wired up anywhere yet (see
    // CustomerEditor.tsx's INTEGRATION POINT comments) — for now this only
    // charges the add-ons total. Once your product catalog exists, look up
    // order.product_slug's base price here and add it into unitAmountCents.
    const unitAmountCents = Math.round(Number(addOnsTotal ?? 0) * 100);
    if (!unitAmountCents || unitAmountCents < 50) {
      return json({ error: "Order total is below Stripe's minimum chargeable amount" }, 400);
    }

    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": `Custom Controller${order.product_slug ? ` — ${order.product_slug}` : ""}`,
      "line_items[0][price_data][unit_amount]": String(unitAmountCents),
      "line_items[0][quantity]": "1",
      success_url: `${SITE_URL}/customize-success.html?order=${orderId}`,
      cancel_url: `${SITE_URL}/customize.html?product=${order.product_slug ?? ""}`,
      client_reference_id: orderId,
      "metadata[order_id]": orderId,
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) return json({ error: session.error?.message ?? "Stripe request failed" }, 502);

    await supabaseAdmin.from("customizer_orders").update({ stripe_checkout_session_id: session.id }).eq("id", orderId);

    return json({ url: session.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
