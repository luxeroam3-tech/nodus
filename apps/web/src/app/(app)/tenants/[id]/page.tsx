import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TableCard, Th, Td, Money, StatusPill, EmptyState } from "@/components/ui";
import { EditTenantHeader } from "./edit-tenant-header";
import { DepositCard } from "./deposit-card";
import { EndLeaseButton } from "./end-lease-button";
import { PortalAccessCard } from "./portal-access-card";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
  if (!tenant) notFound();

  const [{ data: leases }, { data: docs }, { data: maintenance }] = await Promise.all([
    supabase
      .from("leases")
      .select("id, status, start_date, end_date, rent_amount_cents, deposit_amount_cents, units(unit_number, properties(name))")
      .eq("tenant_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("documents")
      .select("id, number, status, issue_date, due_date, total_cents, paid_cents, credited_cents")
      .eq("tenant_id", id)
      .eq("type", "rent_invoice")
      .order("issue_date", { ascending: false }),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at, units(unit_number, properties(name))")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const leaseIds = (leases ?? []).map((l) => l.id);
  const docIds = (docs ?? []).map((d) => d.id);

  const [{ data: payments }, { data: checklists }, { data: deposits }] = await Promise.all([
    docIds.length
      ? supabase.from("payments").select("id, amount_cents, method, reference, date, document_id").in("document_id", docIds).order("date", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    leaseIds.length
      ? supabase.from("move_checklists").select("id, type, status, lease_id, move_checklist_items(id, checked)").in("lease_id", leaseIds)
      : Promise.resolve({ data: [] as any[] }),
    leaseIds.length ? supabase.from("deposits").select("*").in("lease_id", leaseIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const balanceCents = (docs ?? []).reduce((s, d) => s + (d.total_cents - d.paid_cents - d.credited_cents), 0);
  const docNumberById = new Map((docs ?? []).map((d) => [d.id, d.number]));
  const activeLease = (leases ?? []).find((l) => l.status === "active");
  // Deposit card tracks the most recent lease overall, not just an active
  // one — a lease that just ended still needs its deposit settled, and
  // that shouldn't vanish the moment "End lease" is clicked.
  const depositLease = activeLease ?? (leases ?? [])[0];
  const relevantDeposit = depositLease ? (deposits ?? []).find((d) => d.lease_id === depositLease.id) : undefined;

  return (
    <div>
      <EditTenantHeader tenant={{ id: tenant.id, full_name: tenant.full_name, phone: tenant.phone, email: tenant.email }} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
        <div className="card px-[18px] py-4">
          <p className="text-[12.5px] text-[var(--text-secondary)] font-medium">Outstanding balance</p>
          <p className={`[font-family:var(--font-display)] text-[22px] font-bold mt-1 ${balanceCents > 0 ? "text-[var(--danger-ink)]" : ""}`}>
            <Money cents={balanceCents} />
          </p>
        </div>
        <div className="card px-[18px] py-4">
          <p className="text-[12.5px] text-[var(--text-secondary)] font-medium">Portal</p>
          <p className="[font-family:var(--font-display)] text-[22px] font-bold mt-1">{tenant.user_id ? "Active" : "Not claimed"}</p>
        </div>
        <div className="card px-[18px] py-4">
          <p className="text-[12.5px] text-[var(--text-secondary)] font-medium">Current unit</p>
          <p className="[font-family:var(--font-display)] text-[16px] font-bold mt-1">
            {activeLease ? `${activeLease.units?.properties?.name} ${activeLease.units?.unit_number}` : "No active lease"}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <div className="px-[18px] pt-4 pb-3">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Leases</h3>
        </div>
        {(leases ?? []).length === 0 ? (
          <EmptyState title="No leases yet" body="This tenant isn't attached to a lease." />
        ) : (
          (leases ?? []).map((l: any) => (
            <div key={l.id} className="px-[18px] py-3 border-t border-[var(--border)]">
              <div className="flex justify-between items-center flex-wrap gap-2.5">
                <div>
                  <p className="text-[13.5px] font-semibold m-0">
                    {l.units?.properties?.name} {l.units?.unit_number}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                    <Money cents={l.rent_amount_cents} />
                    /mo · {l.start_date} {l.end_date ? `to ${l.end_date}` : "· ongoing"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={l.status} />
                  {l.status === "active" && <EndLeaseButton leaseId={l.id} tenantId={tenant.id} />}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="content-grid mb-4">
        <div>
          {(docs ?? []).length === 0 ? (
            <div className="card overflow-hidden">
              <div className="px-[18px] pt-4 pb-3">
                <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Rent invoices</h3>
              </div>
              <EmptyState title="No invoices yet" body="Nothing has been billed to this tenant." />
            </div>
          ) : (
            <TableCard>
              <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
                <tr>
                  <Th>Invoice</Th>
                  <Th>Due</Th>
                  <Th right>Status</Th>
                  <Th right>Balance</Th>
                </tr>
              </thead>
              <tbody>
                {(docs ?? []).map((d) => {
                  const balance = d.total_cents - d.paid_cents - d.credited_cents;
                  const overdue = !!d.due_date && new Date(d.due_date) < new Date() && balance > 0;
                  return (
                    <tr key={d.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                      <Td className="font-semibold">{d.number}</Td>
                      <Td className="text-[var(--text-muted)]">{d.due_date ?? "—"}</Td>
                      <Td right>
                        <StatusPill status={d.status} overdue={overdue} />
                      </Td>
                      <Td right className="font-semibold">
                        <Money cents={balance} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </div>

        <div>
          {(payments ?? []).length === 0 ? (
            <div className="card overflow-hidden">
              <div className="px-[18px] pt-4 pb-3">
                <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Payment history</h3>
              </div>
              <EmptyState title="No payments yet" body="Nothing has been paid by this tenant yet." />
            </div>
          ) : (
            <TableCard>
              <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
                <tr>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th right>Amount</Th>
                  <Th right>Receipt</Th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((p: any) => (
                  <tr key={p.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                    <Td className="text-[var(--text-muted)]">{docNumberById.get(p.document_id) ?? "—"}</Td>
                    <Td className="text-[var(--text-muted)]">{new Date(p.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</Td>
                    <Td right className="font-semibold">
                      <Money cents={p.amount_cents} />
                    </Td>
                    <Td right>
                      <a href={`/api/receipts/by-payment/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn no-underline text-[12px] px-2.5 py-1">
                        Receipt
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>

      <div className="content-grid">
        <div className="card overflow-hidden">
          <div className="px-[18px] pt-4 pb-3">
            <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Maintenance requests</h3>
          </div>
          {(maintenance ?? []).length === 0 ? (
            <EmptyState title="Nothing reported" body="This tenant hasn't raised any maintenance requests." />
          ) : (
            (maintenance ?? []).map((r: any) => (
              <div key={r.id} className="flex justify-between items-center px-[18px] py-3 border-t border-[var(--border)] gap-2.5">
                <div>
                  <p className="text-[13.5px] font-semibold m-0">{r.title}</p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                    {r.units?.properties?.name} {r.units?.unit_number} · {new Date(r.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize shrink-0 ${
                    r.status === "resolved" || r.status === "closed"
                      ? "bg-[var(--success-bg)] text-[var(--success-ink)]"
                      : r.priority === "urgent"
                        ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]"
                        : "bg-[var(--warning-bg)] text-[var(--warning-ink)]"
                  }`}
                >
                  {r.status === "in_progress" ? "In progress" : r.status}
                </span>
              </div>
            ))
          )}
        </div>

        {depositLease && (
          <DepositCard leaseId={depositLease.id} depositAmountCents={depositLease.deposit_amount_cents} deposit={relevantDeposit} />
        )}

        <PortalAccessCard tenantId={tenant.id} hasPortal={!!tenant.user_id} defaultEmail={tenant.email} />

        <div className="card overflow-hidden">
          <div className="px-[18px] pt-4 pb-3">
            <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Move checklists</h3>
          </div>
          {(checklists ?? []).length === 0 ? (
            <EmptyState title="No checklists" body="No move-in or move-out checklist has been started." />
          ) : (
            (checklists ?? []).map((c: any) => {
              const items = c.move_checklist_items ?? [];
              const checkedCount = items.filter((i: any) => i.checked).length;
              return (
                <div key={c.id} className="px-[18px] py-3 border-t border-[var(--border)]">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[13.5px] font-semibold m-0">{c.type === "move_in" ? "Move-in" : "Move-out"}</p>
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {checkedCount} / {items.length}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${items.length ? (checkedCount / items.length) * 100 : 0}%`,
                        background: c.status === "completed" ? "var(--success)" : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
