-- Posting engine. Every function here is SECURITY DEFINER and re-checks the
-- caller's financial role itself (RLS is bypassed inside SECURITY DEFINER,
-- so the role check has to happen in the function body, not rely on table
-- policies) — this is the only path that ever writes journal_entries,
-- journal_lines, or payments.

create function public.get_account_id(p_org_id uuid, p_code text)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id from public.chart_of_accounts where org_id = p_org_id and code = p_code;
$$;

revoke execute on function public.get_account_id(uuid, text) from public, anon;
grant execute on function public.get_account_id(uuid, text) to authenticated, service_role;

create function public.require_financial_role(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.org_memberships
    where org_id = p_org_id and user_id = auth.uid() and role in ('owner', 'manager', 'accountant')
  ) then
    raise exception 'Not authorized: financial role required for org %', p_org_id;
  end if;
end;
$$;

revoke execute on function public.require_financial_role(uuid) from public, anon, authenticated, service_role;

-- Kenyan seed chart of accounts. Idempotent — safe to call more than once
-- (existing codes are left untouched).
create function public.seed_chart_of_accounts(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chart_of_accounts (org_id, code, name, type, subtype, system) values
    (p_org_id, '1000', 'Bank account', 'asset', 'bank', true),
    (p_org_id, '1010', 'M-Pesa', 'asset', 'bank', true),
    (p_org_id, '1020', 'Petty cash', 'asset', 'cash', true),
    (p_org_id, '1050', 'Undeposited funds', 'asset', 'other_current_asset', true),
    (p_org_id, '1200', 'Tenant rent receivable', 'asset', 'accounts_receivable', true),
    (p_org_id, '1300', 'VAT input (claimable)', 'asset', 'other_current_asset', true),
    (p_org_id, '1310', 'Withholding tax receivable', 'asset', 'other_current_asset', true),
    (p_org_id, '1500', 'Property and equipment', 'asset', 'fixed_asset', false),
    (p_org_id, '1510', 'Accumulated depreciation', 'asset', 'fixed_asset', false),
    (p_org_id, '2100', 'Accounts payable', 'liability', 'accounts_payable', true),
    (p_org_id, '2200', 'VAT output', 'liability', 'other_current_liability', true),
    (p_org_id, '2300', 'Tenant security deposits held', 'liability', 'other_current_liability', true),
    (p_org_id, '3000', 'Owner equity', 'equity', 'equity', true),
    (p_org_id, '3200', 'Retained earnings', 'equity', 'equity', true),
    (p_org_id, '3900', 'Opening balance equity', 'equity', 'equity', true),
    (p_org_id, '4000', 'Rental income', 'income', 'operating_income', true),
    (p_org_id, '4100', 'Other income', 'income', 'other_income', false),
    (p_org_id, '4110', 'Rounding adjustments', 'income', 'other_income', true),
    (p_org_id, '5000', 'Repairs and maintenance', 'expense', 'operating_expense', false),
    (p_org_id, '5100', 'Utilities', 'expense', 'operating_expense', false),
    (p_org_id, '5200', 'Property management fees', 'expense', 'operating_expense', false),
    (p_org_id, '5300', 'Staff and caretaker wages', 'expense', 'operating_expense', false),
    (p_org_id, '5400', 'Depreciation expense', 'expense', 'operating_expense', false),
    (p_org_id, '6000', 'Bank and gateway fees', 'expense', 'operating_expense', true),
    (p_org_id, '6900', 'General and administrative', 'expense', 'operating_expense', false)
  on conflict (org_id, code) do nothing;
end;
$$;

revoke execute on function public.seed_chart_of_accounts(uuid) from public, anon, authenticated, service_role;

-- Extend org bootstrap to seed the chart of accounts in the same transaction.
create or replace function public.create_organization(org_name text, org_type public.org_type default 'individual')
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create an organization';
  end if;

  insert into public.organizations (name, type)
  values (org_name, org_type)
  returning * into new_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (new_org.id, auth.uid(), 'owner');

  perform public.seed_chart_of_accounts(new_org.id);

  return new_org;
end;
$$;

-- Generic balanced posting. p_lines: jsonb array of
-- {"account_code": "1010", "debit_cents": 3200000, "cost_center_id": null}
-- (credit_cents defaults to 0, debit_cents defaults to 0 — supply whichever
-- side applies per line). Balance is enforced by the deferred constraint
-- trigger on journal_lines; forcing it immediate here surfaces an unbalanced
-- entry as an error from this call instead of a mysterious failure on some
-- unrelated later commit.
create function public.post_entry(
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
  perform public.require_financial_role(p_org_id);

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

  set constraints public.journal_lines_balanced immediate;

  return new_entry_id;
end;
$$;

revoke execute on function public.post_entry(uuid, date, text, text, uuid, jsonb) from public, anon;
grant execute on function public.post_entry(uuid, date, text, text, uuid, jsonb) to authenticated, service_role;

create function public.reverse_entry(p_entry_id uuid, p_date date, p_memo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.journal_entries;
  new_entry_id uuid;
  ln record;
begin
  select * into original from public.journal_entries where id = p_entry_id;
  if original.id is null then
    raise exception 'Journal entry % not found', p_entry_id;
  end if;

  perform public.require_financial_role(original.org_id);

  insert into public.journal_entries (org_id, date, memo, source_type, source_id, reversed_entry_id)
  values (original.org_id, p_date, coalesce(p_memo, 'Reversal of ' || original.id), 'reversal', p_entry_id, p_entry_id)
  returning id into new_entry_id;

  for ln in select * from public.journal_lines where entry_id = p_entry_id
  loop
    insert into public.journal_lines (entry_id, org_id, account_id, cost_center_id, debit_cents, credit_cents)
    values (new_entry_id, original.org_id, ln.account_id, ln.cost_center_id, ln.credit_cents, ln.debit_cents);
  end loop;

  set constraints public.journal_lines_balanced immediate;

  return new_entry_id;
end;
$$;

revoke execute on function public.reverse_entry(uuid, date, text) from public, anon;
grant execute on function public.reverse_entry(uuid, date, text) to authenticated, service_role;

-- Issues a rent invoice document and posts debit AR / credit Rental Income
-- in the same transaction, scoped to the unit's property cost center.
create function public.issue_rent_invoice(
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
  perform public.require_financial_role(p_org_id);

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

  entry_id := public.post_entry(
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

revoke execute on function public.issue_rent_invoice(uuid, uuid, date, date) from public, anon;
grant execute on function public.issue_rent_invoice(uuid, uuid, date, date) to authenticated, service_role;

-- Records a payment against a document: posts debit Bank/Undeposited,
-- credit Tenant rent receivable, updates the document's paid_cents/status,
-- and writes the payments row pointing at the entry it created.
create function public.record_payment(
  p_document_id uuid,
  p_amount_cents bigint,
  p_method public.payment_method,
  p_reference text,
  p_date date,
  p_bank_account_id uuid default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.documents;
  bank_code text := '1050';
  entry_id uuid;
  new_payment public.payments;
  new_status public.document_status;
begin
  select * into doc from public.documents where id = p_document_id;
  if doc.id is null then
    raise exception 'Document % not found', p_document_id;
  end if;

  perform public.require_financial_role(doc.org_id);

  if p_bank_account_id is not null then
    select coalesce(ca.code, '1050') into bank_code
      from public.bank_accounts ba
      left join public.chart_of_accounts ca on ca.id = ba.account_id
      where ba.id = p_bank_account_id and ba.org_id = doc.org_id;
  end if;

  entry_id := public.post_entry(
    doc.org_id,
    p_date,
    'Payment for ' || doc.number,
    'payment',
    doc.id,
    jsonb_build_array(
      jsonb_build_object('account_code', bank_code, 'debit_cents', p_amount_cents, 'cost_center_id', doc.cost_center_id),
      jsonb_build_object('account_code', '1200', 'credit_cents', p_amount_cents, 'cost_center_id', doc.cost_center_id)
    )
  );

  insert into public.payments (org_id, document_id, amount_cents, method, reference, date, direction, bank_account_id, journal_entry_id)
  values (doc.org_id, doc.id, p_amount_cents, p_method, p_reference, p_date, 'in', p_bank_account_id, entry_id)
  returning * into new_payment;

  new_status := case
    when doc.paid_cents + p_amount_cents >= doc.total_cents then 'paid'
    else 'partial'
  end;

  update public.documents
    set paid_cents = doc.paid_cents + p_amount_cents, status = new_status
    where id = doc.id;

  return new_payment;
end;
$$;

revoke execute on function public.record_payment(uuid, bigint, public.payment_method, text, date, uuid) from public, anon;
grant execute on function public.record_payment(uuid, bigint, public.payment_method, text, date, uuid) to authenticated, service_role;
