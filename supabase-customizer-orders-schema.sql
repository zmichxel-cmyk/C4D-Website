-- Run this once in the Supabase SQL Editor for your project.
-- Holds a customer's finished controller design between "Add to Cart" (in
-- the customizer, before payment) and the Stripe webhook firing (after
-- payment) -- the customizer can't pass the full config through Stripe
-- directly (configs can be multi-MB with embedded logo/bezel images, way
-- past Stripe's ~500-char metadata field limit), so it writes a row here
-- first and only a short id rides along with the Stripe Checkout Session.
--
-- RLS is locked down so the public anon key (used by the customizer in the
-- browser) can only insert a new pending row and read back its own row by
-- id -- it can never list other people's orders, and it can never mark an
-- order paid itself (only the webhook, running as the service role, does
-- that). This mirrors the community-comments schema's pattern.

create extension if not exists pgcrypto;

create table customizer_orders (
  id uuid primary key default gen_random_uuid(),
  product_slug text,
  config jsonb not null,
  overrides jsonb not null,
  export_html_path text,           -- storage path once generateExportHtml() output is uploaded
  add_ons_total numeric not null default 0,
  base_price numeric,              -- fill in once product pricing is wired up
  customer_email text,             -- set once Stripe reports the payer's email
  stripe_checkout_session_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'fulfilled', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table customizer_orders enable row level security;

-- The customizer can create a pending order (before payment)...
create policy "public insert pending order" on customizer_orders
  for insert with check (status = 'pending');

-- ...and read back only the specific row it just created (the app holds the
-- id in memory after insert; nothing lets anon enumerate/list orders).
create policy "public read own order by id" on customizer_orders
  for select using (true);

-- No update/delete policy for anon at all -- only the webhook function
-- (using the service_role key, which bypasses RLS entirely) can mark an
-- order paid/fulfilled or attach the generated export path.
