import { createClient } from "@/lib/supabase/server";
import { PageHeader, PrimaryLink, TableCard, Th, EmptyState } from "@/components/ui";
import { TenantRow } from "./tenant-row";

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
              <TenantRow key={t.id} tenant={t} />
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
