-- Closes the loop the tenant/landlord lifecycle was missing: nothing ever
-- ended a lease. leases.status could be 'ended'/'terminated' since Phase 1
-- but no code path ever set it, units never went back to 'vacant', and
-- move-out checklists were never triggered for a real user (only from
-- seed scripts). end_lease() does all three atomically.

create function public.end_lease(p_lease_id uuid, p_end_date date, p_status public.lease_status)
returns public.leases
language plpgsql
security definer
set search_path = ''
as $$
declare
  lease public.leases;
begin
  if p_status not in ('ended', 'terminated') then
    raise exception 'end_lease can only set status to ended or terminated, got %', p_status;
  end if;

  select * into lease from public.leases where id = p_lease_id;
  if lease.id is null then
    raise exception 'Lease % not found', p_lease_id;
  end if;

  if not exists (
    select 1 from public.org_memberships
    where org_id = lease.org_id and user_id = auth.uid() and role in ('owner', 'manager')
  ) then
    raise exception 'Not authorized for org %', lease.org_id;
  end if;

  if lease.status <> 'active' then
    raise exception 'Lease is not active — it has already been ended';
  end if;

  update public.leases set status = p_status, end_date = p_end_date where id = p_lease_id returning * into lease;
  update public.units set status = 'vacant' where id = lease.unit_id;

  if not exists (select 1 from public.move_checklists where lease_id = p_lease_id and type = 'move_out') then
    perform public.create_move_checklist(lease.org_id, p_lease_id, 'move_out');
  end if;

  return lease;
end;
$$;

revoke execute on function public.end_lease(uuid, date, public.lease_status) from public, anon;
grant execute on function public.end_lease(uuid, date, public.lease_status) to authenticated, service_role;

-- Tenant portal never had any visibility into their own deposit — the
-- deposits_select policy only covers org staff. Mirror the existing
-- user_tenant_document_ids() pattern so a tenant can see their own
-- deposit's status without seeing anyone else's.
create function public.user_tenant_deposit_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select d.id from public.deposits d
  join public.leases l on l.id = d.lease_id
  where l.tenant_id in (select public.user_tenant_ids());
$$;

revoke execute on function public.user_tenant_deposit_ids() from public, anon;
grant execute on function public.user_tenant_deposit_ids() to authenticated, service_role;

create policy deposits_select_self on public.deposits
  for select to authenticated
  using (id in (select public.user_tenant_deposit_ids()));
