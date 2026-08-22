-- Phase 7: caretaker's actual job — maintenance requests and move-in/
-- move-out checklists. Neither table carries a single financial column, so
-- (matching the units table precedent from Phase 1) every org role
-- including caretaker gets full read/write — the caretaker exclusion that
-- matters is from leases/documents/payments, not from operational work.

create type public.maintenance_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.maintenance_priority as enum ('normal', 'urgent');
create type public.checklist_type as enum ('move_in', 'move_out');
create type public.checklist_status as enum ('pending', 'completed');

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid references public.tenants(id),
  raised_by_user_id uuid references auth.users(id),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.maintenance_status not null default 'open',
  priority public.maintenance_priority not null default 'normal',
  assigned_to_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  resolved_at timestamptz
);

create index idx_maintenance_requests_org on public.maintenance_requests(org_id);
create index idx_maintenance_requests_unit on public.maintenance_requests(unit_id);
create index idx_maintenance_requests_tenant on public.maintenance_requests(tenant_id) where tenant_id is not null;

create trigger maintenance_requests_set_updated_at
  before update on public.maintenance_requests
  for each row execute function public.set_updated_at();

create table public.move_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  type public.checklist_type not null,
  status public.checklist_status not null default 'pending',
  completed_by_user_id uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_move_checklists_org on public.move_checklists(org_id);
create index idx_move_checklists_lease on public.move_checklists(lease_id);

create table public.move_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.move_checklists(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index idx_move_checklist_items_checklist on public.move_checklist_items(checklist_id);

alter table public.maintenance_requests enable row level security;
alter table public.move_checklists enable row level security;
alter table public.move_checklist_items enable row level security;

-- ---------- maintenance_requests ----------

create policy maintenance_requests_select_staff on public.maintenance_requests
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy maintenance_requests_select_self on public.maintenance_requests
  for select to authenticated
  using (tenant_id in (select public.user_tenant_ids()));

create policy maintenance_requests_insert_staff on public.maintenance_requests
  for insert to authenticated
  with check (org_id in (select public.user_org_ids()));

-- A tenant may raise a request for their own unit only — the unit their
-- active lease actually references, not any unit in the org.
create policy maintenance_requests_insert_self on public.maintenance_requests
  for insert to authenticated
  with check (
    tenant_id in (select public.user_tenant_ids())
    and unit_id in (select public.user_tenant_unit_ids())
  );

-- Status/assignment changes are a staff action — a tenant reporting an
-- issue doesn't get to mark it resolved themselves.
create policy maintenance_requests_update_staff on public.maintenance_requests
  for update to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- ---------- move_checklists / move_checklist_items ----------

create policy move_checklists_select_staff on public.move_checklists
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy move_checklists_select_self on public.move_checklists
  for select to authenticated
  using (lease_id in (select id from public.leases where tenant_id in (select public.user_tenant_ids())));

create policy move_checklists_write_staff on public.move_checklists
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

create policy move_checklist_items_select_staff on public.move_checklist_items
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy move_checklist_items_select_self on public.move_checklist_items
  for select to authenticated
  using (checklist_id in (
    select mc.id from public.move_checklists mc
    where mc.lease_id in (select id from public.leases where tenant_id in (select public.user_tenant_ids()))
  ));

create policy move_checklist_items_write_staff on public.move_checklist_items
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

grant select, insert, update, delete on
  public.maintenance_requests,
  public.move_checklists,
  public.move_checklist_items
to authenticated;

grant select, insert, update, delete on
  public.maintenance_requests,
  public.move_checklists,
  public.move_checklist_items
to service_role;

revoke all on
  public.maintenance_requests,
  public.move_checklists,
  public.move_checklist_items
from anon;

-- Seeds a checklist with the standard line items in one call, rather than
-- leaving every caretaker to freehand the same three items every time.
create function public.create_move_checklist(p_org_id uuid, p_lease_id uuid, p_type public.checklist_type)
returns public.move_checklists
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_checklist public.move_checklists;
begin
  if not exists (select 1 from public.org_memberships where org_id = p_org_id and user_id = auth.uid()) then
    raise exception 'Not authorized for org %', p_org_id;
  end if;

  insert into public.move_checklists (org_id, lease_id, type)
  values (p_org_id, p_lease_id, p_type)
  returning * into new_checklist;

  insert into public.move_checklist_items (checklist_id, org_id, label)
  values
    (new_checklist.id, p_org_id, 'Photos of all rooms'),
    (new_checklist.id, p_org_id, 'Meter readings recorded'),
    (new_checklist.id, p_org_id, case p_type when 'move_in' then 'Deposit receipt issued' else 'Deposit refund reconciled' end);

  return new_checklist;
end;
$$;

revoke execute on function public.create_move_checklist(uuid, uuid, public.checklist_type) from public, anon;
grant execute on function public.create_move_checklist(uuid, uuid, public.checklist_type) to authenticated, service_role;

-- Marks a checklist complete once every item is checked — called after the
-- last item flips to checked, not automatically, since the caretaker should
-- confirm the walkthrough is genuinely done rather than this firing on a
-- coincidental all-checked state mid-edit.
create function public.complete_move_checklist(p_checklist_id uuid)
returns public.move_checklists
language plpgsql
security definer
set search_path = ''
as $$
declare
  checklist public.move_checklists;
  incomplete_count integer;
begin
  select * into checklist from public.move_checklists where id = p_checklist_id;
  if checklist.id is null then
    raise exception 'Checklist % not found', p_checklist_id;
  end if;

  if not exists (select 1 from public.org_memberships where org_id = checklist.org_id and user_id = auth.uid()) then
    raise exception 'Not authorized for org %', checklist.org_id;
  end if;

  select count(*) into incomplete_count from public.move_checklist_items where checklist_id = p_checklist_id and checked = false;
  if incomplete_count > 0 then
    raise exception '% item(s) still unchecked', incomplete_count;
  end if;

  update public.move_checklists
    set status = 'completed', completed_by_user_id = auth.uid(), completed_at = now()
    where id = p_checklist_id
    returning * into checklist;

  return checklist;
end;
$$;

revoke execute on function public.complete_move_checklist(uuid) from public, anon;
grant execute on function public.complete_move_checklist(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
