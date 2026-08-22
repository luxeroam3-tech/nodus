-- Security deposits: a separate liability-side event from rent, never
-- routed through documents/invoices — a deposit isn't income, it's cash
-- held on the tenant's behalf until move-out. Ties into the same ledger
-- the rest of accounting reads from via chart_of_accounts code 2300
-- (seeded since Phase 2, unused until now).

create type public.deposit_status as enum ('held', 'partially_refunded', 'refunded', 'forfeited');

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  method public.payment_method not null,
  collected_date date not null default current_date,
  status public.deposit_status not null default 'held',
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  forfeited_cents bigint not null default 0 check (forfeited_cents >= 0),
  refund_date date,
  refund_notes text,
  collection_journal_entry_id uuid references public.journal_entries(id),
  refund_journal_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (lease_id)
);

create index idx_deposits_org on public.deposits(org_id);
create index idx_deposits_lease on public.deposits(lease_id);

create trigger deposits_set_updated_at
  before update on public.deposits
  for each row execute function public.set_updated_at();

alter table public.deposits enable row level security;

-- Read-only from the client — collect_deposit()/refund_deposit() are the
-- only write paths, same pattern as payments (record_payment() is the
-- only way a payment row gets created).
create policy deposits_select on public.deposits
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

revoke all on public.deposits from anon, authenticated;
grant select on public.deposits to authenticated;
grant all on public.deposits to service_role;

-- Collects a lease's security deposit: debit cash/bank, credit 2300
-- (Tenant security deposits held). One deposit per lease — a second call
-- for the same lease is rejected rather than silently creating a duplicate.
create function public.collect_deposit(
  p_lease_id uuid,
  p_amount_cents bigint,
  p_method public.payment_method,
  p_date date
)
returns public.deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  lease public.leases;
  cash_code text;
  entry_id uuid;
  new_deposit public.deposits;
begin
  select * into lease from public.leases where id = p_lease_id;
  if lease.id is null then
    raise exception 'Lease % not found', p_lease_id;
  end if;

  perform public.require_financial_role(lease.org_id);

  if exists (select 1 from public.deposits where lease_id = p_lease_id) then
    raise exception 'A deposit has already been recorded for this lease';
  end if;

  cash_code := case p_method when 'mpesa' then '1010' when 'cash' then '1020' else '1000' end;

  entry_id := public.post_entry(
    lease.org_id, p_date, 'Security deposit collected', 'deposit', p_lease_id,
    jsonb_build_array(
      jsonb_build_object('account_code', cash_code, 'debit_cents', p_amount_cents),
      jsonb_build_object('account_code', '2300', 'credit_cents', p_amount_cents)
    )
  );

  insert into public.deposits (org_id, lease_id, amount_cents, method, collected_date, collection_journal_entry_id)
  values (lease.org_id, p_lease_id, p_amount_cents, p_method, p_date, entry_id)
  returning * into new_deposit;

  return new_deposit;
end;
$$;

revoke execute on function public.collect_deposit(uuid, bigint, public.payment_method, date) from public, anon;
grant execute on function public.collect_deposit(uuid, bigint, public.payment_method, date) to authenticated, service_role;

-- Settles a held deposit exactly once: clears the 2300 liability, pays
-- back whatever's refunded in cash, and books whatever's forfeited as
-- income (damages/unpaid-rent recovery). refund_cents + forfeit_cents
-- must not exceed the original deposit.
create function public.refund_deposit(
  p_deposit_id uuid,
  p_refund_cents bigint,
  p_forfeit_cents bigint,
  p_method public.payment_method,
  p_date date,
  p_notes text
)
returns public.deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  dep public.deposits;
  cash_code text;
  entry_id uuid;
  lines jsonb;
  new_status public.deposit_status;
begin
  select * into dep from public.deposits where id = p_deposit_id;
  if dep.id is null then
    raise exception 'Deposit % not found', p_deposit_id;
  end if;

  perform public.require_financial_role(dep.org_id);

  if dep.status <> 'held' then
    raise exception 'Deposit % has already been settled', p_deposit_id;
  end if;
  if p_refund_cents < 0 or p_forfeit_cents < 0 then
    raise exception 'Refund and forfeit amounts must be zero or positive';
  end if;
  if p_refund_cents + p_forfeit_cents > dep.amount_cents then
    raise exception 'Refund + forfeit (%) exceeds the deposit held (%)', p_refund_cents + p_forfeit_cents, dep.amount_cents;
  end if;

  cash_code := case p_method when 'mpesa' then '1010' when 'cash' then '1020' else '1000' end;

  lines := jsonb_build_array(jsonb_build_object('account_code', '2300', 'debit_cents', p_refund_cents + p_forfeit_cents));
  if p_refund_cents > 0 then
    lines := lines || jsonb_build_array(jsonb_build_object('account_code', cash_code, 'credit_cents', p_refund_cents));
  end if;
  if p_forfeit_cents > 0 then
    lines := lines || jsonb_build_array(jsonb_build_object('account_code', '4100', 'credit_cents', p_forfeit_cents));
  end if;

  entry_id := public.post_entry(dep.org_id, p_date, 'Security deposit settled', 'deposit_refund', dep.lease_id, lines);

  new_status := case
    when p_refund_cents = dep.amount_cents then 'refunded'
    when p_forfeit_cents = dep.amount_cents then 'forfeited'
    else 'partially_refunded'
  end;

  update public.deposits
    set refunded_cents = p_refund_cents, forfeited_cents = p_forfeit_cents, status = new_status,
        refund_date = p_date, refund_notes = p_notes, refund_journal_entry_id = entry_id
    where id = p_deposit_id
    returning * into dep;

  return dep;
end;
$$;

revoke execute on function public.refund_deposit(uuid, bigint, bigint, public.payment_method, date, text) from public, anon;
grant execute on function public.refund_deposit(uuid, bigint, bigint, public.payment_method, date, text) to authenticated, service_role;
