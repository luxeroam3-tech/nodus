import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtKES } from "../money";
import { getOrCreateReceiptToken, receiptUrl } from "../receipts/tokens";
import { sendEmail } from "./resend";
import { PaymentReceipt } from "./templates/PaymentReceipt";

/** Emails the tenant a payment receipt if they have an email on file. Never throws. */
export async function sendPaymentReceiptEmail(admin: SupabaseClient, paymentId: string): Promise<void> {
  try {
    const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (!payment || !payment.document_id) return;

    const { data: doc } = await admin.from("documents").select("*").eq("id", payment.document_id).maybeSingle();
    if (!doc || !doc.tenant_id) return;

    const { data: tenant } = await admin.from("tenants").select("*").eq("id", doc.tenant_id).maybeSingle();
    if (!tenant || !tenant.email) return;

    const { data: org } = await admin.from("organizations").select("*").eq("id", payment.org_id).maybeSingle();

    const token = await getOrCreateReceiptToken(admin, payment.org_id, payment.id).catch((e) => {
      console.error("Receipt token failed:", e);
      return null;
    });

    await sendEmail({
      to: tenant.email,
      subject: `Payment receipt for ${doc.number} — ${org?.name ?? "Nodus"}`,
      react: PaymentReceipt({
        orgName: org?.name ?? "Your landlord",
        tenantName: tenant.full_name,
        amount: fmtKES(payment.amount_cents),
        invoiceNumber: doc.number,
        paymentMethod: payment.method,
        receiptNumber: `RCPT-${payment.id.slice(0, 8).toUpperCase()}`,
        reference: payment.reference,
        date: payment.date,
        receiptUrl: token ? receiptUrl(token) : undefined,
      }),
    });
  } catch (e) {
    console.error("sendPaymentReceiptEmail error:", e);
  }
}
