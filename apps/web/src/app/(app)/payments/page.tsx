import { createClient } from "@/lib/supabase/server";
import { RecordPaymentButton } from "./record-payment-button";

function formatKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export default async function PaymentsPage() {
  const supabase = await createClient();
  const [{ data: openDocs }, { data: payments }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, number, total_cents, paid_cents, due_date, tenants(full_name)")
      .in("status", ["open", "partial"])
      .order("due_date"),
    supabase.from("payments").select("id, amount_cents, method, reference, date, document_id, documents(number)").order("date", { ascending: false }).limit(20),
  ]);

  return (
    <div>
      <p className="page-title" style={{ marginBottom: 18 }}>Payments</p>

      <div style={{ display: "grid", gap: 16 }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Open invoices</h3>
          </div>
          {(openDocs ?? []).length === 0 ? (
            <div style={{ padding: "0 18px 18px", color: "var(--text-muted)", fontSize: 13 }}>Nothing outstanding.</div>
          ) : (
            (openDocs ?? []).map((d: any) => {
              const balance = d.total_cents - d.paid_cents;
              return (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "0.5px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>
                      {d.tenants?.full_name} · {d.number}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>Due {d.due_date} · {formatKES(balance)} outstanding</p>
                  </div>
                  <RecordPaymentButton documentId={d.id} amountCents={balance} />
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Recent payments</h3>
          </div>
          {(payments ?? []).length === 0 ? (
            <div style={{ padding: "0 18px 18px", color: "var(--text-muted)", fontSize: 13 }}>No payments recorded yet.</div>
          ) : (
            (payments ?? []).map((p: any) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 18px", borderTop: "0.5px solid var(--border)", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{formatKES(p.amount_cents)}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {p.documents?.number} · {p.reference} · {new Date(p.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="pill success">{p.method}</span>
                  <a href={`/api/receipts/by-payment/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 12, padding: "5px 10px", textDecoration: "none" }}>
                    Receipt
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
