-- A tenant can read their own lease row (leases_select_self), but had no
-- grant at all on units or properties — PostgREST applies RLS to embedded
-- joins independently of the parent row's visibility, so `leases.units(...)`
-- silently came back null for a tenant instead of erroring, which is a much
-- easier bug to miss. Grant visibility scoped to exactly the unit/property
-- backing the tenant's own lease(s), nothing broader.

create function public.user_tenant_unit_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select unit_id from public.leases where tenant_id in (select public.user_tenant_ids());
$$;

create function public.user_tenant_property_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select u.property_id from public.units u where u.id in (select public.user_tenant_unit_ids());
$$;

revoke execute on function public.user_tenant_unit_ids() from public, anon;
grant execute on function public.user_tenant_unit_ids() to authenticated, service_role;
revoke execute on function public.user_tenant_property_ids() from public, anon;
grant execute on function public.user_tenant_property_ids() to authenticated, service_role;

create policy units_select_tenant on public.units
  for select to authenticated
  using (id in (select public.user_tenant_unit_ids()));

create policy properties_select_tenant on public.properties
  for select to authenticated
  using (id in (select public.user_tenant_property_ids()));
