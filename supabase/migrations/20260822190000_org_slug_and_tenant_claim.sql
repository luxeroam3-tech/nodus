-- Phase 6: portal auth support. organizations.slug gives the tenant portal
-- its URL (/portal/[orgSlug]); claim_tenant_record() lets a tenant who
-- signed up normally through Supabase Auth link themselves to the tenant
-- record their landlord already created, verified by phone match rather
-- than an open self-service claim (a tenant record with no phone match
-- can't be claimed by just anyone who guesses the org).

alter table public.organizations add column slug text;

create function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g'));
$$;

-- Backfill (table is empty in this environment, but keep the migration
-- correct for any future re-run against a populated one).
update public.organizations set slug = public.slugify(name) || '-' || substr(id::text, 1, 6) where slug is null;

alter table public.organizations alter column slug set not null;
create unique index organizations_slug_key on public.organizations(slug);

create or replace function public.create_organization(org_name text, org_type public.org_type default 'individual')
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org public.organizations;
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create an organization';
  end if;

  base_slug := public.slugify(org_name);
  if base_slug = '' then
    base_slug := 'org';
  end if;
  candidate_slug := base_slug;
  while exists (select 1 from public.organizations where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (name, type, slug)
  values (org_name, org_type, candidate_slug)
  returning * into new_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (new_org.id, auth.uid(), 'owner');

  perform public.seed_chart_of_accounts(new_org.id);

  return new_org;
end;
$$;

-- A tenant claims their own record: their auth.uid() gets linked to the
-- tenants row the landlord already created for them, provided the phone
-- number they supply matches what's on file. Doesn't touch RLS at all —
-- this is the one legitimate way a tenant ever acquires portal access to
-- an org they were never invited to as staff.
create function public.claim_tenant_record(p_org_slug text, p_phone text)
returns public.tenants
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id_found uuid;
  claimed public.tenants;
  normalized_phone text;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to claim a tenant record';
  end if;

  select id into org_id_found from public.organizations where slug = p_org_slug;
  if org_id_found is null then
    raise exception 'Organization not found';
  end if;

  -- Accept any of the common Kenyan phone spellings a tenant might type;
  -- compare on digits only so 0712345678 matches +254712345678 on file.
  normalized_phone := right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 9);

  update public.tenants
    set user_id = auth.uid()
    where org_id = org_id_found
      and user_id is null
      and right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9) = normalized_phone
      and normalized_phone <> ''
    returning * into claimed;

  if claimed.id is null then
    raise exception 'No unclaimed tenant record matches that phone number for this property';
  end if;

  return claimed;
end;
$$;

revoke execute on function public.slugify(text) from public, anon;
grant execute on function public.slugify(text) to authenticated, service_role;
revoke execute on function public.claim_tenant_record(text, text) from public, anon;
grant execute on function public.claim_tenant_record(text, text) to authenticated;

-- The portal login page needs to show the org's name before the tenant
-- signs in — a narrow SECURITY DEFINER lookup for that one public field,
-- not a blanket SELECT policy (which would leak every org's data to anon).
create function public.get_org_public_info(p_slug text)
returns table (id uuid, name text, slug text)
language sql
security definer
stable
set search_path = ''
as $$
  select id, name, slug from public.organizations where slug = p_slug;
$$;

revoke execute on function public.get_org_public_info(text) from public;
grant execute on function public.get_org_public_info(text) to anon, authenticated, service_role;
