import { createClient } from "@/lib/supabase/server";
import { IssueInvoiceButton } from "./issue-invoice-button";
import { PageHeader, PrimaryLink, TableCard, Th, Td, Money, StatusPill, EmptyState } from "@/components/ui";

export default async function LeasesPage() {
  const supabase = await createClient();
  const { data: leases } = await supabase
    .from("leases")
    .select("id, status, start_date, rent_amount_cents, next_invoice_date, units(unit_number, properties(name)), tenants(full_name)")
    .order("start_date", { ascending: false });

  return (
    <div>
      <PageHeader title="Leases" action={<PrimaryLink href="/leases/new">New lease</PrimaryLink>} />

      {(leases ?? []).length === 0 ? (
        <EmptyState title="No leases yet" body="Create a lease to start billing a tenant for a unit." action={<PrimaryLink href="/leases/new">New lease</PrimaryLink>} />
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Tenant / unit</Th>
              <Th right>Rent</Th>
              <Th>Next invoice</Th>
              <Th right>Status</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {(leases ?? []).map((l: any) => (
              <tr key={l.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                <Td className="font-semibold">
                  {l.tenants?.full_name} · {l.units?.properties?.name} {l.units?.unit_number}
                </Td>
                <Td right>
                  <Money cents={l.rent_amount_cents} />
                  <span className="text-[var(--text-muted)]">/mo</span>
                </Td>
                <Td className="text-[var(--text-muted)]">{l.next_invoice_date ?? "—"}</Td>
                <Td right>
                  <StatusPill status={l.status} />
                </Td>
                <Td right>{l.status === "active" && <IssueInvoiceButton leaseId={l.id} />}</Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
