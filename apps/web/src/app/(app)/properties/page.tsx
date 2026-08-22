import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: properties } = await supabase.from("properties").select("id, name, type, address").order("name");
  const { data: units } = await supabase.from("units").select("id, property_id, status");

  return (
    <div>
      <PageHeader title="Properties" action={<PrimaryLink href="/properties/new">Add property</PrimaryLink>} />

      {(properties ?? []).length === 0 ? (
        <EmptyState title="No properties yet" body="Add your first property to start tracking units and tenants." action={<PrimaryLink href="/properties/new">Add property</PrimaryLink>} />
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Name</Th>
              <Th>Type / address</Th>
              <Th right>Units</Th>
            </tr>
          </thead>
          <tbody>
            {(properties ?? []).map((p) => {
              const propUnits = (units ?? []).filter((u) => u.property_id === p.id);
              return (
                <tr key={p.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="font-semibold">
                    <Link href={`/properties/${p.id}`} className="hover:text-[var(--accent)]">
                      {p.name}
                    </Link>
                  </Td>
                  <Td className="text-[var(--text-muted)] capitalize">{p.address ?? p.type}</Td>
                  <Td right className="text-[var(--text-secondary)]">
                    {propUnits.length}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
