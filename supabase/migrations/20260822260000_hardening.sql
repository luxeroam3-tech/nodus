-- Phase 10: hardening pass off get_advisors — missing FK indexes and one
-- RLS policy re-evaluating auth.uid() per row instead of once per query.

create index idx_bank_accounts_account on public.bank_accounts(account_id) where account_id is not null;
create index idx_bank_transactions_journal_entry on public.bank_transactions(journal_entry_id) where journal_entry_id is not null;
create index idx_documents_cost_center on public.documents(cost_center_id) where cost_center_id is not null;
create index idx_documents_journal_entry on public.documents(journal_entry_id) where journal_entry_id is not null;
create index idx_documents_unit on public.documents(unit_id) where unit_id is not null;
create index idx_journal_entries_reversed on public.journal_entries(reversed_entry_id) where reversed_entry_id is not null;
create index idx_journal_lines_cost_center on public.journal_lines(cost_center_id) where cost_center_id is not null;
create index idx_maintenance_requests_assigned_to on public.maintenance_requests(assigned_to_user_id) where assigned_to_user_id is not null;
create index idx_maintenance_requests_raised_by on public.maintenance_requests(raised_by_user_id) where raised_by_user_id is not null;
create index idx_move_checklist_items_org on public.move_checklist_items(org_id);
create index idx_move_checklists_completed_by on public.move_checklists(completed_by_user_id) where completed_by_user_id is not null;
create index idx_payment_events_matched_document on public.payment_events(matched_document_id) where matched_document_id is not null;
create index idx_payment_events_payment on public.payment_events(payment_id) where payment_id is not null;
create index idx_payments_bank_account on public.payments(bank_account_id) where bank_account_id is not null;
create index idx_payments_journal_entry on public.payments(journal_entry_id) where journal_entry_id is not null;

-- auth.uid() re-evaluated per row instead of once per query — wrap in a
-- scalar subquery so Postgres caches it (see get_advisors auth_rls_initplan).
drop policy tenants_select_self on public.tenants;
create policy tenants_select_self on public.tenants
  for select to authenticated
  using (user_id = (select auth.uid()));
