-- Gateway payment application. Runs only from server-side code holding the
-- service role (STK-push initiation and the webhook handler) — there is no
-- authenticated user in either context, so these follow the same
-- _unchecked-core pattern as the cron path in Phase 3 rather than calling
-- require_financial_role.

-- Stages a pending event at STK-push (or C2B) initiation time, keyed by the
-- gateway's own request id (e.g. Daraja's CheckoutRequestID) so the webhook
-- can find and claim it later.
create function public.request_gateway_payment(
  p_org_id uuid,
  p_gateway_id text,
  p_provider_ref text,
  p_amount_cents bigint,
  p_account_ref text,
  p_matched_document_id uuid default null
)
returns public.payment_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_event public.payment_events;
begin
  insert into public.payment_events (org_id, gateway_id, provider_ref, amount_cents, account_ref, direction, status, matched_document_id)
  values (p_org_id, p_gateway_id, p_provider_ref, p_amount_cents, p_account_ref, 'in', 'pending', p_matched_document_id)
  returning * into new_event;
  return new_event;
end;
$$;

revoke execute on function public.request_gateway_payment(uuid, text, text, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.request_gateway_payment(uuid, text, text, bigint, text, uuid) to service_role;

-- Posts a whole-shilling rounding difference between what the invoice's true
-- balance was and what mobile money actually delivered (M-Pesa/KopoKopo can
-- only move whole shillings; a VAT-bearing balance routinely has cents) —
-- capped at 99 cents, anything larger is a real under/overpayment and must
-- surface as a genuine balance rather than being silently written off.
create function public._absorb_rounding_unchecked(p_org_id uuid, p_diff_cents bigint, p_date date, p_provider_ref text, p_cost_center_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  amount bigint := abs(p_diff_cents);
begin
  perform public._post_entry_unchecked(
    p_org_id,
    p_date,
    'Rounding adjustment - ' || p_provider_ref,
    'rounding_adjustment',
    null,
    case when p_diff_cents > 0 then
      jsonb_build_array(
        jsonb_build_object('account_code', '1050', 'debit_cents', amount, 'cost_center_id', p_cost_center_id),
        jsonb_build_object('account_code', '4110', 'credit_cents', amount, 'cost_center_id', p_cost_center_id)
      )
    else
      jsonb_build_array(
        jsonb_build_object('account_code', '4110', 'debit_cents', amount, 'cost_center_id', p_cost_center_id),
        jsonb_build_object('account_code', '1050', 'credit_cents', amount, 'cost_center_id', p_cost_center_id)
      )
    end
  );
end;
$$;

revoke execute on function public._absorb_rounding_unchecked(uuid, bigint, date, text, uuid) from public, anon, authenticated, service_role;

-- The webhook entry point. Ordering is deliberate: the event row is claimed
-- (matched pending row updated, or a fresh row inserted) BEFORE any money
-- is recorded, so a provider retry or a concurrent duplicate delivery can
-- never double-apply a payment — the unique index on (gateway_id,
-- provider_ref) plus the conditional status='pending' update are the locks.
create function public.apply_gateway_payment(
  p_org_id uuid,
  p_gateway_id text,
  p_provider_ref text,
  p_request_ref text,
  p_amount_cents bigint,
  p_payer_phone text,
  p_payer_name text,
  p_account_ref text,
  p_raw jsonb
)
returns public.payment_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.payment_events;
  pending_amount_cents bigint;
  doc public.documents;
  bank_code text;
  balance_cents bigint;
  amount_to_record bigint;
  diff bigint;
  entry_id uuid;
  new_payment public.payments;
  new_status public.document_status;
begin
  bank_code := case p_gateway_id when 'mpesa_daraja' then '1010' else '1050' end;

  if p_request_ref is not null then
    update public.payment_events
      set provider_ref = p_provider_ref, status = 'received', payer_phone = p_payer_phone, payer_name = p_payer_name, raw_json = p_raw
      where org_id = p_org_id and gateway_id = p_gateway_id and provider_ref = p_request_ref and status = 'pending'
      returning * into claimed;
    if claimed.id is not null then
      pending_amount_cents := claimed.amount_cents;
    end if;
  end if;

  if claimed.id is null then
    insert into public.payment_events (org_id, gateway_id, provider_ref, amount_cents, payer_phone, payer_name, account_ref, status, raw_json)
    values (p_org_id, p_gateway_id, p_provider_ref, p_amount_cents, p_payer_phone, p_payer_name, p_account_ref, 'received', p_raw)
    on conflict (gateway_id, provider_ref) do nothing
    returning * into claimed;
    if claimed.id is null then
      -- Duplicate delivery of an already-claimed provider_ref — a no-op.
      select * into claimed from public.payment_events where gateway_id = p_gateway_id and provider_ref = p_provider_ref;
      return claimed;
    end if;
  end if;

  if pending_amount_cents is not null then
    if pending_amount_cents <> p_amount_cents and p_amount_cents <> ceil(pending_amount_cents / 100.0) * 100 then
      update public.payment_events set status = 'amount_mismatch', amount_cents = p_amount_cents where id = claimed.id;
      claimed.status := 'amount_mismatch';
      return claimed;
    end if;
  end if;

  if claimed.matched_document_id is null and p_account_ref is not null then
    select id into claimed.matched_document_id from public.documents
      where org_id = p_org_id and number = p_account_ref and status in ('open', 'partial')
      limit 1;
  end if;

  if claimed.matched_document_id is null then
    update public.payment_events set status = 'unmatched' where id = claimed.id;
    claimed.status := 'unmatched';
    return claimed;
  end if;

  select * into doc from public.documents where id = claimed.matched_document_id;

  balance_cents := doc.total_cents - doc.paid_cents - doc.credited_cents;
  if balance_cents <= 0 then
    update public.payment_events
      set status = 'amount_mismatch',
          raw_json = jsonb_build_object('raw', p_raw, 'note', 'Invoice already fully paid — not auto-recorded, check for a duplicate before applying manually.')
      where id = claimed.id;
    claimed.status := 'amount_mismatch';
    return claimed;
  end if;

  amount_to_record := p_amount_cents;
  diff := p_amount_cents - balance_cents;
  if diff <> 0 and abs(diff) < 100 then
    amount_to_record := balance_cents;
    perform public._absorb_rounding_unchecked(p_org_id, diff, current_date, p_provider_ref, doc.cost_center_id);
  end if;

  entry_id := public._post_entry_unchecked(
    p_org_id,
    current_date,
    'Payment for ' || doc.number,
    'gateway_payment',
    doc.id,
    jsonb_build_array(
      jsonb_build_object('account_code', bank_code, 'debit_cents', amount_to_record, 'cost_center_id', doc.cost_center_id),
      jsonb_build_object('account_code', '1200', 'credit_cents', amount_to_record, 'cost_center_id', doc.cost_center_id)
    )
  );

  insert into public.payments (org_id, document_id, amount_cents, method, reference, date, direction, journal_entry_id)
  values (p_org_id, doc.id, amount_to_record, (case p_gateway_id when 'mpesa_daraja' then 'mpesa' else 'kopokopo' end)::public.payment_method, right(regexp_replace(p_provider_ref, '[^A-Za-z0-9]', '', 'g'), 8), current_date, 'in', entry_id)
  returning * into new_payment;

  new_status := case when doc.paid_cents + amount_to_record >= doc.total_cents then 'paid' else 'partial' end;
  update public.documents set paid_cents = doc.paid_cents + amount_to_record, status = new_status where id = doc.id;

  update public.payment_events
    set status = 'applied', matched_document_id = doc.id, payment_id = new_payment.id
    where id = claimed.id
    returning * into claimed;

  return claimed;
end;
$$;

revoke execute on function public.apply_gateway_payment(uuid, text, text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_gateway_payment(uuid, text, text, text, bigint, text, text, text, jsonb) to service_role;
