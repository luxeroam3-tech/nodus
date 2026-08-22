import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0 }}>Properties</p>
        <Link href="/properties/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          Add property
        </Link>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {(properties ?? []).length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>No properties yet.</div>
        ) : (
          (properties ?? []).map((p) => {
            const propUnits = (units ?? []).filter((u) => u.property_id === p.id);
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderTop: "0.5px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{p.name}</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>{p.address ?? p.type}</p>
                </div>
                <span className="pill neutral">{propUnits.length} units</span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
