grant select, insert, update, delete on
  public.chart_of_accounts,
  public.cost_centers,
  public.journal_entries,
  public.journal_lines,
  public.documents,
  public.bank_accounts,
  public.payments,
  public.bank_transactions
to authenticated;

grant select, insert, update, delete on
  public.chart_of_accounts,
  public.cost_centers,
  public.journal_entries,
  public.journal_lines,
  public.documents,
  public.bank_accounts,
  public.payments,
  public.bank_transactions
to service_role;

revoke all on
  public.chart_of_accounts,
  public.cost_centers,
  public.journal_entries,
  public.journal_lines,
  public.documents,
  public.bank_accounts,
  public.payments,
  public.bank_transactions
from anon;

notify pgrst, 'reload schema';
