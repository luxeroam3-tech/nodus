-- Explicit table grants. Tables created via the migration/API path do not
-- automatically pick up the default privileges PostgREST expects — without
-- this, every table here 404s from the API as "not found in schema cache"
-- even though it exists and RLS is correctly configured.

grant usage on schema public to authenticated, anon, service_role;

grant select, insert, update, delete on
  public.organizations,
  public.org_memberships,
  public.properties,
  public.units,
  public.tenants,
  public.leases
to authenticated;

grant select, insert, update, delete on
  public.organizations,
  public.org_memberships,
  public.properties,
  public.units,
  public.tenants,
  public.leases
to service_role;

revoke all on
  public.organizations,
  public.org_memberships,
  public.properties,
  public.units,
  public.tenants,
  public.leases
from anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  revoke all on tables from anon;

notify pgrst, 'reload schema';
