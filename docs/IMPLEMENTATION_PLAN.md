# Nodus — Implementation Plan

Kenya-first, multi-tenant property management SaaS. Full double-entry
accounting in v1 (not deferred). Web-only, mobile-first responsive PWA —
no separate native app.

## Locked decisions

| Area | Decision |
|---|---|
| Frontend | Next.js 16.3+, Turbopack, single responsive PWA (manifest.json + install prompt), mobile-first |
| Backend | Supabase (Postgres + Auth + Storage + Realtime), RLS is the sole authorization boundary |
| Accounting | Full double-entry GL in v1, ported from the Zeno ERP codebase, not a simplified ledger |
| Payments | M-Pesa Daraja + KopoKopo, ported gateway/webhook layer from Zeno |
| Tax | eTIMS (KRA) simulator ported from Zeno, VAT/WHT reports |
| Monorepo | pnpm workspaces + Turborepo: `apps/web`, `packages/{accounting,mpesa,shared,ui}` |
| Source project | `/Users/ianlove/workspaces/zoho-books-clone copy/` ("Zeno ERP") — port target, read-only, never edited |

## Source-port map

Everything below is adapted from Zeno (Drizzle + Postgres) to Nodus
(Supabase-js + Postgres + RLS). Business logic and hard-won edge-case
handling carries over; the data-access layer is rewritten.

| Zeno source | Nodus target | Notes |
|---|---|---|
| `src/lib/coa.ts`, `chart-of-accounts.ts` | `packages/accounting/coa.ts` | Kenyan seed COA, system account codes |
| `src/lib/posting.ts` | `packages/accounting/posting.ts` | journal engine: postEntry/reverseEntry/mirrorBankTxn |
| `src/lib/reports.ts` + `app/(app)/reports/*` | `packages/accounting/reports/*` | trial balance, P&L, balance sheet, cash flow, GL, aging, debtors |
| `src/lib/tax.ts`, `etims.ts` | `packages/accounting/tax/*` | VAT/WHT calc, eTIMS OSCU/VSCU simulator |
| `src/lib/cost-centers.ts` | `packages/accounting/cost-centers.ts` | one cost center per property |
| `src/lib/recurring.ts` | `packages/core/recurring.ts` | pure date-math, port verbatim, drives monthly rent generation |
| `src/lib/payments/{gateway,mpesaDaraja,kopokopo,phone,ref-format,webhook,crypto}.ts` | `packages/mpesa/*` | port near-verbatim, strip COA calls that don't map yet until Phase 3 lands, then relink |
| `src/lib/expense-claims.ts`, `spend-approvals.ts` | `packages/accounting/expense-claims.ts` | caretaker-reported repair costs routed to owner/manager approval |
| `src/lib/payment-runs.ts` | `packages/accounting/payment-runs.ts` | vendor/contractor payouts |
| `src/lib/pdf/{PaymentReceiptPdf,StatementPdf,DocumentPdf}.tsx` | `packages/ui/pdf/*` | rent receipts, tenant/owner statements |
| `src/lib/sms/*` | `packages/core/sms/*` | rent reminders, payment confirmations |
| `src/lib/audit.ts`, `admin-audit.ts` | `packages/core/audit.ts` | every financial + role action logged |
| `src/app/portal/[orgSlug]/*`, `client-portal/auth.ts` | `apps/web/app/portal/[orgSlug]/*` | becomes the tenant portal skeleton |
| `src/lib/billing*.ts`, `admin/subscriptions`, `admin/funnel` | `packages/core/saas-billing/*` | Nodus's own subscription billing for landlords/agencies |
| `src/db/schema.ts` (`documents` table + type enum) | `supabase/migrations` | generic billable-document model — add `rent_invoice` as a document type instead of a parallel table |

**Explicitly not ported:** `inventory.ts`, `items/*`, `warehouses.ts`,
`item-bom.ts` (retail stock, no equivalent), `payroll.ts` + `payroll/*`
(v2 candidate, not v1), `time-tracking.ts`, `leave-requests.ts`,
`leave-permissions.ts` (staff HR, out of scope).

## Roles (final)

- **Owner** — full access, all financials, can add a managing agency
- **Manager** (agency staff) — full operational + financial access, no billing/subscription control
- **Accountant** — financial access, no property/lease edit rights
- **Caretaker** — unit occupancy status, maintenance requests, move-in/move-out checklists. **Zero access to `payments`, `journal_entries`, `documents` financial columns, or any report.** No rent/deposit collection.
- **Tenant** — own lease, own payments/receipts, own maintenance requests, move-in/move-out checklist for own unit

Account creation flow: owner signs up first → operates solo, or invites a
managing agency via Settings → the agency's staff get org-scoped logins
with manager/caretaker/accountant roles.

## Phases

### Phase 0 — Scaffolding
- `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- `apps/web`: Next.js 16.3 (Turbopack), App Router
- `packages/{accounting,mpesa,shared,ui,core}` — empty package.json + tsconfig per package
- `manifest.json` + PWA install prompt, mobile-first Apple-inspired design tokens (from prior product spec)
- Supabase project (new/clean — already wiped), `.env.example`
- Vitest + isolation-test harness (`tests/helpers/guard.ts` allowlist pattern from before)
- Root scripts: `db:push`, `db:diff`, `db:types`, `db:env`, `test`, `verify`

### Phase 1 — Multi-tenancy + auth foundation
- `organizations` (individual | agency), `org_memberships` (role enum above)
- `properties`, `units`, `tenants`, `leases` — reuse prior schema shape
- `create_organization()` RPC (atomic org+owner, no direct insert policy)
- RLS: SECURITY DEFINER helper functions, `REVOKE ... FROM PUBLIC, anon` pattern, avoid cross-policy recursion (all lessons already learned last cycle)
- 15+ case isolation test suite before moving on, run through anon key as real users

### Phase 2 — Accounting core
- `chart_of_accounts` (Kenyan seed, system-account codes locked), `journal_entries`, `journal_lines`
- `documents` (generic billable: type ∈ {rent_invoice, credit_note, bill, quote, ...}), `payments`, `bank_accounts`, `bank_transactions`
- Posting engine ported: `postEntry`, `reverseEntry`, `mirrorBankTxn`
- `cost_centers` = properties (1:1), enables per-property P&L for free
- Reports: trial balance, P&L, balance sheet, cash flow, GL, aging/debtors
- RLS scoped by org, cost-center-level scoping for owner-visible-only-their-properties in agency accounts

### Phase 3 — Recurring rent engine
- Port `recurring.ts` date math verbatim
- Lease → recurring `rent_invoice` document generator (monthly default, matches `FREQUENCIES`)
- Cron: due-run generation, capped backfill (reuse `dueRuns()` cap=12 pattern)

### Phase 4 — Payments (M-Pesa + KopoKopo)
- `payment_gateways`, `payout_recipients`, `payment_events` tables (unique index on `gateway_id+provider_ref`)
- Port `gateway.ts`, `mpesaDaraja.ts`, `kopokopo.ts`, `phone.ts`, `ref-format.ts`, `crypto.ts`
- Port webhook idempotency pipeline (`webhook.ts`) — claim-then-apply, amount-mismatch guard, whole-shilling rounding absorption, KopoKopo poll-backstop cron (confirmed ~20% webhook loss rate in prod, active polling is mandatory)
- Wire into Phase 2's posting engine (rent payment → journal entry → AR clears)

### Phase 5 — KRA tax compliance
- Port `etims.ts` (simulator first, real OSCU/VSCU adapter later), `tax.ts`
- VAT/WHT reports (`reports/vat`, `vat3`, `wht`) for landlords who cross the KRA VAT threshold or are VAT-registered agencies
- Monthly Rental Income tax reporting (Kenya-specific landlord tax, separate from VAT)

### Phase 6 — Portals
- Tenant portal: lease, balance, payment history/receipts, pay via M-Pesa, raise maintenance requests, move-in/move-out checklist — port `portal/[orgSlug]` skeleton + `client-portal/auth.ts`
- Owner portal (agency-managed properties): read-only financials scoped to their own properties via cost-center RLS

### Phase 7 — Caretaker + maintenance module
- `maintenance_requests` (raised by tenant, actioned by caretaker/manager)
- `move_checklists` (line items + photos, feeds deposit-dispute resolution)
- Caretaker RLS: confirm zero access to any financial table/report at the policy level, not just UI-hidden

### Phase 8 — Notifications + documents
- Port SMS layer (rent reminders, payment confirmations, payout-failure alerts)
- Port PDF layer (rent receipts, tenant statements, owner statements)
- Email (Resend) for receipts/statements

### Phase 9 — Nodus's own SaaS billing
- Port `billing.ts`/`billing-apply.ts` pattern — Nodus subscribes landlords/agencies to its own pricing tiers
- Admin: org health, subscriptions, funnel (internal ops, not customer-facing)

### Phase 10 — Hardening + launch prep
- Full isolation test suite re-run (all roles × all tables)
- `get_advisors` security pass (function EXECUTE grants, RLS coverage)
- PWA installability check, mobile Lighthouse pass
- Service-role key rotation confirmed, secrets audit

## Open questions before Phase 0 starts

1. New Supabase project, or reuse the wiped `vkwhqweevqjsgdpcmizh`?
2. GitHub repo: reuse the wiped `luxeroam3-tech/nodus`, or a fresh repo/org?
3. Confirm eTIMS starts as simulator-only (no real KRA OSCU device/credentials yet) — matches the "no M-Pesa creds yet" pattern from before, build against a mock first.
