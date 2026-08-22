import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, TableCard, Th, Td, Money, StatCard, EmptyState } from "@/components/ui";

const BUCKETS = [
  { label: "Current", test: (d: number) => d <= 0 },
  { label: "1–30 days", test: (d: number) => d > 0 && d <= 30 },
  { label: "31–60 days", test: (d: number) => d > 30 && d <= 60 },
  { label: "61–90 days", test: (d: number) => d > 60 && d <= 90 },
  { label: "90+ days", test: (d: number) => d > 90 },
];

export default async function AgedReceivablesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const { data: docs } = await supabase
    .from("documents")
    .select("id, number, due_date, total_cents, paid_cents, credited_cents, tenants(full_name), units(unit_number, properties(name))")
    .eq("org_id", orgId)
    .eq("type", "rent_invoice")
    .in("status", ["open", "partial"])
    .order("due_date");

  const today = new Date();
  const rows = (docs ?? []).map((d: any) => {
    const daysLate = d.due_date ? Math.floor((today.getTime() - new Date(d.due_date).getTime()) / 86_400_000) : 0;
    return { ...d, daysLate, balance: d.total_cents - d.paid_cents - d.credited_cents };
  });

  const bucketTotals = BUCKETS.map((b) => ({ ...b, total: rows.filter((r) => b.test(r.daysLate)).reduce((s, r) => s + r.balance, 0) }));

  return (
    <div>
      <PageHeader title="Aged Receivables" subtitle="Unpaid rent invoices, bucketed by lateness" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {bucketTotals.map((b) => (
          <StatCard key={b.label} label={b.label} cents={b.total} tone={b.label === "Current" ? "neutral" : b.total > 0 ? "bad" : "neutral"} />
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState title="Nothing outstanding" body="Every rent invoice is fully paid." />
        </div>
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Tenant / unit</Th>
              <Th>Invoice</Th>
              <Th>Due</Th>
              <Th right>Days late</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                <Td className="font-semibold">
                  {r.tenants?.full_name} · {r.units?.properties?.name} {r.units?.unit_number}
                </Td>
                <Td className="text-[var(--text-muted)]">{r.number}</Td>
                <Td className="text-[var(--text-muted)]">{r.due_date}</Td>
                <Td right className={r.daysLate > 0 ? "text-[var(--danger-ink)] font-semibold" : ""}>
                  {r.daysLate > 0 ? r.daysLate : "—"}
                </Td>
                <Td right className="font-semibold">
                  <Money cents={r.balance} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
