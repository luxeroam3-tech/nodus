import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PayButton } from "./pay-button";

function formatKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export default async function TenantPortalPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/portal/${orgSlug}/login`);

  const { data: tenant } = await supabase.from("tenants").select("id, full_name, phone").eq("user_id", user.id).maybeSingle();
  // The (portal) layout already guarantees a claimed tenant record before
  // rendering any page inside it — this is a belt-and-braces guard against
  // a stale render racing that check, not the primary gate.
  if (!tenant) redirect(`/portal/${orgSlug}/claim`);

  const { data: lease } = await supabase
    .from("leases")
    .select("id, rent_amount_cents, status, start_date, end_date, units(unit_number, properties(name))")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .maybeSingle();

  const [{ data: maintenanceRequests }, { data: checklists }] = await Promise.all([
    supabase.from("maintenance_requests").select("id, title, status, priority, created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(5),
    lease
      ? supabase.from("move_checklists").select("id, type, status, move_checklist_items(id, label, checked)").eq("lease_id", lease.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const { data: openDocs } = await supabase
    .from("documents")
    .select("id, number, total_cents, paid_cents, due_date")
    .eq("tenant_id", tenant.id)
    .in("status", ["open", "partial"])
    .order("due_date");

  const { data: paymentHistory } = await supabase.from("payments").select("id, amount_cents, method, reference, date").order("date", { ascending: false }).limit(10);

  const balanceCents = (openDocs ?? []).reduce((sum, d) => sum + (d.total_cents - d.paid_cents), 0);
  const nextDue = (openDocs ?? [])[0];
  // PostgREST returns a to-one join as an array when it can't statically
  // prove single-row cardinality from the FK alone — normalize either shape.
  const unitRaw = lease?.units as unknown;
  const unit = (Array.isArray(unitRaw) ? unitRaw[0] : unitRaw) as { unit_number: string; properties: { name: string } | { name: string }[] | null } | undefined;
  const propertyRaw = unit?.properties;
  const property = (Array.isArray(propertyRaw) ? propertyRaw[0] : propertyRaw) as { name: string } | undefined;

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 2px" }}>Hi, {tenant?.full_name?.split(" ")[0]}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 20px" }}>
        {unit ? `${property?.name} · ${unit.unit_number}` : "No active lease"}
      </p>

      <div
        className="card"
        style={{
          padding: "18px 20px",
          marginBottom: 16,
          background: balanceCents > 0 ? "linear-gradient(155deg, var(--accent), var(--accent-ink))" : "linear-gradient(155deg, var(--success), var(--success-ink))",
          color: "#fff",
          border: "none",
        }}
      >
        <p style={{ fontSize: 12, opacity: 0.85, margin: "0 0 6px" }}>Current balance</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 700, margin: "0 0 12px", fontVariantNumeric: "tabular-nums" }}>
          {formatKES(balanceCents)}
        </p>
        {balanceCents > 0 && nextDue ? (
          <PayButton orgSlug={orgSlug} documentId={nextDue.id} amountCents={balanceCents} defaultPhone={tenant?.phone ?? ""} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600 }}>Paid in full</span>
        )}
      </div>

      {lease && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 4px" }}>Monthly rent</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{formatKES(lease.rent_amount_cents)}</p>
        </div>
      )}

      <Link
        href={`/portal/${orgSlug}/maintenance/new`}
        className="card"
        style={{ display: "block", padding: "14px 18px", marginBottom: 16, textDecoration: "none", color: "inherit" }}
      >
        <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Report an issue</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>Leaking tap, broken lock, anything that needs fixing.</p>
      </Link>

      {(maintenanceRequests ?? []).length > 0 && (
        <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 18px 10px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, margin: 0 }}>Your requests</h3>
          </div>
          {(maintenanceRequests ?? []).map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", borderTop: "0.5px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{r.title}</p>
              <span className={`pill ${r.status === "resolved" || r.status === "closed" ? "success" : r.priority === "urgent" ? "danger" : "warning"}`}>
                {r.status === "in_progress" ? "In progress" : r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {(checklists ?? []).map((c: any) => {
        const items = c.move_checklist_items ?? [];
        const checkedCount = items.filter((i: any) => i.checked).length;
        return (
          <div key={c.id} className="card" style={{ padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{c.type === "move_in" ? "Move-in checklist" : "Move-out checklist"}</p>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {checkedCount} / {items.length}
              </span>
            </div>
            <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 100, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${items.length ? (checkedCount / items.length) * 100 : 0}%`,
                  background: c.status === "completed" ? "var(--success)" : "var(--accent)",
                  borderRadius: 100,
                }}
              />
            </div>
          </div>
        );
      })}

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 10px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, margin: 0 }}>Payment history</h3>
        </div>
        {(paymentHistory ?? []).length === 0 ? (
          <div style={{ padding: "0 18px 16px", color: "var(--text-muted)", fontSize: 13 }}>No payments yet.</div>
        ) : (
          (paymentHistory ?? []).map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", borderTop: "0.5px solid var(--border)" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{p.method}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "1px 0 0" }}>
                  {p.reference} · {new Date(p.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{formatKES(p.amount_cents)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
