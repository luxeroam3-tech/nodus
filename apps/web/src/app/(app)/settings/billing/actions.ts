"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey, type BillingCycle } from "@/lib/billing";
import { requestNodusSubscriptionStkPush } from "@/lib/nodus-mpesa";

async function currentOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) throw new Error("No organization");
  return { supabase, orgId: membership.org_id as string };
}

export async function initiateSubscriptionPayment(plan: PlanKey, cycle: BillingCycle, phone: string): Promise<{ paymentId?: string; error?: string }> {
  try {
    const { supabase, orgId } = await currentOrgId();
    if (plan === "free") return { error: "Pick a paid plan to upgrade" };
    const amountCents = cycle === "annual" ? PLANS[plan].annualCents : PLANS[plan].monthlyCents;

    const { data: row, error: insertError } = await supabase
      .from("nodus_billing_payments")
      .insert({ org_id: orgId, plan, cycle, amount_cents: amountCents, phone })
      .select()
      .single();
    if (insertError || !row) return { error: insertError?.message ?? "Could not start the payment" };
    const admin = createAdminClient();

    try {
      const { checkoutRequestId } = await requestNodusSubscriptionStkPush({
        phone,
        amountCents,
        paymentId: row.id,
        description: `Nodus ${PLANS[plan].name}`,
      });
      await admin.from("nodus_billing_payments").update({ provider_ref: checkoutRequestId }).eq("id", row.id);
    } catch (e) {
      await admin.from("nodus_billing_payments").update({ status: "failed", failed_reason: e instanceof Error ? e.message : "STK push failed" }).eq("id", row.id);
      return { error: e instanceof Error ? e.message : "Could not start the payment" };
    }

    return { paymentId: row.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start the payment" };
  }
}

export async function checkSubscriptionPayment(paymentId: string): Promise<{ status: "pending" | "complete" | "failed"; reason?: string }> {
  const { supabase } = await currentOrgId();
  const { data: payment } = await supabase.from("nodus_billing_payments").select("status, failed_reason").eq("id", paymentId).maybeSingle();
  if (!payment) return { status: "failed", reason: "Payment not found" };
  if (payment.status === "applied" || payment.status === "complete") {
    revalidatePath("/settings/billing");
    return { status: "complete" };
  }
  if (payment.status === "failed") return { status: "failed", reason: payment.failed_reason ?? "Payment failed" };
  return { status: "pending" };
}
