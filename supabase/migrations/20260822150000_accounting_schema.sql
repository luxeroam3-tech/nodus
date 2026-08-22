-- Phase 2: full double-entry accounting core. cost_centers is 1:1 with
-- properties (auto-created by trigger), giving per-property P&L for free
-- out of the same general ledger every other report reads from.

create type public.account_type as enum ('asset', 'liability', 'equity', 'income', 'expense');

create type public.document_type as enum ('rent_invoice', 'credit_note', 'bill', 'expense');

create type public.document_status as enum ('open', 'partial', 'paid', 'void');

create type public.payment_method as enum ('mpesa', 'kopokopo', 'cash', 'bank_transfer', 'cheque');

create type public.payment_direction as enum ('in', 'out');

create type public.bank_account_kind as enum ('bank', 'mpesa', 'cash');

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  type public.account_type not null,
  subtype text,
  system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index idx_coa_org on public.chart_of_accounts(org_id);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_id)
);

create index idx_cost_centers_org on public.cost_centers(org_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  memo text not null default '',
  source_type text not null default 'manual',
  source_id uuid,
  reversed_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now()
);

create index idx_journal_entries_org on public.journal_entries(org_id);
create index idx_journal_entries_date on public.journal_entries(org_id, date);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id),
  cost_center_id uuid references public.cost_centers(id),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  check (debit_cents = 0 or credit_cents = 0),
  check (debit_cents > 0 or credit_cents > 0)
);

create index idx_journal_lines_entry on public.journal_lines(entry_id);
create index idx_journal_lines_org on public.journal_lines(org_id);
create index idx_journal_lines_account on public.journal_lines(account_id);

-- Every entry must balance. Deferred so a multi-row insert inside one
-- transaction (the normal case — post_entry() below) only checks once, at
-- commit, instead of failing on the first unbalanced intermediate row.
create function public.check_entry_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_entry uuid;
  total_debit bigint;
  total_credit bigint;
begin
  target_entry := coalesce(new.entry_id, old.entry_id);
  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0)
    into total_debit, total_credit
    from public.journal_lines where entry_id = target_entry;
  if total_debit <> total_credit then
    raise exception 'Journal entry % is not balanced: debits % <> credits %', target_entry, total_debit, total_credit;
  end if;
  return null;
end;
$$;

create constraint trigger journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.check_entry_balanced();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type public.document_type not null,
  number text not null,
  tenant_id uuid references public.tenants(id),
  unit_id uuid references public.units(id),
  cost_center_id uuid references public.cost_centers(id),
  status public.document_status not null default 'open',
  issue_date date not null default current_date,
  due_date date,
  total_cents bigint not null check (total_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  credited_cents bigint not null default 0 check (credited_cents >= 0),
  journal_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (org_id, number)
);

create index idx_documents_org on public.documents(org_id);
create index idx_documents_tenant on public.documents(tenant_id) where tenant_id is not null;

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind public.bank_account_kind not null default 'bank',
  account_id uuid references public.chart_of_accounts(id),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_bank_accounts_org on public.bank_accounts(org_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id),
  amount_cents bigint not null check (amount_cents > 0),
  method public.payment_method not null,
  reference text,
  date date not null default current_date,
  direction public.payment_direction not null default 'in',
  bank_account_id uuid references public.bank_accounts(id),
  journal_entry_id uuid references public.journal_entries(id),
  created_at timestamptz not null default now()
);

create index idx_payments_org on public.payments(org_id);
create index idx_payments_document on public.payments(document_id) where document_id is not null;

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id),
  date date not null,
  description text,
  amount_cents bigint not null,
  journal_entry_id uuid references public.journal_entries(id),
  external_ref text,
  reconciliation_id uuid,
  created_at timestamptz not null default now()
);

create index idx_bank_transactions_org on public.bank_transactions(org_id);
create index idx_bank_transactions_account on public.bank_transactions(bank_account_id);

-- A cost center per property, so per-property P&L falls out of the GL
-- without any extra reporting logic.
create function public.create_property_cost_center()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cost_centers (org_id, property_id, name)
  values (new.org_id, new.id, new.name);
  return new;
end;
$$;

revoke execute on function public.create_property_cost_center() from public, anon, authenticated, service_role;

create trigger properties_create_cost_center
  after insert on public.properties
  for each row execute function public.create_property_cost_center();

alter table public.chart_of_accounts enable row level security;
alter table public.cost_centers enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.documents enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.payments enable row level security;
alter table public.bank_transactions enable row level security;
