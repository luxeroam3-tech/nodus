import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PrimaryLink, StatCard, EmptyState, Money, fmtKES } from "@/components/ui";

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
      <PageHeader title="Overview" subtitle={`${(properties ?? []).length} propert${(properties ?? []).length === 1 ? "y" : "ies"} · ${totalUnits} units`} />

      <div className="hero-grid">
        <div className="hero-card">
          <p className="hero-label">Collected this month</p>
          <p className="hero-value">{fmtKES(collectedThisMonth)}</p>
          <Link href="/reports" className="hero-btn">
            View report
          </Link>
        </div>

        <div className="card ring-card px-5 py-[18px]">
          <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
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

      <div className="grid grid-cols-2 gap-3.5 mb-4">
        <StatCard label="Outstanding arrears" cents={arrearsCents} tone={arrearsCents > 0 ? "bad" : "neutral"} />
        <StatCard label="Open invoices" value={String((openDocs ?? []).length)} />
      </div>

      <div className="card overflow-hidden mb-4">
        <div className="px-[18px] pt-4 pb-3">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Needs attention</h3>
        </div>
        {overdue.length === 0 ? (
          <EmptyState title="Nothing overdue" body="Every open invoice is still within its due date." />
        ) : (
          overdue.map((d: any, i) => {
            const tone = AVATAR_TONES[i % AVATAR_TONES.length];
            const name = d.tenants?.full_name ?? "Unknown tenant";
            return (
              <div key={d.id} className="attention-row">
                <div className="avatar-chip" style={{ background: tone.bg, color: tone.fg }}>
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold m-0">{name}</p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                    {d.units?.properties?.name} {d.units?.unit_number} · {d.daysLate} day{d.daysLate === 1 ? "" : "s"} late
                  </p>
                </div>
                <span className="text-[13.5px] font-bold text-[var(--danger-ink)] shrink-0">
                  <Money cents={d.balance} />
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="content-grid">
        <div className="card overflow-hidden">
          <div className="px-[18px] pt-4 pb-3">
            <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Properties</h3>
          </div>
          {(properties ?? []).length === 0 ? (
            <EmptyState title="No properties yet" body="Add your first property to get started." action={<PrimaryLink href="/properties">Add a property</PrimaryLink>} />
          ) : (
            (properties ?? []).map((p) => {
              const propUnits = relevantUnits.filter((u) => u.property_id === p.id);
              const propOccupied = propUnits.filter((u) => u.status === "occupied").length;
              const pct = propUnits.length > 0 ? Math.round((propOccupied / propUnits.length) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-2.5 px-[18px] py-2.5 border-t border-[var(--border)]">
                  <span className="text-[12.5px] font-medium w-[140px] shrink-0 text-[var(--text-secondary)]">{p.name}</span>
                  <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[12px] text-[var(--text-secondary)] w-[38px] text-right">{pct}%</span>
                </div>
              );
            })
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-[18px] pt-4 pb-3">
            <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Recent payments</h3>
          </div>
          {(recentPayments ?? []).length === 0 ? (
            <EmptyState title="No payments yet" body="Payments will show up here once rent starts coming in." />
          ) : (
            (recentPayments ?? []).map((p) => (
              <div key={p.id} className="px-[18px] py-[11px] border-t border-[var(--border)]">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold">
                    <Money cents={p.amount_cents} />
                  </span>
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize bg-[var(--success-bg)] text-[var(--success-ink)]">{p.method}</span>
                </div>
                <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">
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
