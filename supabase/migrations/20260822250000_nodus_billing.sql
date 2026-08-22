-- Phase 9: Nodus's own SaaS billing — landlords/agencies subscribe to
-- Nodus's own pricing tiers. Separate from payment_gateways (which holds
-- credentials for a landlord's *own* M-Pesa/KopoKopo collection from
-- tenants) — this is Nodus-the-company collecting from the landlord.

create table public.nodus_subscriptions (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'standard', 'business')),
  paid_until date not null default '9999-12-31',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create trigger nodus_subscriptions_set_updated_at
  before update on public.nodus_subscriptions
  for each row execute function public.set_updated_at();

-- Staging table for an STK push attempt, mirroring payment_events'
-- idempotency shape: one row per attempt, flipped to 'applied' exactly
-- once by apply_nodus_billing_payment().
create table public.nodus_billing_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('standard', 'business')),
  cycle text not null check (cycle in ('monthly', 'annual')),
  amount_cents bigint not null check (amount_cents > 0),
  phone text,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed', 'applied')),
  failed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index nodus_billing_payments_provider_ref on public.nodus_billing_payments(provider_ref) where provider_ref is not null;
create index idx_nodus_billing_payments_org on public.nodus_billing_payments(org_id);

create trigger nodus_billing_payments_set_updated_at
  before update on public.nodus_billing_payments
  for each row execute function public.set_updated_at();

-- Backfill: orgs created before this migration get a free-plan row too.
insert into public.nodus_subscriptions (org_id, plan, paid_until)
select id, 'free', '9999-12-31' from public.organizations
on conflict (org_id) do nothing;

alter table public.nodus_subscriptions enable row level security;
alter table public.nodus_billing_payments enable row level security;

-- Any org member can see their own plan; only the owner can pay/upgrade.
create policy nodus_subscriptions_select on public.nodus_subscriptions
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy nodus_billing_payments_select on public.nodus_billing_payments
  for select to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

create policy nodus_billing_payments_insert on public.nodus_billing_payments
  for insert to authenticated
  with check (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

revoke all on public.nodus_subscriptions from anon, authenticated;
grant select on public.nodus_subscriptions to authenticated;
grant all on public.nodus_subscriptions to service_role;

revoke all on public.nodus_billing_payments from anon, authenticated;
grant select, insert on public.nodus_billing_payments to authenticated;
grant all on public.nodus_billing_payments to service_role;

-- Applies a completed billing payment: extends paid_until from the existing
-- date if renewing the same plan before expiry, else starts from today.
-- Idempotent — only the first call on a given payment does anything.
create function public.apply_nodus_billing_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.nodus_billing_payments;
  existing public.nodus_subscriptions;
  base date;
  new_paid_until date;
begin
  select * into pay from public.nodus_billing_payments where id = p_payment_id;
  if pay.id is null or pay.status = 'applied' then
    return false;
  end if;

  select * into existing from public.nodus_subscriptions where org_id = pay.org_id;

  base := case
    when existing.org_id is not null and existing.plan = pay.plan and existing.paid_until > current_date and existing.paid_until < '9000-01-01'
      then existing.paid_until
    else current_date
  end;
  new_paid_until := base + (case when pay.cycle = 'annual' then 365 else 30 end);

  insert into public.nodus_subscriptions (org_id, plan, paid_until)
  values (pay.org_id, pay.plan, new_paid_until)
  on conflict (org_id) do update set plan = excluded.plan, paid_until = excluded.paid_until;

  update public.nodus_billing_payments set status = 'applied' where id = p_payment_id;
  return true;
end;
$$;

revoke execute on function public.apply_nodus_billing_payment(uuid) from public, anon, authenticated;
grant execute on function public.apply_nodus_billing_payment(uuid) to service_role;

-- Every org starts on the free plan the moment it's created.
create or replace function public.create_organization(org_name text, org_type public.org_type default 'individual')
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org public.organizations;
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create an organization';
  end if;

  base_slug := public.slugify(org_name);
  if base_slug = '' then
    base_slug := 'org';
  end if;
  candidate_slug := base_slug;
  while exists (select 1 from public.organizations where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (name, type, slug)
  values (org_name, org_type, candidate_slug)
  returning * into new_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (new_org.id, auth.uid(), 'owner');

  perform public.seed_chart_of_accounts(new_org.id);

  insert into public.nodus_subscriptions (org_id, plan, paid_until) values (new_org.id, 'free', '9999-12-31');

  return new_org;
end;
$$;
