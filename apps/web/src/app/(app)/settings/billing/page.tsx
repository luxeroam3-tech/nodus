import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { PLANS, resolvePlanAccess, fmtKES } from "@/lib/billing";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const [{ data: sub }, { count: unitCount }] = await Promise.all([
    supabase.from("nodus_subscriptions").select("plan, paid_until").eq("org_id", membership.org_id).maybeSingle(),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("org_id", membership.org_id),
  ]);

  const entitlements = resolvePlanAccess(sub?.plan ?? "free", sub?.paid_until ?? "9999-12-31");

  return (
    <div>
      <PageHeader title="Billing & Subscription" subtitle="Manage your Nodus plan." />

      <div className="card px-[18px] py-4 mb-4">
        <p className="text-[12.5px] text-[var(--text-secondary)] font-medium">Current plan</p>
        <p className="[font-family:var(--font-display)] text-[22px] font-bold mt-1">{entitlements.limits.name}</p>
        <p className="text-[12.5px] text-[var(--text-muted)] mt-1">
          {entitlements.plan === "free"
            ? "Free plan — no expiry."
            : `${entitlements.status === "active" ? "Renews" : "Expired"} ${entitlements.paidUntil}`}
        </p>
        <p className="text-[12.5px] text-[var(--text-muted)] mt-1">
          {unitCount ?? 0} unit{unitCount === 1 ? "" : "s"} used{entitlements.limits.units !== -1 ? ` of ${entitlements.limits.units}` : ""}
        </p>
      </div>

      <BillingClient currentPlan={entitlements.plan} disabled={membership.role !== "owner"} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((key) => {
          const p = PLANS[key];
          return (
            <div key={key} className={`card px-[18px] py-4 ${entitlements.plan === key ? "border-[var(--accent)]" : ""}`}>
              <p className="text-[14px] font-semibold">{p.name}</p>
              <p className="[font-family:var(--font-display)] text-[20px] font-bold mt-1">{p.monthlyCents === 0 ? "Free" : `${fmtKES(p.monthlyCents)}/mo`}</p>
              <ul className="text-[12.5px] text-[var(--text-muted)] mt-3 space-y-1.5">
                <li>{p.units === -1 ? "Unlimited units" : `Up to ${p.units} units`}</li>
                <li>{p.sms ? "SMS notifications" : "No SMS"}</li>
                <li>{p.gateways ? "M-Pesa / KopoKopo gateways" : "No payment gateways"}</li>
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
