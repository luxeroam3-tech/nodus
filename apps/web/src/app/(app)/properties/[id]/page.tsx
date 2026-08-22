import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddUnitForm } from "./add-unit-form";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase.from("properties").select("id, name, address, type").eq("id", id).maybeSingle();
  if (!property) notFound();

  const { data: units } = await supabase.from("units").select("id, unit_number, status, bedrooms, is_commercial").eq("property_id", id).order("unit_number");

  return (
    <div>
      <p className="page-title" style={{ marginBottom: 4 }}>{property.name}</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 22px" }}>{property.address ?? property.type}</p>

      <div className="content-grid">
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Units</h3>
          </div>
          {(units ?? []).length === 0 ? (
            <div style={{ padding: "0 18px 18px", color: "var(--text-muted)", fontSize: 13 }}>No units yet — add one alongside.</div>
          ) : (
            (units ?? []).map((u) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 18px", borderTop: "0.5px solid var(--border)" }}>
                <div>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{u.unit_number}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                    {u.bedrooms} bed{u.bedrooms === 1 ? "" : "s"} {u.is_commercial ? "· commercial" : ""}
                  </span>
                </div>
                <span className={`pill ${u.status === "occupied" ? "success" : u.status === "notice" ? "warning" : "neutral"}`}>{u.status}</span>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Add a unit</h3>
          <AddUnitForm propertyId={property.id} />
        </div>
      </div>
    </div>
  );
}
