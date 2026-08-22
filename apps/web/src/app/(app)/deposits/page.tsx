import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, TableCard, Th, Td, Money, EmptyState } from "@/components/ui";

const STATUS_STYLE: Record<string, string> = {
  held: "bg-[var(--accent-bg)] text-[var(--accent-ink)]",
  partially_refunded: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  refunded: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  forfeited: "bg-[var(--danger-bg)] text-[var(--danger-ink)]",
};

const STATUS_LABEL: Record<string, string> = {
  held: "Held",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  forfeited: "Forfeited",
};

export default async function DepositsPage() {
  const supabase = await createClient();
  const { data: deposits } = await supabase
    .from("deposits")
    .select("id, amount_cents, method, collected_date, status, refunded_cents, forfeited_cents, refund_date, leases(id, tenant_id, tenants(id, full_name), units(unit_number, properties(name)))")
    .order("collected_date", { ascending: false });

  const rows = deposits ?? [];
  const totalHeld = rows.filter((d) => d.status === "held" || d.status === "partially_refunded").reduce((s, d) => s + (d.amount_cents - d.refunded_cents - d.forfeited_cents), 0);
  const totalRefunded = rows.reduce((s, d) => s + d.refunded_cents, 0);
  const totalForfeited = rows.reduce((s, d) => s + d.forfeited_cents, 0);
  const totalCollected = rows.reduce((s, d) => s + d.amount_cents, 0);

  return (
    <div>
      <PageHeader title="Deposits" subtitle="Security deposits collected, held, and settled at move-out." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total collected" cents={totalCollected} />
        <StatCard label="Currently held" cents={totalHeld} tone="neutral" />
        <StatCard label="Refunded to date" cents={totalRefunded} tone="good" />
        <StatCard label="Forfeited to date" cents={totalForfeited} tone="warn" />
      </div>

      {rows.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState title="No deposits recorded yet" body="Collect a tenant's security deposit from their tenant page once they move in." />
        </div>
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Tenant / unit</Th>
              <Th>Collected</Th>
              <Th right>Status</Th>
              <Th right>Held</Th>
              <Th right>Refunded</Th>
              <Th right>Forfeited</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d: any) => {
              const stillHeld = d.amount_cents - d.refunded_cents - d.forfeited_cents;
              return (
                <tr key={d.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="font-semibold">
                    {d.leases?.tenants?.id ? (
                      <Link href={`/tenants/${d.leases.tenants.id}`} className="hover:text-[var(--accent)]">
                        {d.leases?.tenants?.full_name}
                      </Link>
                    ) : (
                      d.leases?.tenants?.full_name
                    )}{" "}
                    <span className="text-[var(--text-muted)] font-normal">
                      · {d.leases?.units?.properties?.name} {d.leases?.units?.unit_number}
                    </span>
                  </Td>
                  <Td className="text-[var(--text-muted)]">
                    {d.collected_date} · <Money cents={d.amount_cents} /> · <span className="capitalize">{d.method}</span>
                  </Td>
                  <Td right>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  </Td>
                  <Td right className="font-semibold">
                    <Money cents={stillHeld} />
                  </Td>
                  <Td right>{d.refunded_cents ? <Money cents={d.refunded_cents} /> : "—"}</Td>
                  <Td right>{d.forfeited_cents ? <Money cents={d.forfeited_cents} /> : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
