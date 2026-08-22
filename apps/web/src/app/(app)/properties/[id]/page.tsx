import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddUnitForm } from "./add-unit-form";
import { PageHeader, TableCard, Th, Td, EmptyState } from "@/components/ui";

const unitStatusStyles: Record<string, string> = {
  occupied: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  notice: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  vacant: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase.from("properties").select("id, name, address, type").eq("id", id).maybeSingle();
  if (!property) notFound();

  const { data: units } = await supabase.from("units").select("id, unit_number, status, bedrooms, is_commercial").eq("property_id", id).order("unit_number");

  return (
    <div>
      <PageHeader title={property.name} subtitle={property.address ?? property.type} />

      <div className="content-grid">
        {(units ?? []).length === 0 ? (
          <div className="card overflow-hidden">
            <div className="px-[18px] pt-4 pb-3">
              <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Units</h3>
            </div>
            <EmptyState title="No units yet" body="Add one alongside — units belong to this property." />
          </div>
        ) : (
          <TableCard>
            <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
              <tr>
                <Th>Unit</Th>
                <Th>Bedrooms</Th>
                <Th right>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(units ?? []).map((u) => (
                <tr key={u.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="font-semibold">{u.unit_number}</Td>
                  <Td className="text-[var(--text-muted)]">
                    {u.bedrooms} bed{u.bedrooms === 1 ? "" : "s"} {u.is_commercial ? "· commercial" : ""}
                  </Td>
                  <Td right>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${unitStatusStyles[u.status] ?? unitStatusStyles.vacant}`}>{u.status}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-3">Add a unit</h3>
          <AddUnitForm propertyId={property.id} />
        </div>
      </div>
    </div>
  );
}
