import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";

const REPORT_GROUPS = [
  {
    group: "Performance",
    items: [
      { href: "/reports/pnl", title: "Profit & Loss", body: "Income minus expenses for a period — did you make money?" },
      { href: "/reports/aging", title: "Aged Receivables", body: "Unpaid rent invoices, bucketed by how late they are." },
    ],
  },
  {
    group: "Position",
    items: [{ href: "/reports/balance-sheet", title: "Balance Sheet", body: "What the org owns vs owes, as of a date." }],
  },
  {
    group: "Detailed & compliance",
    items: [
      { href: "/reports/trial-balance", title: "Trial Balance", body: "Every account's balance — for your accountant." },
      { href: "/reports/general-ledger", title: "General Ledger", body: "Full transaction history for one account." },
      { href: "/reports/tax", title: "KRA Tax Reports", body: "Monthly Rental Income Tax and VAT output by period." },
    ],
  },
];

export default async function ReportsHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const [{ data: pnlRows }, { data: openDocs }] = await Promise.all([
    supabase.rpc("report_profit_and_loss", { p_org_id: orgId, p_start: startOfMonth, p_end: today }),
    supabase.from("documents").select("total_cents, paid_cents, credited_cents, type, status").eq("org_id", orgId).in("status", ["open", "partial"]),
  ]);

  const revenue = (pnlRows ?? []).filter((r) => r.account_type === "income").reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const expenses = (pnlRows ?? []).filter((r) => r.account_type === "expense").reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const netIncome = revenue - expenses;
  const receivables = (openDocs ?? []).filter((d) => d.type === "rent_invoice").reduce((s, d) => s + (d.total_cents - d.paid_cents - d.credited_cents), 0);
  const payables = (openDocs ?? []).filter((d) => d.type === "bill").reduce((s, d) => s + (d.total_cents - d.paid_cents - d.credited_cents), 0);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Financial overview and statements" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Revenue (MTD)" cents={revenue} />
        <StatCard label="Net income (MTD)" cents={netIncome} tone={netIncome >= 0 ? "good" : "bad"} />
        <StatCard label="Receivables" cents={receivables} />
        <StatCard label="Payables" cents={payables} />
      </div>

      {REPORT_GROUPS.map((g) => (
        <div key={g.group} className="mb-6">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-2.5 uppercase tracking-wide">{g.group}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.items.map((item) => (
              <Link key={item.href} href={item.href} className="card px-[18px] py-4 no-underline text-inherit hover:border-[var(--border-strong)] transition-colors">
                <p className="text-[14px] font-semibold m-0">{item.title}</p>
                <p className="text-[12.5px] text-[var(--text-muted)] mt-1">{item.body}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
