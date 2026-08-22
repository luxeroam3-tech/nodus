import { createClient } from "@/lib/supabase/server";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase.from("tenants").select("id, full_name, phone, email, user_id").order("full_name");

  return (
    <div>
      <PageHeader title="Tenants" action={<PrimaryLink href="/tenants/new">Add tenant</PrimaryLink>} />

      {(tenants ?? []).length === 0 ? (
        <EmptyState title="No tenants yet" body="Add your first tenant to start tracking leases and payments." action={<PrimaryLink href="/tenants/new">Add tenant</PrimaryLink>} />
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th right>Portal</Th>
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((t) => (
              <tr key={t.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                <Td className="font-semibold">{t.full_name}</Td>
                <Td className="text-[var(--text-muted)]">{t.phone ?? t.email ?? "No contact on file"}</Td>
                <Td right>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.user_id ? "bg-[var(--success-bg)] text-[var(--success-ink)]" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>
                    {t.user_id ? "Portal active" : "Not yet claimed"}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
