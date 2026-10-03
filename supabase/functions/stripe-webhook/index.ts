// Supabase Edge Function — Stripe webhook receiver. Listens for
// checkout.session.completed, marks the matching customizer_orders row
// paid, and emails the customer their generated overlay file + a README.
// This is the ONLY place an order is ever marked paid/fulfilled — the
// browser-side code can never do that itself (see the RLS policies in
// supabase-customizer-orders-schema.sql).
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//   (--no-verify-jwt because Stripe calls this directly, not through your
//   app's own auth — the Stripe signature check below is what actually
//   verifies the request is legitimate)
// Then in the Stripe Dashboard: Developers -> Webhooks -> Add endpoint,
// pointing at this function's URL, subscribed to checkout.session.completed.
//
// Secrets needed (supabase secrets set ...):
//   STRIPE_WEBHOOK_SECRET  — from the webhook endpoint's settings in Stripe (starts with whsec_)
//   RESEND_API_KEY         — from resend.com; swap sendEmail() below for a
//                            different provider (Postmark, SendGrid, etc.)
//                            if you'd rather use one of those instead
//   EMAIL_FROM             — e.g. "orders@customs4daez.com" (must be a
//                            verified sending domain in Resend)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "orders@customs4daez.com";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: any;
  try {
    event = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object;
  const orderId: string | undefined = session.metadata?.order_id ?? session.client_reference_id;
  const customerEmail: string | undefined = session.customer_details?.email;
  if (!orderId) return new Response("No order_id in session metadata", { status: 400 });

  const { data: order, error: fetchError } = await supabaseAdmin
    .from("customizer_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (fetchError || !order) {
    console.error("Order not found for webhook:", orderId, fetchError);
    return new Response("Order not found", { status: 404 });
  }
  // Idempotency — Stripe can retry the same webhook event; don't re-email.
  if (order.status !== "pending") return new Response("already handled", { status: 200 });

  await supabaseAdmin.from("customizer_orders").update({
    status: "paid", paid_at: new Date().toISOString(), customer_email: customerEmail ?? null,
  }).eq("id", orderId);

  try {
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from("customizer-exports")
      .download(order.export_html_path);
    if (downloadError || !fileBlob) throw downloadError ?? new Error("export file missing");

    const htmlText = await fileBlob.text();
    const filename = `${(order.product_slug || "controller-overlay").replace(/[^a-z0-9_-]/gi, "-")}.html`;

    if (customerEmail) {
      await sendOrderEmail(customerEmail, filename, htmlText, order);
    } else {
      console.warn("No customer email on session — order paid but nothing sent:", orderId);
    }

    await supabaseAdmin.from("customizer_orders").update({ status: "fulfilled" }).eq("id", orderId);
  } catch (err) {
    // Order stays "paid" (not "fulfilled") so it's easy to find and retry
    // manually — never silently drop a paid order that failed to deliver.
    console.error("Fulfillment failed for order", orderId, err);
  }

  return new Response("ok", { status: 200 });
});

const README_TEXT = `Thanks for customizing your controller with Customs4Daez!

Attached is your custom overlay file: your-controller.html

HOW TO USE IT IN OBS / STREAMLABS:
1. Add a new "Browser Source" to your scene.
2. Check "Local file" and select the attached .html file.
3. Set the width/height to match your controller's canvas size.
4. Connect your controller and start streaming!

Questions? Reply to this email or reach out at customs4daez.com/community.
`;

async function sendOrderEmail(to: string, filename: string, htmlContent: string, order: { product_slug: string | null }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject: "Your custom controller overlay is ready!",
      text: `Your custom controller${order.product_slug ? ` (${order.product_slug})` : ""} is attached, along with setup instructions. Enjoy!`,
      attachments: [
        { filename, content: base64Encode(htmlContent) },
        { filename: "README.txt", content: base64Encode(README_TEXT) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
}

function base64Encode(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

// Minimal Stripe webhook signature verification via Web Crypto (no Stripe
// SDK dependency) — mirrors what stripe.webhooks.constructEvent does.
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string) {
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=") as [string, string]));
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) throw new Error("Malformed Stripe-Signature header");

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (computedSig !== expectedSig) throw new Error("Signature mismatch");
  // 5-minute tolerance, same default Stripe's own SDK uses.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Timestamp outside tolerance");

  return JSON.parse(payload);
}
