-- Phase 8: SMS + PDF receipts + rent reminders.

create table public.sms_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  provider text not null default 'advanta',
  config_json text, -- encrypted (aes-256-gcm via GATEWAY_CONFIG_KEY, same as payment_gateways)
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create trigger sms_settings_set_updated_at
  before update on public.sms_settings
  for each row execute function public.set_updated_at();

create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('receipt', 'rent_reminder')),
  payment_id uuid references public.payments(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  phone text not null default '',
  message text not null default '',
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  provider_ref text,
  error text,
  sent_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- One receipt SMS per payment, ever — dedupes webhook retries.
create unique index sms_log_one_receipt_per_payment
  on public.sms_log(payment_id) where kind = 'receipt';

-- One rent-reminder SMS per document per calendar day.
create unique index sms_log_one_reminder_per_document_per_day
  on public.sms_log(document_id, sent_date) where kind = 'rent_reminder';

create index idx_sms_log_org on public.sms_log(org_id);

create table public.receipt_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  token text not null unique,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index receipt_tokens_one_per_payment
  on public.receipt_tokens(payment_id) where revoked = false;
create index idx_receipt_tokens_org on public.receipt_tokens(org_id);

alter table public.sms_settings enable row level security;
alter table public.sms_log enable row level security;
alter table public.receipt_tokens enable row level security;

-- sms_settings: financial-role staff manage their own SMS provider config,
-- only the owner can write (mirrors payment_gateways_write).
create policy sms_settings_select on public.sms_settings
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));
create policy sms_settings_write on public.sms_settings
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

-- sms_log / receipt_tokens: read-only from the client, service_role writes
-- via the notify package. Staff can see delivery status; nothing else.
create policy sms_log_select on public.sms_log
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));
create policy receipt_tokens_select on public.receipt_tokens
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

revoke all on public.sms_settings from anon, authenticated;
grant select, insert, update, delete on public.sms_settings to authenticated;
grant select on public.sms_settings to service_role;

revoke all on public.sms_log from anon, authenticated;
grant select on public.sms_log to authenticated;
grant all on public.sms_log to service_role;

revoke all on public.receipt_tokens from anon, authenticated;
grant select on public.receipt_tokens to authenticated;
grant all on public.receipt_tokens to service_role;
