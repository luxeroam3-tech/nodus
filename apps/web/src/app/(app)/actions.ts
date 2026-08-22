"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReceiptSms, sendPaymentReceiptEmail } from "@nodus/notify";
import type { Database } from "@nodus/shared";
import type { AuthFormState } from "../(auth)/actions";

type PropertyType = Database["public"]["Enums"]["property_type"];
type MaintenancePriority = Database["public"]["Enums"]["maintenance_priority"];
type MaintenanceStatus = Database["public"]["Enums"]["maintenance_status"];

async function currentOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  return { supabase, orgId: membership.org_id as string };
}

export async function createProperty(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "apartment") as PropertyType;
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name) return { error: "Give the property a name" };

  const { error } = await supabase.from("properties").insert({ org_id: orgId, name, type, address });
  if (error) return { error: error.message };

  revalidatePath("/properties");
  redirect("/properties");
}

export async function createUnit(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitNumber = String(formData.get("unitNumber") ?? "").trim();
  const bedrooms = Number(formData.get("bedrooms") ?? 0);
  const isCommercial = formData.get("isCommercial") === "on";
  if (!unitNumber) return { error: "Give the unit a number or name" };

  const { PLANS, resolvePlanAccess } = await import("@/lib/billing");
  const [{ data: sub }, { count: unitCount }] = await Promise.all([
    supabase.from("nodus_subscriptions").select("plan, paid_until").eq("org_id", orgId).maybeSingle(),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  const entitlements = resolvePlanAccess(sub?.plan ?? "free", sub?.paid_until ?? "9999-12-31");
  if (entitlements.limits.units !== -1 && (unitCount ?? 0) >= entitlements.limits.units) {
    return { error: `You've reached the ${entitlements.limits.units}-unit limit on the ${PLANS[entitlements.plan].name} plan. Upgrade in Settings → Billing to add more.` };
  }

  const { error } = await supabase.from("units").insert({ org_id: orgId, property_id: propertyId, unit_number: unitNumber, bedrooms, is_commercial: isCommercial });
  if (error) return { error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return {};
}

export async function createTenant(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!fullName) return { error: "Give the tenant a name" };

  const { error } = await supabase.from("tenants").insert({ org_id: orgId, full_name: fullName, phone, email });
  if (error) return { error: error.message };

  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function createLease(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const unitId = String(formData.get("unitId") ?? "");
  const tenantId = String(formData.get("tenantId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const rentKes = Number(formData.get("rentKes") ?? 0);
  const depositKes = Number(formData.get("depositKes") ?? 0);
  if (!unitId || !tenantId || !startDate || !rentKes) return { error: "Fill in every field" };

  const { error } = await supabase.from("leases").insert({
    org_id: orgId,
    unit_id: unitId,
    tenant_id: tenantId,
    start_date: startDate,
    rent_amount_cents: Math.round(rentKes * 100),
    deposit_amount_cents: Math.round(depositKes * 100),
  });
  if (error) return { error: error.message };

  await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);

  revalidatePath("/leases");
  redirect("/leases");
}

export async function issueInvoiceNow(leaseId: string) {
  const { supabase, orgId } = await currentOrgId();
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const { error } = await supabase.rpc("issue_rent_invoice", { p_org_id: orgId, p_lease_id: leaseId, p_issue_date: today, p_due_date: dueDate });
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath("/leases");
}

export async function recordManualPayment(documentId: string, amountCents: number, reference: string) {
  const { supabase } = await currentOrgId();
  const { data: payment, error } = await supabase.rpc("record_payment", {
    p_document_id: documentId,
    p_amount_cents: amountCents,
    p_method: "cash",
    p_reference: reference || "Manual entry",
    p_date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/payments");

  if (payment?.id) {
    const admin = createAdminClient();
    await Promise.all([sendPaymentReceiptSms(admin, payment.id), sendPaymentReceiptEmail(admin, payment.id)]);
  }
}

export async function createMaintenanceRequest(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const unitId = String(formData.get("unitId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const priority = String(formData.get("priority") ?? "normal") as MaintenancePriority;
  if (!unitId || !title) return { error: "Pick a unit and describe the issue" };

  const { error } = await supabase.from("maintenance_requests").insert({ org_id: orgId, unit_id: unitId, title, description, priority });
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  redirect("/maintenance");
}

export async function updateMaintenanceStatus(requestId: string, status: MaintenanceStatus, assignToSelf: boolean) {
  const { supabase } = await currentOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patch: Database["public"]["Tables"]["maintenance_requests"]["Update"] = { status };
  if (status === "resolved" || status === "closed") patch.resolved_at = new Date().toISOString();
  if (assignToSelf && user) patch.assigned_to_user_id = user.id;

  const { error } = await supabase.from("maintenance_requests").update(patch).eq("id", requestId);
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
}

export async function updateOrgProfile(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const name = String(formData.get("name") ?? "").trim();
  const kraPin = String(formData.get("kraPin") ?? "").trim() || null;
  const vatRegistered = formData.get("vatRegistered") === "on";
  if (!name) return { error: "Organization name is required" };

  const { error } = await supabase.from("organizations").update({ name, kra_pin: kraPin, vat_registered: vatRegistered }).eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return undefined;
}

export async function updateSmsSettings(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const enabled = formData.get("enabled") === "on";
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const senderId = String(formData.get("senderId") ?? "").trim();

  const { encryptConfig } = await import("@nodus/mpesa");
  const hasNewCreds = apiKey && partnerId && senderId;

  const patch: Database["public"]["Tables"]["sms_settings"]["Insert"] = { org_id: orgId, enabled, provider: "advanta" };
  if (hasNewCreds) patch.config_json = encryptConfig({ apiKey, partnerId, senderId });

  const { error } = await supabase.from("sms_settings").upsert(patch, { onConflict: "org_id" });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return undefined;
}

export async function updatePaymentGateway(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const gatewayId = String(formData.get("gatewayId") ?? "") as "mpesa_daraja" | "kopokopo";
  const enabled = formData.get("enabled") === "on";
  const environment = String(formData.get("environment") ?? "sandbox") as "sandbox" | "production";

  const { encryptConfig } = await import("@nodus/mpesa");

  let config: Record<string, string> | null = null;
  if (gatewayId === "mpesa_daraja") {
    const shortcode = String(formData.get("shortcode") ?? "").trim();
    const passkey = String(formData.get("passkey") ?? "").trim();
    const consumerKey = String(formData.get("consumerKey") ?? "").trim();
    const consumerSecret = String(formData.get("consumerSecret") ?? "").trim();
    if (shortcode && passkey && consumerKey && consumerSecret) config = { shortcode, passkey, consumerKey, consumerSecret };
  } else {
    const clientId = String(formData.get("clientId") ?? "").trim();
    const clientSecret = String(formData.get("clientSecret") ?? "").trim();
    const tillNumber = String(formData.get("tillNumber") ?? "").trim();
    if (clientId && clientSecret && tillNumber) config = { clientId, clientSecret, tillNumber };
  }

  const { data: existing } = await supabase.from("payment_gateways").select("webhook_secret").eq("org_id", orgId).eq("gateway_id", gatewayId).maybeSingle();

  const crypto = await import("node:crypto");
  const webhookSecret = existing?.webhook_secret ?? crypto.randomBytes(24).toString("hex");

  const patch: Database["public"]["Tables"]["payment_gateways"]["Insert"] = {
    org_id: orgId,
    gateway_id: gatewayId,
    enabled,
    environment,
    webhook_secret: webhookSecret,
  };
  if (config) patch.config_json = encryptConfig(config);

  const { error } = await supabase.from("payment_gateways").upsert(patch, { onConflict: "org_id,gateway_id" });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return undefined;
}

/**
 * Registers the C2B confirmation/validation URLs with Safaricom so paybill
 * deposits with no prior STK push (a tenant paying manually via the M-Pesa
 * menu) actually reach the webhook — without this one-time registration,
 * only STK-pushed payments are ever confirmed. Daraja-only; KopoKopo tills
 * register their webhook in the KopoKopo dashboard instead.
 */
export async function registerMpesaC2b(): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const { data: gatewayConfig } = await supabase.from("payment_gateways").select("*").eq("org_id", orgId).eq("gateway_id", "mpesa_daraja").maybeSingle();
  if (!gatewayConfig || !gatewayConfig.enabled) return { error: "Enable and save M-Pesa Daraja first" };

  const { getGateway } = await import("@nodus/mpesa");
  const gateway = getGateway({
    orgId,
    gatewayId: "mpesa_daraja",
    configJson: gatewayConfig.config_json,
    environment: gatewayConfig.environment as "sandbox" | "production",
    webhookSecret: gatewayConfig.webhook_secret,
  });

  try {
    await gateway.registerC2b!();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "C2B registration failed" };
  }

  const { error } = await supabase.from("payment_gateways").update({ c2b_registered_at: new Date().toISOString() }).eq("org_id", orgId).eq("gateway_id", "mpesa_daraja");
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return undefined;
}

export async function recordExpense(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const date = String(formData.get("date") ?? "").trim();
  const vendorName = String(formData.get("vendorName") ?? "").trim();
  const expenseAccountCode = String(formData.get("expenseAccountCode") ?? "").trim();
  const amountKes = Number(formData.get("amountKes") ?? 0);
  const method = String(formData.get("method") ?? "cash") as Database["public"]["Enums"]["payment_method"];
  const paid = formData.get("paid") === "on";
  if (!date || !vendorName || !expenseAccountCode || !amountKes) return { error: "Fill in every field" };

  const { error } = await supabase.rpc("record_expense", {
    p_org_id: orgId,
    p_date: date,
    p_vendor_name: vendorName,
    p_expense_account_code: expenseAccountCode,
    p_amount_cents: Math.round(amountKes * 100),
    p_method: method,
    p_paid: paid,
  });
  if (error) return { error: error.message };

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function payBill(documentId: string, amountCents: number, reference: string) {
  const { supabase } = await currentOrgId();
  const { error } = await supabase.rpc("pay_bill", {
    p_document_id: documentId,
    p_amount_cents: amountCents,
    p_method: "cash",
    p_reference: reference || "Manual entry",
    p_date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function postJournalEntry(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const date = String(formData.get("date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const accountCodes = formData.getAll("accountCode") as string[];
  const debits = formData.getAll("debitKes") as string[];
  const credits = formData.getAll("creditKes") as string[];
  if (!date || !memo) return { error: "Date and memo are required" };

  const lines = accountCodes
    .map((code, i) => {
      const debitKes = Number(debits[i] ?? 0);
      const creditKes = Number(credits[i] ?? 0);
      return { account_code: code, debit_cents: Math.round(debitKes * 100), credit_cents: Math.round(creditKes * 100) };
    })
    .filter((l) => l.account_code && (l.debit_cents > 0 || l.credit_cents > 0));

  if (lines.length < 2) return { error: "A journal entry needs at least two lines" };

  const totalDebit = lines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDebit !== totalCredit) return { error: `Not balanced: debits ${totalDebit / 100} vs credits ${totalCredit / 100}` };

  const { error } = await supabase.rpc("post_entry", {
    p_org_id: orgId,
    p_date: date,
    p_memo: memo,
    p_source_type: "manual",
    p_source_id: null as unknown as string,
    p_lines: lines,
  });
  if (error) return { error: error.message };

  revalidatePath("/reports/general-ledger");
  redirect("/reports/general-ledger");
}

export async function createBankAccount(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "bank") as Database["public"]["Enums"]["bank_account_kind"];
  const accountId = String(formData.get("accountId") ?? "").trim() || null;
  if (!name) return { error: "Give the account a name" };

  const { error } = await supabase.from("bank_accounts").insert({ org_id: orgId, name, kind, account_id: accountId });
  if (error) return { error: error.message };

  revalidatePath("/banking");
  return undefined;
}

export async function createBankTransaction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase, orgId } = await currentOrgId();
  const bankAccountId = String(formData.get("bankAccountId") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountKes = Number(formData.get("amountKes") ?? 0);
  if (!bankAccountId || !date || !amountKes) return { error: "Fill in every field" };

  const { error } = await supabase
    .from("bank_transactions")
    .insert({ org_id: orgId, bank_account_id: bankAccountId, date, description, amount_cents: Math.round(amountKes * 100) });
  if (error) return { error: error.message };

  revalidatePath("/banking");
  return undefined;
}

export async function toggleBankTransactionReconciled(transactionId: string, reconciled: boolean) {
  const { supabase } = await currentOrgId();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ reconciliation_id: reconciled ? crypto.randomUUID() : null })
    .eq("id", transactionId);
  if (error) throw new Error(error.message);
  revalidatePath("/banking");
}

export async function updateTenant(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase } = await currentOrgId();
  const tenantId = String(formData.get("tenantId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!tenantId || !fullName) return { error: "Give the tenant a name" };

  const { error } = await supabase.from("tenants").update({ full_name: fullName, phone, email }).eq("id", tenantId);
  if (error) return { error: error.message };

  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath("/tenants");
  return undefined;
}

export async function collectDeposit(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase } = await currentOrgId();
  const leaseId = String(formData.get("leaseId") ?? "");
  const amountKes = Number(formData.get("amountKes") ?? 0);
  const method = String(formData.get("method") ?? "cash") as Database["public"]["Enums"]["payment_method"];
  const date = String(formData.get("date") ?? new Date().toISOString().slice(0, 10));
  if (!leaseId || !amountKes) return { error: "Fill in every field" };

  const { error } = await supabase.rpc("collect_deposit", {
    p_lease_id: leaseId,
    p_amount_cents: Math.round(amountKes * 100),
    p_method: method,
    p_date: date,
  });
  if (error) return { error: error.message };

  revalidatePath("/deposits");
  return undefined;
}

export async function refundDeposit(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase } = await currentOrgId();
  const depositId = String(formData.get("depositId") ?? "");
  const refundKes = Number(formData.get("refundKes") ?? 0);
  const forfeitKes = Number(formData.get("forfeitKes") ?? 0);
  const method = String(formData.get("method") ?? "cash") as Database["public"]["Enums"]["payment_method"];
  const date = String(formData.get("date") ?? new Date().toISOString().slice(0, 10));
  const notes = String(formData.get("notes") ?? "").trim();
  if (!depositId || (!refundKes && !forfeitKes)) return { error: "Enter a refund and/or forfeit amount" };

  const { error } = await supabase.rpc("refund_deposit", {
    p_deposit_id: depositId,
    p_refund_cents: Math.round(refundKes * 100),
    p_forfeit_cents: Math.round(forfeitKes * 100),
    p_method: method,
    p_date: date,
    p_notes: notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/deposits");
  return undefined;
}

export async function endLease(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { supabase } = await currentOrgId();
  const leaseId = String(formData.get("leaseId") ?? "");
  const tenantId = String(formData.get("tenantId") ?? "");
  const endDate = String(formData.get("endDate") ?? "").trim();
  const status = String(formData.get("status") ?? "ended") as Database["public"]["Enums"]["lease_status"];
  if (!leaseId || !endDate) return { error: "Pick an end date" };

  const { error } = await supabase.rpc("end_lease", { p_lease_id: leaseId, p_end_date: endDate, p_status: status });
  if (error) return { error: error.message };

  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath("/leases");
  revalidatePath("/properties");
  return undefined;
}
