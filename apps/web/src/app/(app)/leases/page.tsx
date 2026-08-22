import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IssueInvoiceButton } from "./issue-invoice-button";

function formatKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export default async function LeasesPage() {
  const supabase = await createClient();
  const { data: leases } = await supabase
    .from("leases")
    .select("id, status, start_date, rent_amount_cents, next_invoice_date, units(unit_number, properties(name)), tenants(full_name)")
    .order("start_date", { ascending: false });

  return (
    <div>
      <div className="page-header">
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0 }}>Leases</p>
        <Link href="/leases/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          New lease
        </Link>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {(leases ?? []).length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>No leases yet.</div>
        ) : (
          (leases ?? []).map((l: any) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderTop: "0.5px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {l.tenants?.full_name} · {l.units?.properties?.name} {l.units?.unit_number}
                </p>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  {formatKES(l.rent_amount_cents)}/mo · next invoice {l.next_invoice_date ?? "—"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`pill ${l.status === "active" ? "success" : "neutral"}`}>{l.status}</span>
                {l.status === "active" && <IssueInvoiceButton leaseId={l.id} />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
