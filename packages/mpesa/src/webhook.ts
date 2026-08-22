import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGateway, isInboundFailure, type GatewayId } from "./gateway";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export type WebhookOutcome =
  | { kind: "rejected"; reason: string }
  | { kind: "ignored" }
  | { kind: "processed"; status: string; paymentId?: string };

/**
 * Shared webhook pipeline for both gateways. `admin` must be a service-role
 * Supabase client — every write here goes through apply_gateway_payment(),
 * which is itself locked to service_role only, so there is no path for an
 * authenticated user's session to reach this logic.
 */
export async function handleGatewayWebhook(req: Request, gatewayId: GatewayId, admin: SupabaseClient): Promise<WebhookOutcome> {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId) return { kind: "rejected", reason: "Missing orgId" };

  const { data: gatewayConfig } = await admin
    .from("payment_gateways")
    .select("*")
    .eq("org_id", orgId)
    .eq("gateway_id", gatewayId)
    .maybeSingle();

  if (!gatewayConfig || !gatewayConfig.enabled) {
    return { kind: "rejected", reason: "Gateway not configured or disabled" };
  }

  // Daraja has no payload signature — authenticate via the per-org secret
  // token embedded in the callback URL at push time.
  if (gatewayId === "mpesa_daraja") {
    const token = url.searchParams.get("token") ?? "";
    if (!gatewayConfig.webhook_secret || !timingSafeEqualStr(token, gatewayConfig.webhook_secret)) {
      return { kind: "rejected", reason: "Invalid webhook token" };
    }
  }

  // C2B validation ping: Safaricom asks permission before completing the
  // payment. Accept everything — the money event arrives separately via
  // the confirmation callback.
  if (url.searchParams.get("c2b") === "validation") {
    return { kind: "ignored" };
  }

  const gateway = getGateway({
    orgId,
    gatewayId,
    configJson: gatewayConfig.config_json,
    environment: gatewayConfig.environment,
    webhookSecret: gatewayConfig.webhook_secret,
  });

  let inbound;
  try {
    inbound = await gateway.parseInbound(req);
  } catch (e) {
    return { kind: "rejected", reason: e instanceof Error ? e.message : "Signature verification failed" };
  }

  if (!inbound) return { kind: "ignored" };

  if (isInboundFailure(inbound)) {
    await admin
      .from("payment_events")
      .update({ status: "failed", raw_json: inbound.raw })
      .eq("org_id", orgId)
      .eq("gateway_id", gatewayId)
      .eq("provider_ref", inbound.requestRef)
      .eq("status", "pending");
    return { kind: "processed", status: "failed" };
  }

  const { data: event, error } = await admin.rpc("apply_gateway_payment", {
    p_org_id: orgId,
    p_gateway_id: gatewayId,
    p_provider_ref: inbound.providerRef,
    p_request_ref: inbound.requestRef ?? null,
    p_amount_cents: inbound.amountCents,
    p_payer_phone: inbound.payerPhone ?? null,
    p_payer_name: inbound.payerName ?? null,
    p_account_ref: inbound.accountRef ?? null,
    p_raw: inbound.raw,
  });

  if (error) return { kind: "rejected", reason: error.message };
  return { kind: "processed", status: event?.status ?? "unknown", paymentId: event?.payment_id ?? undefined };
}

/**
 * Active backstop for KopoKopo STK pushes whose webhook confirmation never
 * arrives — confirmed in the earlier Zeno build that roughly a fifth of
 * KopoKopo deliveries never fire at all, so the webhook alone can't be the
 * only confirmation path. Polls every payment_events row still 'pending'
 * past the cutoff and resolves each one exactly like a real webhook would.
 */
export async function reconcileUnconfirmedKopoKopoPayments(
  admin: SupabaseClient,
  olderThanMinutes = 3,
): Promise<{ checked: number; confirmed: number; failed: number; stillPending: number; errors: number; confirmedPaymentIds: string[] }> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  const { data: rows } = await admin
    .from("payment_events")
    .select("*")
    .eq("gateway_id", "kopokopo")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  let confirmed = 0,
    failed = 0,
    stillPending = 0,
    errors = 0;
  const confirmedPaymentIds: string[] = [];

  for (const row of rows ?? []) {
    try {
      const { data: gatewayConfig } = await admin
        .from("payment_gateways")
        .select("*")
        .eq("org_id", row.org_id)
        .eq("gateway_id", "kopokopo")
        .maybeSingle();
      if (!gatewayConfig) {
        errors++;
        continue;
      }

      const gateway = getGateway({
        orgId: row.org_id,
        gatewayId: "kopokopo",
        configJson: gatewayConfig.config_json,
        environment: gatewayConfig.environment,
        webhookSecret: gatewayConfig.webhook_secret,
      });
      if (!gateway.checkIncomingPaymentStatus) {
        errors++;
        continue;
      }

      const result = await gateway.checkIncomingPaymentStatus(row.provider_ref);
      if (!result) {
        stillPending++;
        continue;
      }

      if (isInboundFailure(result)) {
        await admin.from("payment_events").update({ status: "failed", raw_json: result.raw }).eq("id", row.id).eq("status", "pending");
        failed++;
      } else {
        const { data: event } = await admin.rpc("apply_gateway_payment", {
          p_org_id: row.org_id,
          p_gateway_id: "kopokopo",
          p_provider_ref: result.providerRef,
          p_request_ref: result.requestRef ?? null,
          p_amount_cents: result.amountCents,
          p_payer_phone: result.payerPhone ?? null,
          p_payer_name: result.payerName ?? null,
          p_account_ref: result.accountRef ?? null,
          p_raw: result.raw,
        });
        if (event?.payment_id) confirmedPaymentIds.push(event.payment_id);
        confirmed++;
      }
    } catch {
      errors++;
    }
  }

  return { checked: (rows ?? []).length, confirmed, failed, stillPending, errors, confirmedPaymentIds };
}
