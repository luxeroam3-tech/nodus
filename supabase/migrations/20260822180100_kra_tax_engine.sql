-- eTIMS control-unit simulator. A real deployment plugs an OSCU (KRA online
-- API) or VSCU (local unit) adapter in here — the simulator lets the whole
-- fiscalization flow (CU number, serial, KRA-verify QR) work end to end and
-- keeps the schema production-shaped, while its output stays clearly
-- non-fiscal until real device credentials replace it. Matches the "no
-- Daraja creds yet, build against a mock" pattern from Phase 4.
create function public._simulated_etims_sign(
  p_seller_pin text,
  p_invoice_number text,
  p_total_cents bigint,
  p_vat_cents bigint,
  p_date date
)
returns table (cu_invoice_number text, cu_serial text, qr_url text)
language sql
immutable
set search_path = ''
as $$
  select
    'SIM' || upper(substr(encode(extensions.digest(coalesce(p_seller_pin, '') || '|' || p_invoice_number || '|' || p_total_cents || '|' || p_vat_cents || '|' || p_date, 'sha256'), 'hex'), 1, 16)) as cu_invoice_number,
    'SIMDEVICE-' || upper(substr(encode(extensions.digest(coalesce(p_seller_pin, ''), 'sha256'), 'hex'), 1, 8)) as cu_serial,
    'https://itax.kra.go.ke/etims-verify-simulated/' || upper(substr(encode(extensions.digest(coalesce(p_seller_pin, '') || '|' || p_invoice_number, 'sha256'), 'hex'), 1, 20)) as qr_url;
$$;

revoke execute on function public._simulated_etims_sign(text, text, bigint, bigint, date) from public, anon, authenticated, service_role;

-- Fiscalizes a document (issues its eTIMS-equivalent record) — only makes
-- sense for VAT-carrying documents, and only once per document: a document
-- is an immutable fiscal event once signed, so re-signing would mean two
-- KRA-facing numbers exist for the same invoice.
create function public.fiscalize_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.documents;
  org public.organizations;
  signed record;
begin
  select * into doc from public.documents where id = p_document_id;
  if doc.id is null then
    raise exception 'Document % not found', p_document_id;
  end if;

  perform public.require_financial_role(doc.org_id);

  if doc.fiscalized_at is not null then
    raise exception 'Document % is already fiscalized (%)', doc.number, doc.cu_invoice_number;
  end if;

  select * into org from public.organizations where id = doc.org_id;
  if org.kra_pin is null then
    raise exception 'Org has no KRA PIN on file — add one in Settings before fiscalizing invoices';
  end if;

  select * into signed from public._simulated_etims_sign(org.kra_pin, doc.number, doc.total_cents, doc.vat_cents, doc.issue_date);

  update public.documents
    set cu_invoice_number = signed.cu_invoice_number,
        cu_serial = signed.cu_serial,
        qr_url = signed.qr_url,
        fiscalized_at = now()
    where id = doc.id
    returning * into doc;

  return doc;
end;
$$;

revoke execute on function public.fiscalize_document(uuid) from public, anon;
grant execute on function public.fiscalize_document(uuid) to authenticated, service_role;

-- VAT-aware rewrite of the rent-invoice core: commercial units at a
-- VAT-registered org get rent + 16% VAT split across Rental income (4000)
-- and VAT output (2200); everything else (residential, or an org that
-- isn't VAT-registered) is unchanged from Phase 2/3 — rent only, no VAT
-- line, matching Monthly Rental Income tax's gross-receipts basis.
create or replace function public._issue_rent_invoice_unchecked(
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
  unit public.units;
  org public.organizations;
  new_doc public.documents;
  cc_id uuid;
  doc_number text;
  entry_id uuid;
  vat_amount bigint := 0;
  total_amount bigint;
  lines jsonb;
begin
  select * into lease from public.leases where id = p_lease_id and org_id = p_org_id;
  if lease.id is null then
    raise exception 'Lease % not found in org %', p_lease_id, p_org_id;
  end if;

  select * into unit from public.units where id = lease.unit_id;
  select * into org from public.organizations where id = p_org_id;

  select cc.id into cc_id from public.cost_centers cc
    join public.units u on u.property_id = cc.property_id
    where u.id = lease.unit_id;

  doc_number := 'RENT-' || to_char(p_issue_date, 'YYYYMM') || '-' || substr(lease.id::text, 1, 8);

  if org.vat_registered and unit.is_commercial then
    vat_amount := round(lease.rent_amount_cents * 0.16);
  end if;
  total_amount := lease.rent_amount_cents + vat_amount;

  insert into public.documents (org_id, type, number, tenant_id, unit_id, cost_center_id, status, issue_date, due_date, total_cents, vat_cents)
  values (p_org_id, 'rent_invoice', doc_number, lease.tenant_id, lease.unit_id, cc_id, 'open', p_issue_date, p_due_date, total_amount, vat_amount)
  returning * into new_doc;

  if vat_amount > 0 then
    lines := jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit_cents', total_amount, 'cost_center_id', cc_id),
      jsonb_build_object('account_code', '4000', 'credit_cents', lease.rent_amount_cents, 'cost_center_id', cc_id),
      jsonb_build_object('account_code', '2200', 'credit_cents', vat_amount, 'cost_center_id', cc_id)
    );
  else
    lines := jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit_cents', total_amount, 'cost_center_id', cc_id),
      jsonb_build_object('account_code', '4000', 'credit_cents', total_amount, 'cost_center_id', cc_id)
    );
  end if;

  entry_id := public._post_entry_unchecked(
    p_org_id,
    p_issue_date,
    'Rent invoice ' || doc_number,
    'rent_invoice',
    new_doc.id,
    lines
  );

  update public.documents set journal_entry_id = entry_id where id = new_doc.id;
  new_doc.journal_entry_id := entry_id;

  return new_doc;
end;
$$;

-- Monthly Rental Income tax: 7.5% of gross rent actually RECEIVED (cash
-- basis) in the period, residential only — this is a final tax on receipts,
-- not an invoice-based one, so it reads from payments against rent_invoice
-- documents on non-commercial units, not from what was merely billed.
create function public.report_monthly_rental_income_tax(p_org_id uuid, p_year integer, p_month integer)
returns table (gross_rent_received_cents bigint, tax_due_cents bigint, payment_count integer)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.require_financial_role(p_org_id);

  return query
    select
      coalesce(sum(p.amount_cents), 0)::bigint,
      round(coalesce(sum(p.amount_cents), 0) * 0.075)::bigint,
      count(*)::integer
    from public.payments p
    join public.documents d on d.id = p.document_id
    join public.units u on u.id = d.unit_id
    where p.org_id = p_org_id
      and p.direction = 'in'
      and d.type = 'rent_invoice'
      and u.is_commercial = false
      and extract(year from p.date) = p_year
      and extract(month from p.date) = p_month;
end;
$$;

revoke execute on function public.report_monthly_rental_income_tax(uuid, integer, integer) from public, anon;
grant execute on function public.report_monthly_rental_income_tax(uuid, integer, integer) to authenticated, service_role;

-- VAT output collected on commercial rent in the period — reads directly
-- from the ledger (account 2200), so it always agrees with what's actually
-- posted rather than being recomputed from documents separately.
create function public.report_vat_output(p_org_id uuid, p_year integer, p_month integer)
returns table (vat_output_cents bigint, invoice_count integer)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.require_financial_role(p_org_id);

  return query
    select
      coalesce(sum(jl.credit_cents), 0)::bigint,
      count(distinct jl.entry_id)::integer
    from public.journal_lines jl
    join public.chart_of_accounts coa on coa.id = jl.account_id
    join public.journal_entries je on je.id = jl.entry_id
    where jl.org_id = p_org_id
      and coa.code = '2200'
      and extract(year from je.date) = p_year
      and extract(month from je.date) = p_month;
end;
$$;

revoke execute on function public.report_vat_output(uuid, integer, integer) from public, anon;
grant execute on function public.report_vat_output(uuid, integer, integer) to authenticated, service_role;
