import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtKES } from "../money";
import { getOrCreateReceiptToken, receiptUrl } from "../receipts/tokens";
import { getOrgSmsConfig, sendSms } from "./index";

/**
 * SMS the tenant a receipt link after a payment is applied.
 * Idempotent: the partial unique index on sms_log(payment_id) where
 * kind='receipt' means a payment can only ever get one receipt SMS, even
 * across webhook retries.
 * Never throws — receipt delivery must not break payment recording.
 */
export async function sendPaymentReceiptSms(admin: SupabaseClient, paymentId: string): Promise<void> {
  try {
    const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (!payment || payment.direction !== "in") return;

    const cfg = await getOrgSmsConfig(admin, payment.org_id);
    if (!cfg) return; // SMS not enabled for this org

    // Claim the dedupe slot BEFORE sending (conflict = already sent/sending)
    const { data: claimed } = await admin
      .from("sms_log")
      .insert({ org_id: payment.org_id, kind: "receipt", payment_id: paymentId, status: "sending" })
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    let phone: string | null = null;
    if (payment.document_id) {
      const { data: doc } = await admin.from("documents").select("tenant_id").eq("id", payment.document_id).maybeSingle();
      if (doc?.tenant_id) {
        const { data: tenant } = await admin.from("tenants").select("phone").eq("id", doc.tenant_id).maybeSingle();
        phone = tenant?.phone ?? null;
      }
    }

    if (!phone) {
      await admin.from("sms_log").update({ status: "failed", error: "No tenant phone on file" }).eq("id", claimed.id);
      return;
    }

    const { data: org } = await admin.from("organizations").select("name").eq("id", payment.org_id).maybeSingle();

    const token = await getOrCreateReceiptToken(admin, payment.org_id, payment.id);
    const link = receiptUrl(token);
    const message = `${fmtKES(payment.amount_cents)} rent payment received. Receipt: ${link}` + (org?.name ? ` - ${org.name}` : "");

    const result = await sendSms(cfg, phone, message);

    await admin
      .from("sms_log")
      .update({
        phone,
        message,
        status: result.ok ? "sent" : "failed",
        provider_ref: result.providerRef,
        error: result.error,
      })
      .eq("id", claimed.id);

    if (!result.ok) console.error("Receipt SMS failed:", result.error);
  } catch (e) {
    console.error("sendPaymentReceiptSms error:", e);
  }
}
