import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase.from("tenants").select("id, full_name, phone, email, user_id").order("full_name");

  return (
    <div>
      <div className="page-header">
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0 }}>Tenants</p>
        <Link href="/tenants/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          Add tenant
        </Link>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {(tenants ?? []).length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>No tenants yet.</div>
        ) : (
          (tenants ?? []).map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderTop: "0.5px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{t.full_name}</p>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>{t.phone ?? t.email ?? "No contact on file"}</p>
              </div>
              <span className={`pill ${t.user_id ? "success" : "neutral"}`}>{t.user_id ? "Portal active" : "Not yet claimed"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
