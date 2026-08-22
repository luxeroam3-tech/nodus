import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startOfMonthISO = startOfMonth.toISOString().slice(0, 10);

  const [{ data: properties }, { data: units }, { data: openDocs }, { data: recentPayments }, { data: monthPayments }] = await Promise.all([
    supabase.from("properties").select("id, name").eq("org_id", orgId),
    supabase.from("units").select("id, property_id, status"),
    supabase.from("documents").select("id, number, total_cents, paid_cents, tenant_id, due_date, status").eq("org_id", orgId).in("status", ["open", "partial"]),
    supabase.from("payments").select("id, amount_cents, reference, method, date, document_id").eq("org_id", orgId).order("date", { ascending: false }).limit(6),
    supabase.from("payments").select("amount_cents").eq("org_id", orgId).eq("direction", "in").gte("date", startOfMonthISO),
  ]);

  const propertyIds = new Set((properties ?? []).map((p) => p.id));
  const relevantUnits = (units ?? []).filter((u) => propertyIds.has(u.property_id));
  const occupied = relevantUnits.filter((u) => u.status === "occupied").length;
  const totalUnits = relevantUnits.length;

  const collectedThisMonth = (monthPayments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
  const arrearsCents = (openDocs ?? []).reduce((sum, d) => sum + (d.total_cents - d.paid_cents), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0 }}>Overview</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>
            {(properties ?? []).length} propert{(properties ?? []).length === 1 ? "y" : "ies"} · {totalUnits} units
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <StatCard label="Collected this month" value={formatKES(collectedThisMonth)} />
        <StatCard label="Outstanding arrears" value={formatKES(arrearsCents)} tone={arrearsCents > 0 ? "danger" : undefined} />
        <StatCard label="Occupancy" value={totalUnits > 0 ? `${Math.round((occupied / totalUnits) * 100)}%` : "—"} sub={`${occupied} of ${totalUnits} units`} />
        <StatCard label="Open invoices" value={String((openDocs ?? []).length)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Properties</h3>
          </div>
          {(properties ?? []).length === 0 ? (
            <EmptyState label="No properties yet" hint="Add your first property to get started." href="/properties" cta="Add a property" />
          ) : (
            (properties ?? []).map((p) => {
              const propUnits = relevantUnits.filter((u) => u.property_id === p.id);
              const propOccupied = propUnits.filter((u) => u.status === "occupied").length;
              const pct = propUnits.length > 0 ? Math.round((propOccupied / propUnits.length) * 100) : 0;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: "0.5px solid var(--border)" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, width: 140, flexShrink: 0, color: "var(--text-secondary)" }}>{p.name}</span>
                  <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 100 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 38, textAlign: "right" }}>{pct}%</span>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Recent payments</h3>
          </div>
          {(recentPayments ?? []).length === 0 ? (
            <EmptyState label="No payments yet" hint="Payments will show up here once rent starts coming in." />
          ) : (
            (recentPayments ?? []).map((p) => (
              <div key={p.id} style={{ padding: "11px 18px", borderTop: "0.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{formatKES(p.amount_cents)}</span>
                  <span className="pill success">{p.method}</span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "3px 0 0" }}>
                  Ref {p.reference} · {new Date(p.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 8px", fontWeight: 500 }}>{label}</p>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 23,
          fontWeight: 600,
          margin: 0,
          color: tone === "danger" ? "var(--danger-ink)" : "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>{sub}</p>}
    </div>
  );
}

function EmptyState({ label, hint, href, cta }: { label: string; hint: string; href?: string; cta?: string }) {
  return (
    <div style={{ padding: "28px 18px", textAlign: "center" }}>
      <p style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: href ? "0 0 14px" : 0 }}>{hint}</p>
      {href && cta && (
        <a href={href} className="btn btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
          {cta}
        </a>
      )}
    </div>
  );
}
