-- Phase 1 RLS. Every helper is SECURITY DEFINER with a locked search_path so
-- policies can cross-reference org membership without ever reading a table
-- that itself carries a policy on the same query path (the recursion trap
-- from the earlier build). org_id is denormalized onto properties/units/
-- tenants/leases specifically so their policies never need to join back
-- through another RLS-protected table.

create function public.user_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select org_id from public.org_memberships where user_id = auth.uid();
$$;

create function public.user_org_ids_with_role(roles public.org_role[])
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select org_id from public.org_memberships
  where user_id = auth.uid() and role = any(roles);
$$;

-- Excludes caretaker: the financial-access line for everything money-related
-- (leases, and payments/documents from Phase 2 onward).
create function public.user_org_ids_financial()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select org_id from public.org_memberships
  where user_id = auth.uid() and role in ('owner', 'manager', 'accountant');
$$;

create function public.user_tenant_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id from public.tenants where user_id = auth.uid();
$$;

-- Atomic org + owner-membership creation. organizations has no direct INSERT
-- policy — this RPC is the only path in, so an org can never end up without
-- an owner.
create function public.create_organization(org_name text, org_type public.org_type default 'individual')
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

  return new_org;
end;
$$;

revoke execute on function public.user_org_ids() from public, anon;
revoke execute on function public.user_org_ids_with_role(public.org_role[]) from public, anon;
revoke execute on function public.user_org_ids_financial() from public, anon;
revoke execute on function public.user_tenant_ids() from public, anon;
revoke execute on function public.create_organization(text, public.org_type) from public, anon;
revoke execute on function public.set_updated_at() from public, anon;

grant execute on function public.user_org_ids() to authenticated, service_role;
grant execute on function public.user_org_ids_with_role(public.org_role[]) to authenticated, service_role;
grant execute on function public.user_org_ids_financial() to authenticated, service_role;
grant execute on function public.user_tenant_ids() to authenticated, service_role;
grant execute on function public.create_organization(text, public.org_type) to authenticated;

-- ---------- organizations ----------

create policy organizations_select on public.organizations
  for select to authenticated
  using (id in (select public.user_org_ids()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

-- No insert policy: public.create_organization() is the only way in.
-- No delete policy for v1.

-- ---------- org_memberships ----------

create policy org_memberships_select on public.org_memberships
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy org_memberships_insert on public.org_memberships
  for insert to authenticated
  with check (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

create policy org_memberships_update on public.org_memberships
  for update to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

create policy org_memberships_delete on public.org_memberships
  for delete to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner']::public.org_role[])));

-- Never let an org end up with zero owners — CASCADE from organizations
-- delete would recurse into this trigger for every row it removes, so bail
-- out immediately once the parent org itself is already gone.
create function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_owners integer;
begin
  if not exists (select 1 from public.organizations where id = old.org_id) then
    return coalesce(new, old);
  end if;

  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  select count(*) into remaining_owners
  from public.org_memberships
  where org_id = old.org_id and role = 'owner' and id <> old.id;

  if remaining_owners = 0 then
    raise exception 'Cannot remove the last owner of an organization';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.prevent_last_owner_removal() from public, anon, authenticated, service_role;

create trigger org_memberships_prevent_last_owner_removal
  before update or delete on public.org_memberships
  for each row execute function public.prevent_last_owner_removal();

-- ---------- properties ----------

create policy properties_select on public.properties
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy properties_write on public.properties
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])));

-- ---------- units ----------
-- No financial columns on this table — every org role, caretaker included,
-- gets full SELECT.

create policy units_select on public.units
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy units_write on public.units
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner', 'manager', 'caretaker']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner', 'manager', 'caretaker']::public.org_role[])));

-- ---------- tenants ----------
-- Contact details only (name/phone/email) — no financial columns, so
-- caretaker read access is fine (needed for maintenance workflows). A tenant
-- can also read their own record once user_id is linked.

create policy tenants_select_staff on public.tenants
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy tenants_select_self on public.tenants
  for select to authenticated
  using (user_id = auth.uid());

create policy tenants_write on public.tenants
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])));

-- ---------- leases ----------
-- Financial columns (rent/deposit) — caretaker is deliberately excluded.
-- A tenant may read their own lease only, never write it.

create policy leases_select_financial_staff on public.leases
  for select to authenticated
  using (org_id in (select public.user_org_ids_financial()));

create policy leases_select_self on public.leases
  for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));

create policy leases_write on public.leases
  for all to authenticated
  using (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])))
  with check (org_id in (select public.user_org_ids_with_role(array['owner', 'manager']::public.org_role[])));
