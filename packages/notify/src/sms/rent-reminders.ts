import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtKES } from "../money";
import { getOrgSmsConfig, sendSms } from "./index";

/**
 * SMS a reminder to every tenant with an open/partial rent invoice due
 * within `withinDays`. Dedupe is enforced in the DB (one 'rent_reminder'
 * sms_log row per document per calendar day) so this is safe to call more
 * than once a day from a cron.
 */
export async function sendRentReminders(
  admin: SupabaseClient,
  withinDays = 3,
): Promise<{ checked: number; sent: number; skipped: number; failed: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data: docs } = await admin
    .from("documents")
    .select("id, org_id, number, tenant_id, due_date, total_cents, paid_cents, credited_cents")
    .eq("type", "rent_invoice")
    .in("status", ["open", "partial"])
    .not("due_date", "is", null)
    .lte("due_date", cutoffDate);

  let sent = 0,
    skipped = 0,
    failed = 0;

  for (const doc of docs ?? []) {
    if (!doc.tenant_id) {
      skipped++;
      continue;
    }

    const cfg = await getOrgSmsConfig(admin, doc.org_id);
    if (!cfg) {
      skipped++;
      continue;
    }

    const { data: claimed } = await admin
      .from("sms_log")
      .insert({ org_id: doc.org_id, kind: "rent_reminder", document_id: doc.id, status: "sending" })
      .select("id")
      .maybeSingle();
    if (!claimed) {
      skipped++; // already reminded today
      continue;
    }

    const { data: tenant } = await admin.from("tenants").select("phone").eq("id", doc.tenant_id).maybeSingle();
    if (!tenant?.phone) {
      await admin.from("sms_log").update({ status: "failed", error: "No tenant phone on file" }).eq("id", claimed.id);
      failed++;
      continue;
    }

    const balance = doc.total_cents - doc.paid_cents - doc.credited_cents;
    const { data: org } = await admin.from("organizations").select("name").eq("id", doc.org_id).maybeSingle();
    const message =
      `Rent reminder: ${fmtKES(balance)} due ${doc.due_date} for Invoice ${doc.number}.` + (org?.name ? ` - ${org.name}` : "");

    const result = await sendSms(cfg, tenant.phone, message);
    await admin
      .from("sms_log")
      .update({
        phone: tenant.phone,
        message,
        status: result.ok ? "sent" : "failed",
        provider_ref: result.providerRef,
        error: result.error,
      })
      .eq("id", claimed.id);

    if (result.ok) sent++;
    else failed++;
  }

  return { checked: (docs ?? []).length, sent, skipped, failed };
}
