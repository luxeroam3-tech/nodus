-- Accounting RLS. journal_entries/journal_lines/payments carry no INSERT
-- policy for `authenticated` at all — every write goes through the
-- SECURITY DEFINER posting functions in the next migration, which validate
-- balance and role before touching a row. Direct table access is read-only
-- for financial staff, full stop.

create function public.user_tenant_document_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select d.id from public.documents d
  where d.tenant_id in (select public.user_tenant_ids());
$$;

revoke execute on function public.user_tenant_document_ids() from public, anon;
grant execute on function public.user_tenant_document_ids() to authenticated, service_role;

-- ---------- chart_of_accounts ----------

create policy chart_of_accounts_select on public.chart_of_accounts
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy chart_of_accounts_write on public.chart_of_accounts
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])) and system = false);

-- ---------- cost_centers ----------

create policy cost_centers_select on public.cost_centers
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

-- Insert/update come from the properties trigger (SECURITY DEFINER) or an
-- owner renaming one — no general write path for other roles.
create policy cost_centers_write on public.cost_centers
  for update to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

-- ---------- journal_entries / journal_lines ----------
-- Read-only from the client. Writes happen only inside post_entry() /
-- reverse_entry(), which run as SECURITY DEFINER and check the caller's
-- role themselves before inserting anything.

create policy journal_entries_select on public.journal_entries
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy journal_lines_select on public.journal_lines
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

-- ---------- documents ----------

create policy documents_select_staff on public.documents
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy documents_select_self on public.documents
  for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));

create policy documents_write on public.documents
  for all to authenticated
  using (org_id in (select public.user_org_ids_financial()))
  with check (org_id in (select public.user_org_ids_financial()));

-- ---------- bank_accounts ----------

create policy bank_accounts_select on public.bank_accounts
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy bank_accounts_write on public.bank_accounts
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])));

-- ---------- payments ----------
-- Read-only from the client — record_payment() is the only write path so
-- every payment always lands with a balanced journal entry behind it.

create policy payments_select_staff on public.payments
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy payments_select_self on public.payments
  for select to authenticated
  using (document_id in (select public.user_tenant_document_ids()));

-- ---------- bank_transactions ----------

create policy bank_transactions_select on public.bank_transactions
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy bank_transactions_write on public.bank_transactions
  for all to authenticated
  using (org_id in (select public.user_org_ids_financial()))
  with check (org_id in (select public.user_org_ids_financial()));
