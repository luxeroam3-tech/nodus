-- record_expense inserted untyped string literals into documents.type/status
-- (document_type/document_status enums) — Postgres doesn't implicitly cast
-- a bare string literal in a CASE expression to an enum column, so every
-- call failed with "column type is of type document_type but expression is
-- of type text". Caught live while testing the expense-entry form.
create or replace function public.record_expense(
  p_org_id uuid,
  p_date date,
  p_vendor_name text,
  p_expense_account_code text,
  p_amount_cents bigint,
  p_method public.payment_method,
  p_paid boolean default true,
  p_cost_center_id uuid default null
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_doc public.documents;
  entry_id uuid;
  doc_number text;
  cash_code text;
begin
  perform public.require_financial_role(p_org_id);

  cash_code := case p_method when 'mpesa' then '1010' when 'cash' then '1020' else '1000' end;
  doc_number := (case when p_paid then 'EXP-' else 'BILL-' end) || to_char(p_date, 'YYYYMM') || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.documents (org_id, type, number, cost_center_id, status, issue_date, due_date, total_cents, paid_cents, notes)
  values (
    p_org_id,
    (case when p_paid then 'expense' else 'bill' end)::public.document_type,
    doc_number,
    p_cost_center_id,
    (case when p_paid then 'paid' else 'open' end)::public.document_status,
    p_date,
    p_date,
    p_amount_cents,
    case when p_paid then p_amount_cents else 0 end,
    p_vendor_name
  )
  returning * into new_doc;

  if p_paid then
    entry_id := public.post_entry(
      p_org_id, p_date, 'Expense: ' || p_vendor_name, 'expense', new_doc.id,
      jsonb_build_array(
        jsonb_build_object('account_code', p_expense_account_code, 'debit_cents', p_amount_cents, 'cost_center_id', p_cost_center_id),
        jsonb_build_object('account_code', cash_code, 'credit_cents', p_amount_cents, 'cost_center_id', p_cost_center_id)
      )
    );
    insert into public.payments (org_id, document_id, amount_cents, method, reference, date, direction, journal_entry_id)
    values (p_org_id, new_doc.id, p_amount_cents, p_method, p_vendor_name, p_date, 'out', entry_id);
  else
    entry_id := public.post_entry(
      p_org_id, p_date, 'Bill: ' || p_vendor_name, 'bill', new_doc.id,
      jsonb_build_array(
        jsonb_build_object('account_code', p_expense_account_code, 'debit_cents', p_amount_cents, 'cost_center_id', p_cost_center_id),
        jsonb_build_object('account_code', '2100', 'credit_cents', p_amount_cents, 'cost_center_id', p_cost_center_id)
      )
    );
  end if;

  update public.documents set journal_entry_id = entry_id where id = new_doc.id;
  select * into new_doc from public.documents where id = new_doc.id;
  return new_doc;
end;
$$;

revoke execute on function public.record_expense(uuid, date, text, text, bigint, public.payment_method, boolean, uuid) from public, anon;
grant execute on function public.record_expense(uuid, date, text, text, bigint, public.payment_method, boolean, uuid) to authenticated, service_role;
