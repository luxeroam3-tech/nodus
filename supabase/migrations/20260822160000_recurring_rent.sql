-- Phase 3: recurring rent engine. advance_date() mirrors the date math from
-- the earlier Zeno recurring.ts port exactly — month-based frequencies clamp
-- to the last day of a shorter target month (Jan 31 + 1 month -> Feb 28/29)
-- rather than overflowing into the next month the way plain
-- `date + interval 'N months'` arithmetic does in Postgres.

create type public.billing_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');

alter table public.leases
  add column rent_frequency public.billing_frequency not null default 'monthly',
  add column next_invoice_date date,
  add column invoice_due_offset_days integer not null default 5 check (invoice_due_offset_days >= 0);

create function public.advance_date(p_date date, p_frequency public.billing_frequency)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  months_to_add integer;
  target_month_index integer;
  target_year integer;
  target_month integer;
  last_day_of_target_month integer;
  clamped_day integer;
begin
  if p_frequency = 'weekly' then
    return p_date + 7;
  end if;

  months_to_add := case p_frequency
    when 'monthly' then 1
    when 'quarterly' then 3
    when 'yearly' then 12
  end;

  target_month_index := (extract(month from p_date)::integer - 1) + months_to_add;
  target_year := extract(year from p_date)::integer + (target_month_index / 12);
  target_month := (target_month_index % 12) + 1;
  last_day_of_target_month := extract(day from (date_trunc('month', make_date(target_year, target_month, 1)) + interval '1 month - 1 day'))::integer;
  clamped_day := least(extract(day from p_date)::integer, last_day_of_target_month);

  return make_date(target_year, target_month, clamped_day);
end;
$$;

revoke execute on function public.advance_date(date, public.billing_frequency) from public, anon;
grant execute on function public.advance_date(date, public.billing_frequency) to authenticated, service_role;

-- A new active lease starts its billing cycle on its own start date.
create function public.set_lease_next_invoice_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_invoice_date is null then
    new.next_invoice_date := new.start_date;
  end if;
  return new;
end;
$$;

create trigger leases_set_next_invoice_date
  before insert on public.leases
  for each row execute function public.set_lease_next_invoice_date();

-- issue_rent_invoice's own role check assumes an authenticated caller with a
-- real auth.uid() — that's never true for the cron-driven path below, where
-- there is no session at all. Split the actual work out into an unchecked
-- core that only ever runs from inside another SECURITY DEFINER function:
-- ownership (not the calling role's grants) is what lets a SECURITY DEFINER
-- function call another one whose EXECUTE has been revoked from everyone,
-- so this stays unreachable from PostgREST/any client no matter what.
-- post_entry() is called from inside _issue_rent_invoice_unchecked below,
-- which means it also needs to work without a real auth.uid() when the
-- caller is the cron path — but post_entry's own require_financial_role
-- check has the same problem issue_rent_invoice's did. Give post_entry an
-- internal-only unchecked counterpart for the same ownership-bypass reason.
create function public._post_entry_unchecked(
  p_org_id uuid,
  p_date date,
  p_memo text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_entry_id uuid;
  line jsonb;
  resolved_account_id uuid;
begin
  if jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal entry needs at least two lines';
  end if;

  insert into public.journal_entries (org_id, date, memo, source_type, source_id)
  values (p_org_id, p_date, coalesce(p_memo, ''), coalesce(p_source_type, 'manual'), p_source_id)
  returning id into new_entry_id;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    resolved_account_id := public.get_account_id(p_org_id, line->>'account_code');
    if resolved_account_id is null then
      raise exception 'Unknown account code % for org %', line->>'account_code', p_org_id;
    end if;

    insert into public.journal_lines (entry_id, org_id, account_id, cost_center_id, debit_cents, credit_cents)
    values (
      new_entry_id,
      p_org_id,
      resolved_account_id,
      nullif(line->>'cost_center_id', '')::uuid,
      coalesce((line->>'debit_cents')::bigint, 0),
      coalesce((line->>'credit_cents')::bigint, 0)
    );
  end loop;

  return new_entry_id;
end;
$$;

revoke execute on function public._post_entry_unchecked(uuid, date, text, text, uuid, jsonb) from public, anon, authenticated, service_role;

create function public._issue_rent_invoice_unchecked(
  p_org_id uuid,
  p_lease_id uuid,
  p_issue_date date,
  p_due_date date
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  lease public.leases;
  new_doc public.documents;
  cc_id uuid;
  doc_number text;
  entry_id uuid;
begin
  select * into lease from public.leases where id = p_lease_id and org_id = p_org_id;
  if lease.id is null then
    raise exception 'Lease % not found in org %', p_lease_id, p_org_id;
  end if;

  select cc.id into cc_id from public.cost_centers cc
    join public.units u on u.property_id = cc.property_id
    where u.id = lease.unit_id;

  doc_number := 'RENT-' || to_char(p_issue_date, 'YYYYMM') || '-' || substr(lease.id::text, 1, 8);

  insert into public.documents (org_id, type, number, tenant_id, unit_id, cost_center_id, status, issue_date, due_date, total_cents)
  values (p_org_id, 'rent_invoice', doc_number, lease.tenant_id, lease.unit_id, cc_id, 'open', p_issue_date, p_due_date, lease.rent_amount_cents)
  returning * into new_doc;

  entry_id := public._post_entry_unchecked(
    p_org_id,
    p_issue_date,
    'Rent invoice ' || doc_number,
    'rent_invoice',
    new_doc.id,
    jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit_cents', lease.rent_amount_cents, 'cost_center_id', cc_id),
      jsonb_build_object('account_code', '4000', 'credit_cents', lease.rent_amount_cents, 'cost_center_id', cc_id)
    )
  );

  update public.documents set journal_entry_id = entry_id where id = new_doc.id;
  new_doc.journal_entry_id := entry_id;

  return new_doc;
end;
$$;

revoke execute on function public._issue_rent_invoice_unchecked(uuid, uuid, date, date) from public, anon, authenticated, service_role;

-- The client-facing entry points now delegate to the unchecked core after
-- doing their own role check, instead of duplicating the posting logic.
create or replace function public.post_entry(
  p_org_id uuid,
  p_date date,
  p_memo text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_financial_role(p_org_id);
  return public._post_entry_unchecked(p_org_id, p_date, p_memo, p_source_type, p_source_id, p_lines);
end;
$$;

create or replace function public.issue_rent_invoice(
  p_org_id uuid,
  p_lease_id uuid,
  p_issue_date date,
  p_due_date date
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_financial_role(p_org_id);
  return public._issue_rent_invoice_unchecked(p_org_id, p_lease_id, p_issue_date, p_due_date);
end;
$$;

-- System job, not a per-user action — auth.uid() is null when pg_cron calls
-- this, so it goes through the unchecked core above rather than the
-- role-checked public entry points. Only service_role may execute it.
-- Caps backfill per lease at p_cap runs so a lease nobody touched for years
-- can't flood the ledger in one pass — same guard as Zeno's dueRuns().
-- FOR UPDATE SKIP LOCKED matters beyond tests: an overlapping cron run (or a
-- manual trigger firing mid-schedule) would otherwise race two invocations
-- over the same lease and collide inserting the same document number twice.
-- Skipping a locked lease is safe — it just gets picked up on the next run.
create function public.generate_due_rent_invoices(p_cap integer default 12, p_org_id uuid default null)
returns table (lease_id uuid, document_id uuid, issued_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  lease record;
  runs integer;
  doc public.documents;
begin
  for lease in
    select * from public.leases
    where status = 'active' and next_invoice_date is not null and next_invoice_date <= current_date
      and (p_org_id is null or org_id = p_org_id)
    order by next_invoice_date
    for update skip locked
  loop
    runs := 0;
    while lease.next_invoice_date <= current_date and runs < p_cap loop
      doc := public._issue_rent_invoice_unchecked(
        lease.org_id,
        lease.id,
        lease.next_invoice_date,
        lease.next_invoice_date + lease.invoice_due_offset_days
      );

      lease_id := lease.id;
      document_id := doc.id;
      issued_date := lease.next_invoice_date;
      return next;

      lease.next_invoice_date := public.advance_date(lease.next_invoice_date, lease.rent_frequency);
      update public.leases set next_invoice_date = lease.next_invoice_date where id = lease.id;

      runs := runs + 1;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.generate_due_rent_invoices(integer, uuid) from public, anon, authenticated;
grant execute on function public.generate_due_rent_invoices(integer, uuid) to service_role;

create extension if not exists pg_cron;

-- 03:00 UTC = 06:00 Africa/Nairobi (UTC+3, no DST).
select
  cron.schedule(
    'generate-due-rent-invoices',
    '0 3 * * *',
    $$select public.generate_due_rent_invoices();$$
  )
where not exists (select 1 from cron.job where jobname = 'generate-due-rent-invoices');
