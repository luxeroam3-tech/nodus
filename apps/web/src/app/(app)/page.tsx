import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

const AVATAR_TONES = [
  { bg: "var(--danger-bg)", fg: "var(--danger-ink)" },
  { bg: "var(--warning-bg)", fg: "var(--warning-ink)" },
  { bg: "var(--accent-bg)", fg: "var(--accent-ink)" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
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
  const today = new Date();

  const [{ data: properties }, { data: units }, { data: openDocs }, { data: recentPayments }, { data: monthPayments }] = await Promise.all([
    supabase.from("properties").select("id, name").eq("org_id", orgId),
    supabase.from("units").select("id, property_id, status"),
    supabase
      .from("documents")
      .select("id, number, total_cents, paid_cents, credited_cents, tenant_id, unit_id, due_date, status, tenants(full_name), units(unit_number, properties(name))")
      .eq("org_id", orgId)
      .in("status", ["open", "partial"]),
    supabase.from("payments").select("id, amount_cents, reference, method, date, document_id").eq("org_id", orgId).order("date", { ascending: false }).limit(6),
    supabase.from("payments").select("amount_cents").eq("org_id", orgId).eq("direction", "in").gte("date", startOfMonthISO),
  ]);

  const propertyIds = new Set((properties ?? []).map((p) => p.id));
  const relevantUnits = (units ?? []).filter((u) => propertyIds.has(u.property_id));
  const occupied = relevantUnits.filter((u) => u.status === "occupied").length;
  const totalUnits = relevantUnits.length;
  const occupancyPct = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;

  const collectedThisMonth = (monthPayments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);

  const overdue = (openDocs ?? [])
    .map((d: any) => {
      const daysLate = d.due_date ? Math.floor((today.getTime() - new Date(d.due_date).getTime()) / 86_400_000) : -1;
      return { ...d, daysLate, balance: d.total_cents - d.paid_cents - d.credited_cents };
    })
    .filter((d) => d.daysLate > 0)
    .sort((a, b) => b.daysLate - a.daysLate)
    .slice(0, 5);

  const arrearsCents = (openDocs ?? []).reduce((sum, d) => sum + (d.total_cents - d.paid_cents - d.credited_cents), 0);

  const ringCircumference = 2 * Math.PI * 30;
  const ringOffset = ringCircumference * (1 - occupancyPct / 100);

  return (
    <div>
      <div className="page-header">
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0 }}>Overview</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>
            {(properties ?? []).length} propert{(properties ?? []).length === 1 ? "y" : "ies"} · {totalUnits} units
          </p>
        </div>
      </div>

      <div className="hero-grid">
        <div className="hero-card">
          <p className="hero-label">Collected this month</p>
          <p className="hero-value">{formatKES(collectedThisMonth)}</p>
          <Link href="/payments" className="hero-btn">
            View report
          </Link>
        </div>

        <div className="card ring-card" style={{ padding: "18px 20px" }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--surface-3)" strokeWidth="7" />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="var(--success)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <div>
            <p className="ring-value">{occupancyPct}% occupied</p>
            <p className="ring-caption">
              {occupied} of {totalUnits} units filled · {totalUnits - occupied} vacant
            </p>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: 16 }}>
        <StatCard label="Outstanding arrears" value={formatKES(arrearsCents)} tone={arrearsCents > 0 ? "danger" : undefined} />
        <StatCard label="Open invoices" value={String((openDocs ?? []).length)} />
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "16px 18px 12px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, margin: 0 }}>Needs attention</h3>
        </div>
        {overdue.length === 0 ? (
          <EmptyState label="Nothing overdue" hint="Every open invoice is still within its due date." />
        ) : (
          overdue.map((d: any, i) => {
            const tone = AVATAR_TONES[i % AVATAR_TONES.length];
            const name = d.tenants?.full_name ?? "Unknown tenant";
            return (
              <div key={d.id} className="attention-row">
                <div className="avatar-chip" style={{ background: tone.bg, color: tone.fg }}>
                  {initials(name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {d.units?.properties?.name} {d.units?.unit_number} · {d.daysLate} day{d.daysLate === 1 ? "" : "s"} late
                  </p>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--danger-ink)", flexShrink: 0 }}>{formatKES(d.balance)}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="content-grid">
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
