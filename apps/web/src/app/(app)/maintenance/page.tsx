import { createClient } from "@/lib/supabase/server";
import { StatusControls } from "./status-controls";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, title, description, status, priority, created_at, units(unit_number, properties(name)), tenants(full_name)")
    .order("created_at", { ascending: false });

  const open = (requests ?? []).filter((r) => r.status === "open" || r.status === "in_progress");
  const closed = (requests ?? []).filter((r) => r.status === "resolved" || r.status === "closed");

  return (
    <div>
      <PageHeader title="Maintenance" action={<PrimaryLink href="/maintenance/new">Report an issue</PrimaryLink>} />

      <div className="card overflow-hidden mb-4">
        <div className="px-[18px] pt-4 pb-3">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Open</h3>
        </div>
        {open.length === 0 ? (
          <EmptyState title="Nothing open" body="Every reported issue has been resolved." />
        ) : (
          open.map((r: any) => (
            <div key={r.id} className="px-[18px] py-[13px] border-t border-[var(--border)]">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-[14px] font-semibold m-0">{r.title}</p>
                  <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5">
                    {r.units?.properties?.name} {r.units?.unit_number}
                    {r.tenants?.full_name ? ` · ${r.tenants.full_name}` : ""}
                  </p>
                  {r.description && <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">{r.description}</p>}
                </div>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${r.priority === "urgent" ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}
                >
                  {r.priority}
                </span>
              </div>
              <div className="mt-2.5">
                <StatusControls requestId={r.id} status={r.status} />
              </div>
            </div>
          ))
        )}
      </div>

      {closed.length > 0 && (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Issue</Th>
              <Th>Unit</Th>
              <Th right>Status</Th>
            </tr>
          </thead>
          <tbody>
            {closed.map((r: any) => (
              <tr key={r.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                <Td className="font-semibold">{r.title}</Td>
                <Td className="text-[var(--text-muted)]">
                  {r.units?.properties?.name} {r.units?.unit_number}
                </Td>
                <Td right>
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize bg-[var(--success-bg)] text-[var(--success-ink)]">{r.status}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
