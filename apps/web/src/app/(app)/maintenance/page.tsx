import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusControls } from "./status-controls";

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
      <div className="page-header">
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0 }}>Maintenance</p>
        <Link href="/maintenance/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          Report an issue
        </Link>
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "16px 18px 12px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Open</h3>
        </div>
        {open.length === 0 ? (
          <div style={{ padding: "0 18px 18px", color: "var(--text-muted)", fontSize: 13 }}>Nothing open.</div>
        ) : (
          open.map((r: any) => (
            <div key={r.id} style={{ padding: "13px 18px", borderTop: "0.5px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{r.title}</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {r.units?.properties?.name} {r.units?.unit_number}
                    {r.tenants?.full_name ? ` · ${r.tenants.full_name}` : ""}
                  </p>
                  {r.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "6px 0 0" }}>{r.description}</p>}
                </div>
                <span className={`pill ${r.priority === "urgent" ? "danger" : "neutral"}`}>{r.priority}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <StatusControls requestId={r.id} status={r.status} />
              </div>
            </div>
          ))
        )}
      </div>

      {closed.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Closed</h3>
          </div>
          {closed.map((r: any) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 18px", borderTop: "0.5px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{r.title}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  {r.units?.properties?.name} {r.units?.unit_number}
                </p>
              </div>
              <span className="pill success">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
