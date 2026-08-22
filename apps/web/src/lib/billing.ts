export const PLANS = {
  free: {
    name: "Free",
    monthlyCents: 0,
    annualCents: 0,
    units: 5,
    sms: false,
    gateways: false,
  },
  standard: {
    name: "Standard",
    monthlyCents: 150000, // KES 1,500
    annualCents: 1440000, // KES 14,400 (20% off)
    units: 50,
    sms: true,
    gateways: true,
  },
  business: {
    name: "Business",
    monthlyCents: 350000, // KES 3,500
    annualCents: 3360000, // KES 33,600 (20% off)
    units: -1, // unlimited
    sms: true,
    gateways: true,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "active" | "expired";

export function normalizePlan(plan: string | null | undefined): PlanKey {
  return plan && plan in PLANS ? (plan as PlanKey) : "free";
}

export function subscriptionStatusForDate(paidUntil: string, today = new Date().toISOString().slice(0, 10)): SubscriptionStatus {
  return paidUntil < today ? "expired" : "active";
}

export interface Entitlements {
  plan: PlanKey;
  subscriptionPlan: PlanKey;
  status: SubscriptionStatus;
  isReadOnly: boolean;
  limits: (typeof PLANS)[PlanKey];
  paidUntil: string;
}

/** An expired paid plan falls back to free-tier limits until renewed — the
 *  org keeps its data, it just can't use what it stopped paying for. */
export function resolvePlanAccess(plan: string | null | undefined, paidUntil: string, today = new Date().toISOString().slice(0, 10)): Entitlements {
  const subscriptionPlan = normalizePlan(plan);
  const status = subscriptionStatusForDate(paidUntil, today);
  const planKey: PlanKey = status === "expired" ? "free" : subscriptionPlan;

  return {
    plan: planKey,
    subscriptionPlan,
    status,
    isReadOnly: false,
    limits: PLANS[planKey],
    paidUntil,
  };
}

export function fmtKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}
