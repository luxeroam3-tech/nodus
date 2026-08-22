-- Accounting reports: Trial Balance, P&L, Balance Sheet, General Ledger.
-- All read straight from journal_lines/chart_of_accounts — the same ledger
-- every posting already goes through, so these can never disagree with the
-- documents/payments UI.

-- Every account's balance as of a date, signed to its natural side
-- (asset/expense: debit-positive; liability/equity/income: credit-positive).
create function public.report_trial_balance(p_org_id uuid, p_as_of date)
returns table (account_code text, account_name text, account_type public.account_type, balance_cents bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.require_financial_role(p_org_id);

  return query
    select
      coa.code,
      coa.name,
      coa.type,
      (case
        when coa.type in ('asset', 'expense')
          then coalesce(sum(jl.debit_cents), 0) - coalesce(sum(jl.credit_cents), 0)
        else coalesce(sum(jl.credit_cents), 0) - coalesce(sum(jl.debit_cents), 0)
      end)::bigint
    from public.chart_of_accounts coa
    left join public.journal_lines jl on jl.account_id = coa.id
    left join public.journal_entries je on je.id = jl.entry_id and je.date <= p_as_of
    where coa.org_id = p_org_id and coa.active
    group by coa.id, coa.code, coa.name, coa.type
    order by coa.code;
end;
$$;

revoke execute on function public.report_trial_balance(uuid, date) from public, anon;
grant execute on function public.report_trial_balance(uuid, date) to authenticated, service_role;

-- Income and expense activity for a period. amount_cents is signed to the
-- account's natural balance (income: credit-positive; expense: debit-positive)
-- so summing income minus summing expense gives net income directly.
create function public.report_profit_and_loss(p_org_id uuid, p_start date, p_end date)
returns table (account_code text, account_name text, account_type public.account_type, amount_cents bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform public.require_financial_role(p_org_id);

  return query
    select
      coa.code,
      coa.name,
      coa.type,
      (case
        when coa.type = 'income' then sum(jl.credit_cents) - sum(jl.debit_cents)
        else sum(jl.debit_cents) - sum(jl.credit_cents)
      end)::bigint
    from public.chart_of_accounts coa
    join public.journal_lines jl on jl.account_id = coa.id
    join public.journal_entries je on je.id = jl.entry_id and je.date between p_start and p_end
    where coa.org_id = p_org_id and coa.type in ('income', 'expense')
    group by coa.id, coa.code, coa.name, coa.type
    having sum(jl.debit_cents) <> 0 or sum(jl.credit_cents) <> 0
    order by coa.type desc, coa.code;
end;
$$;

revoke execute on function public.report_profit_and_loss(uuid, date, date) from public, anon;
grant execute on function public.report_profit_and_loss(uuid, date, date) to authenticated, service_role;

-- Assets/liabilities/equity as of a date, plus a synthetic "Current period
-- earnings" line (income accounts are never closed to retained earnings
-- entry-by-entry, so the balance sheet has to fold in P&L-to-date itself to
-- balance against assets).
create function public.report_balance_sheet(p_org_id uuid, p_as_of date)
returns table (account_code text, account_name text, account_type public.account_type, balance_cents bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  net_income_cents bigint;
begin
  perform public.require_financial_role(p_org_id);

  select coalesce(sum(case when coa.type = 'income' then jl.credit_cents - jl.debit_cents else jl.debit_cents - jl.credit_cents end), 0)
    into net_income_cents
    from public.journal_lines jl
    join public.chart_of_accounts coa on coa.id = jl.account_id
    join public.journal_entries je on je.id = jl.entry_id and je.date <= p_as_of
    where coa.org_id = p_org_id and coa.type in ('income', 'expense');

  return query
    select coa.code, coa.name, coa.type,
      (case
        when coa.type = 'asset' then coalesce(sum(jl.debit_cents), 0) - coalesce(sum(jl.credit_cents), 0)
        else coalesce(sum(jl.credit_cents), 0) - coalesce(sum(jl.debit_cents), 0)
      end)::bigint
    from public.chart_of_accounts coa
    left join public.journal_lines jl on jl.account_id = coa.id
    left join public.journal_entries je on je.id = jl.entry_id and je.date <= p_as_of
    where coa.org_id = p_org_id and coa.active and coa.type in ('asset', 'liability', 'equity')
    group by coa.id, coa.code, coa.name, coa.type

    union all

    select '3990', 'Current period earnings', 'equity'::public.account_type, net_income_cents

    order by 3, 1;
end;
$$;

revoke execute on function public.report_balance_sheet(uuid, date) from public, anon;
grant execute on function public.report_balance_sheet(uuid, date) to authenticated, service_role;

-- Transaction-level detail for one account, with a running balance signed
-- to that account's natural side.
create function public.report_general_ledger(p_org_id uuid, p_account_id uuid, p_start date, p_end date)
returns table (entry_date date, memo text, debit_cents bigint, credit_cents bigint, running_balance_cents bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  acct_type public.account_type;
  opening_balance bigint;
begin
  perform public.require_financial_role(p_org_id);

  select type into acct_type from public.chart_of_accounts where id = p_account_id and org_id = p_org_id;
  if acct_type is null then
    raise exception 'Account % not found for org %', p_account_id, p_org_id;
  end if;

  select case
      when acct_type in ('asset', 'expense')
        then coalesce(sum(jl.debit_cents), 0) - coalesce(sum(jl.credit_cents), 0)
      else coalesce(sum(jl.credit_cents), 0) - coalesce(sum(jl.debit_cents), 0)
    end
    into opening_balance
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id and je.date < p_start
    where jl.account_id = p_account_id;

  return query
    with ledger_rows as (
      select jl.id, je.date, je.memo, jl.debit_cents, jl.credit_cents,
        case when acct_type in ('asset', 'expense') then jl.debit_cents - jl.credit_cents else jl.credit_cents - jl.debit_cents end as delta
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id
      where jl.account_id = p_account_id and je.date between p_start and p_end
    )
    select ledger_rows.date, ledger_rows.memo, ledger_rows.debit_cents, ledger_rows.credit_cents,
      (opening_balance + sum(ledger_rows.delta) over (order by ledger_rows.date, ledger_rows.id rows between unbounded preceding and current row))::bigint
    from ledger_rows
    order by ledger_rows.date, ledger_rows.id;
end;
$$;

revoke execute on function public.report_general_ledger(uuid, uuid, date, date) from public, anon;
grant execute on function public.report_general_ledger(uuid, uuid, date, date) to authenticated, service_role;
