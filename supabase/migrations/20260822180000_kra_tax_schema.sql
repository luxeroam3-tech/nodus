-- Phase 5: KRA tax compliance. Two distinct Kenyan tax regimes apply to
-- rental property, and they don't overlap the same way for every landlord:
--
--  - Monthly Rental Income tax (MRI): a final withholding-style tax on
--    GROSS rent RECEIVED (cash basis) from residential units, currently
--    7.5% — no deductions, no VAT, no eTIMS invoice required for this one.
--  - VAT: only applies to COMMERCIAL unit rent, and only once the landlord
--    is VAT-registered (voluntary or past the turnover threshold) — 16% on
--    top of rent, and DOES require an eTIMS fiscal invoice.
--
-- Both can apply in the same portfolio (a mixed residential/commercial
-- building), which is why this is unit-level (is_commercial), not
-- property-level or org-level.

alter table public.organizations
  add column kra_pin text,
  add column vat_registered boolean not null default false;

alter table public.units
  add column is_commercial boolean not null default false;

alter table public.documents
  add column vat_cents bigint not null default 0 check (vat_cents >= 0),
  add column cu_invoice_number text,
  add column cu_serial text,
  add column qr_url text,
  add column fiscalized_at timestamptz;
