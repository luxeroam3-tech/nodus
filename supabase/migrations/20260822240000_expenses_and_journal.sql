-- Expense/bill recording + bill settlement. documents.notes gives expenses
-- and bills a place to record the vendor/description — rent invoices never
-- needed one since the tenant name already carries that context.

alter table public.documents add column notes text;

create function public.record_expense(
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

-- Settle a previously-recorded unpaid bill (accounts payable → cash/bank),
-- mirroring record_payment()'s shape but on the payable side of the ledger.
create function public.pay_bill(
  p_document_id uuid,
  p_amount_cents bigint,
  p_method public.payment_method,
  p_reference text,
  p_date date
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.documents;
  cash_code text;
  entry_id uuid;
  new_payment public.payments;
  new_status public.document_status;
begin
  select * into doc from public.documents where id = p_document_id;
  if doc.id is null then
    raise exception 'Document % not found', p_document_id;
  end if;

  perform public.require_financial_role(doc.org_id);

  cash_code := case p_method when 'mpesa' then '1010' when 'cash' then '1020' else '1000' end;

  entry_id := public.post_entry(
    doc.org_id, p_date, 'Payment for ' || doc.number, 'bill_payment', doc.id,
    jsonb_build_array(
      jsonb_build_object('account_code', '2100', 'debit_cents', p_amount_cents, 'cost_center_id', doc.cost_center_id),
      jsonb_build_object('account_code', cash_code, 'credit_cents', p_amount_cents, 'cost_center_id', doc.cost_center_id)
    )
  );

  insert into public.payments (org_id, document_id, amount_cents, method, reference, date, direction, journal_entry_id)
  values (doc.org_id, doc.id, p_amount_cents, p_method, p_reference, p_date, 'out', entry_id)
  returning * into new_payment;

  new_status := case when doc.paid_cents + p_amount_cents >= doc.total_cents then 'paid' else 'partial' end;
  update public.documents set paid_cents = doc.paid_cents + p_amount_cents, status = new_status where id = doc.id;

  return new_payment;
end;
$$;

revoke execute on function public.pay_bill(uuid, bigint, public.payment_method, text, date) from public, anon;
grant execute on function public.pay_bill(uuid, bigint, public.payment_method, text, date) to authenticated, service_role;
