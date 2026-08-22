import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daraja callback for a Nodus subscription STK push. Same shared-secret
 * pattern as the per-org gateway webhook (packages/mpesa/src/webhook.ts) —
 * Daraja has no payload signature, so the token embedded in the callback
 * URL at push time is what authenticates this request.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expected = process.env.NODUS_BILLING_WEBHOOK_SECRET ?? "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

  const body = await req.json();
  const stkCallback = body.Body?.stkCallback;
  if (!stkCallback) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const checkoutRequestId = stkCallback.CheckoutRequestID as string | undefined;
  if (!checkoutRequestId) return NextResponse.json({ received: true });

  if (stkCallback.ResultCode !== 0) {
    await admin.from("nodus_billing_payments").update({ status: "failed", failed_reason: stkCallback.ResultDesc ?? "Payment failed" }).eq("provider_ref", checkoutRequestId).eq("status", "pending");
    return NextResponse.json({ received: true });
  }

  const { data: payment } = await admin.from("nodus_billing_payments").select("id").eq("provider_ref", checkoutRequestId).maybeSingle();
  if (payment) {
    await admin.from("nodus_billing_payments").update({ status: "complete" }).eq("id", payment.id).eq("status", "pending");
    await admin.rpc("apply_nodus_billing_payment", { p_payment_id: payment.id });
  }

  return NextResponse.json({ received: true });
}
