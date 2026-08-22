-- Phase 1: multi-tenancy foundation — organizations, staff roles, properties,
-- units, tenants, leases. Tenants are NOT org_memberships — they authenticate
-- separately and are linked via tenants.user_id, since a tenant is scoped to
-- exactly their own lease, never to org-wide staff permissions.

create extension if not exists "pgcrypto";

create type public.org_type as enum ('individual', 'agency');

-- Staff-side roles only. Caretaker has no financial-table access anywhere in
-- this schema by design — see docs/IMPLEMENTATION_PLAN.md roles table.
create type public.org_role as enum ('owner', 'manager', 'accountant', 'caretaker');

create type public.property_type as enum ('apartment', 'bedsitter', 'maisonette', 'bungalow', 'commercial', 'mixed_use');

create type public.unit_status as enum ('vacant', 'occupied', 'notice');

create type public.lease_status as enum ('active', 'ended', 'terminated');

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  type public.org_type not null default 'individual',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index idx_org_memberships_user on public.org_memberships(user_id);
create index idx_org_memberships_org on public.org_memberships(org_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type public.property_type not null default 'apartment',
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index idx_properties_org on public.properties(org_id);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_number text not null,
  status public.unit_status not null default 'vacant',
  bedrooms integer not null default 0 check (bedrooms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (property_id, unit_number)
);

create index idx_units_org on public.units(org_id);
create index idx_units_property on public.units(property_id);

create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- nullable: a tenant can exist before they ever log in (added by the
  -- landlord at move-in), and links to a real auth user once they sign up
  -- for the tenant portal.
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) > 0),
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index idx_tenants_org on public.tenants(org_id);
create index idx_tenants_user on public.tenants(user_id) where user_id is not null;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status public.lease_status not null default 'active',
  start_date date not null,
  end_date date,
  rent_amount_cents bigint not null check (rent_amount_cents > 0),
  deposit_amount_cents bigint not null default 0 check (deposit_amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (end_date is null or end_date >= start_date)
);

create index idx_leases_org on public.leases(org_id);
create index idx_leases_unit on public.leases(unit_id);
create index idx_leases_tenant on public.leases(tenant_id);

-- At most one active lease per unit at a time.
create unique index leases_one_active_per_unit
  on public.leases(unit_id)
  where status = 'active';

create trigger leases_set_updated_at
  before update on public.leases
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
