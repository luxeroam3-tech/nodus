import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, resolvePlanAccess } from "@/lib/billing";
import { StatCard, TableCard, Th, Td } from "@/components/ui";

export default async function AdminHomePage() {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: subs }, { data: units }] = await Promise.all([
    admin.from("organizations").select("id, name, created_at").order("created_at", { ascending: false }),
    admin.from("nodus_subscriptions").select("org_id, plan, paid_until"),
    admin.from("units").select("id, org_id"),
  ]);

  const subByOrg = new Map((subs ?? []).map((s) => [s.org_id, s]));
  const unitCountByOrg = new Map<string, number>();
  for (const u of units ?? []) unitCountByOrg.set(u.org_id, (unitCountByOrg.get(u.org_id) ?? 0) + 1);

  const rows = (orgs ?? []).map((o) => {
    const sub = subByOrg.get(o.id);
    const entitlements = resolvePlanAccess(sub?.plan ?? "free", sub?.paid_until ?? "9999-12-31");
    return { ...o, entitlements, units: unitCountByOrg.get(o.id) ?? 0 };
  });

  const now = new Date();
  const startOfWeek = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const signupsThisWeek = rows.filter((r) => r.created_at >= startOfWeek).length;
  const paidOrgs = rows.filter((r) => r.entitlements.plan !== "free").length;
  const mrr = rows.reduce((sum, r) => (r.entitlements.status === "active" ? sum + PLANS[r.entitlements.plan].monthlyCents : sum), 0);

  return (
    <div>
      <p className="[font-family:var(--font-display)] text-[20px] font-bold mb-4">Org health & funnel</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total orgs" value={String(rows.length)} />
        <StatCard label="Paid orgs" value={String(paidOrgs)} />
        <StatCard label="Signups this week" value={String(signupsThisWeek)} />
        <StatCard label="MRR (active)" cents={mrr} tone="good" />
      </div>

      <TableCard>
        <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
          <tr>
            <Th>Org</Th>
            <Th>Created</Th>
            <Th right>Units</Th>
            <Th right>Plan</Th>
            <Th right>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
              <Td className="font-semibold">{r.name}</Td>
              <Td className="text-[var(--text-muted)]">{new Date(r.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</Td>
              <Td right>{r.units}</Td>
              <Td right className="capitalize">
                {PLANS[r.entitlements.plan].name}
              </Td>
              <Td right>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                    r.entitlements.status === "active" ? "bg-[var(--success-bg)] text-[var(--success-ink)]" : "bg-[var(--danger-bg)] text-[var(--danger-ink)]"
                  }`}
                >
                  {r.entitlements.status}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
