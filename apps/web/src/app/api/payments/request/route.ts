import { NextRequest, NextResponse } from "next/server";
import { requestGatewayPayment, type GatewayId } from "@nodus/mpesa";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Initiates an STK push for a rent invoice. Authorization is checked here
 * (not left to RLS) because this route uses the service-role client to
 * write payment_events — the caller must be either financial staff of the
 * invoice's org, or the tenant it's billed to, paying their own rent.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const documentId = body?.documentId as string | undefined;
  const gatewayId = body?.gatewayId as GatewayId | undefined;
  const phone = body?.phone as string | undefined;
  if (!documentId || !gatewayId || !phone) {
    return NextResponse.json({ error: "documentId, gatewayId, and phone are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userData.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  const userId = userData.user.id;

  const { data: doc, error: docErr } = await admin
    .from("documents")
    .select("id, org_id, number, total_cents, paid_cents, status, tenant_id")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr || !doc) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (doc.status === "paid" || doc.status === "void") {
    return NextResponse.json({ error: "This invoice is already settled" }, { status: 400 });
  }

  const [{ data: membership }, { data: tenant }] = await Promise.all([
    admin.from("org_memberships").select("role").eq("org_id", doc.org_id).eq("user_id", userId).maybeSingle(),
    admin.from("tenants").select("id, full_name").eq("id", doc.tenant_id ?? "").eq("user_id", userId).maybeSingle(),
  ]);

  const isFinancialStaff = membership && ["owner", "manager", "accountant"].includes(membership.role);
  const isOwnTenant = tenant?.id === doc.tenant_id;
  if (!isFinancialStaff && !isOwnTenant) {
    return NextResponse.json({ error: "Not authorized to pay this invoice" }, { status: 403 });
  }

  const balanceCents = doc.total_cents - doc.paid_cents;

  try {
    const { providerRef } = await requestGatewayPayment(admin, {
      orgId: doc.org_id,
      gatewayId,
      documentId: doc.id,
      phone,
      amountCents: balanceCents,
      accountRef: doc.number,
      description: `Rent ${doc.number}`,
      payerName: tenant?.full_name,
    });
    return NextResponse.json({ providerRef });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "STK push failed" }, { status: 502 });
  }
}
