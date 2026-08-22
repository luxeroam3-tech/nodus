import type { SupabaseClient } from "@supabase/supabase-js";
import { getGateway, type GatewayId } from "./gateway";

/**
 * Initiates an STK push against a document (rent invoice) and stages the
 * pending payment_events row the webhook will later claim. Must run
 * server-side with a service-role client — request_gateway_payment() is
 * locked to service_role.
 */
export async function requestGatewayPayment(
  admin: SupabaseClient,
  input: { orgId: string; gatewayId: GatewayId; documentId: string; phone: string; amountCents: number; accountRef: string; description: string; payerName?: string },
): Promise<{ providerRef: string }> {
  const { data: gatewayConfig, error: gatewayErr } = await admin
    .from("payment_gateways")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("gateway_id", input.gatewayId)
    .maybeSingle();
  if (gatewayErr || !gatewayConfig || !gatewayConfig.enabled) {
    throw new Error(`Gateway ${input.gatewayId} is not configured or enabled for this org`);
  }

  const gateway = getGateway({
    orgId: input.orgId,
    gatewayId: input.gatewayId,
    configJson: gatewayConfig.config_json,
    environment: gatewayConfig.environment,
    webhookSecret: gatewayConfig.webhook_secret,
  });

  const { providerRef } = await gateway.requestPayment({
    phone: input.phone,
    amountCents: input.amountCents,
    accountRef: input.accountRef,
    description: input.description,
    payerName: input.payerName,
  });

  const { error: stageErr } = await admin.rpc("request_gateway_payment", {
    p_org_id: input.orgId,
    p_gateway_id: input.gatewayId,
    p_provider_ref: providerRef,
    p_amount_cents: input.amountCents,
    p_account_ref: input.accountRef,
    p_matched_document_id: input.documentId,
  });
  if (stageErr) throw new Error(`Failed to stage payment event: ${stageErr.message}`);

  return { providerRef };
}
