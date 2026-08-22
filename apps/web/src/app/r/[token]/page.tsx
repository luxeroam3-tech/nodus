import { notFound } from "next/navigation";
import { getReceiptByToken, fmtKES } from "@nodus/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const receipt = await getReceiptByToken(admin, token);
  if (!receipt) notFound();

  const { org, payment, doc, tenant } = receipt;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <div className="card" style={{ maxWidth: 460, width: "100%", padding: 28 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{org.name}</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: "4px 0 20px" }}>Payment Receipt</p>

        <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
          <Row label="Received from" value={tenant?.full_name ?? "—"} />
          <Row label="Amount" value={fmtKES(payment.amount_cents)} bold />
          <Row label="Date" value={payment.date} />
          <Row label="Method" value={payment.method} />
          <Row label="Reference" value={payment.reference ?? "—"} />
          {doc ? <Row label="Invoice" value={doc.number} /> : null}
        </div>

        <a
          href={`/api/receipts/${token}/pdf`}
          className="btn btn-primary"
          style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 24 }}
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingBottom: 8, borderBottom: "0.5px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, textTransform: label === "Method" ? "capitalize" : undefined }}>{value}</span>
    </div>
  );
}
