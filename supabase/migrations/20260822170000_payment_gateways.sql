-- Phase 4: M-Pesa Daraja / KopoKopo integration tables. payment_events is the
-- idempotency staging table every inbound/outbound gateway event lands in
-- before (and instead of, on failure) touching payments/documents — the
-- unique index on (gateway_id, provider_ref) is what makes a duplicate
-- webhook delivery a no-op instead of double-applying money.

create table public.payment_gateways (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  gateway_id text not null check (gateway_id in ('mpesa_daraja', 'kopokopo')),
  enabled boolean not null default false,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  config_json text,
  webhook_secret text,
  c2b_registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (org_id, gateway_id)
);

create trigger payment_gateways_set_updated_at
  before update on public.payment_gateways
  for each row execute function public.set_updated_at();

-- KopoKopo rejects creating a payout recipient that already exists for a
-- phone number, with no lookup endpoint — the reference has to be
-- remembered on first creation or that destination becomes unpayable.
create table public.payout_recipients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  gateway_id text not null,
  destination text not null,
  provider_ref text not null,
  created_at timestamptz not null default now(),
  unique (org_id, gateway_id, destination)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  gateway_id text not null,
  provider_ref text not null,
  amount_cents bigint not null,
  payer_phone text,
  payer_name text,
  account_ref text,
  direction public.payment_direction not null default 'in',
  status text not null default 'pending'
    check (status in ('pending', 'received', 'matched', 'unmatched', 'applied', 'failed', 'amount_mismatch')),
  matched_document_id uuid references public.documents(id),
  payment_id uuid references public.payments(id),
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (gateway_id, provider_ref)
);

create index idx_payment_events_org on public.payment_events(org_id);
create index idx_payment_events_status on public.payment_events(org_id, status);

alter table public.payment_gateways enable row level security;
alter table public.payout_recipients enable row level security;
alter table public.payment_events enable row level security;

-- Credentials are sensitive — only the owner manages them. Other financial
-- staff can see that a gateway is enabled without touching config_json's
-- ciphertext.
create policy payment_gateways_select on public.payment_gateways
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy payment_gateways_write on public.payment_gateways
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

create policy payout_recipients_select on public.payout_recipients
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

-- No write policy for authenticated: only server-side code using the
-- service role writes payout_recipients (it's an internal cache, not
-- something a user edits).

create policy payment_events_select on public.payment_events
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

-- No write policy for authenticated: payment_events is only ever written by
-- the webhook handler and the STK-push initiator, both server-side using
-- the service role, which bypasses RLS entirely — there is deliberately no
-- path for a client to insert or edit one directly.

grant select, insert, update, delete on
  public.payment_gateways,
  public.payout_recipients,
  public.payment_events
to authenticated;

grant select, insert, update, delete on
  public.payment_gateways,
  public.payout_recipients,
  public.payment_events
to service_role;

revoke all on
  public.payment_gateways,
  public.payout_recipients,
  public.payment_events
from anon;

notify pgrst, 'reload schema';
