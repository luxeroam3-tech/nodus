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
