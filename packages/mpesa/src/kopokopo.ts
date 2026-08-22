import crypto from "node:crypto";
import { PaymentGateway, GatewayOrgConfig, InboundResult, appBaseUrl } from "./gateway";
import { decryptConfig } from "./crypto";
import { normalizeKenyanPhone } from "./phone";

const SANDBOX_BASE = "https://sandbox.kopokopo.com";
const PROD_BASE = "https://api.kopokopo.com";

export function getKopoKopoGateway(orgConfig: GatewayOrgConfig): PaymentGateway {
  const config = decryptConfig(orgConfig.configJson);
  const baseUrl = orgConfig.environment === "production" ? PROD_BASE : SANDBOX_BASE;
  const clientId = config.clientId;
  const clientSecret = config.clientSecret;
  const tillNumber = config.tillNumber;

  async function getAccessToken(): Promise<string> {
    const res = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId ?? "", client_secret: clientSecret ?? "" }),
    });
    if (!res.ok) throw new Error("Failed to get KopoKopo access token");
    const data = await res.json();
    return data.access_token;
  }

  return {
    id: "kopokopo",

    async requestPayment(input) {
      const phone = normalizeKenyanPhone(input.phone);
      const token = await getAccessToken();
      const cbToken = orgConfig.webhookSecret ? `?token=${orgConfig.webhookSecret}` : "";

      const res = await fetch(`${baseUrl}/api/v1/incoming_payments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_channel: "M-PESA STK Push",
          till_number: tillNumber,
          subscriber: { phone_number: `+${phone}`, first_name: input.payerName ?? "Tenant", last_name: "" },
          amount: { currency: "KES", value: Math.ceil(input.amountCents / 100) },
          metadata: { accountRef: input.accountRef, description: input.description },
          _links: {
            callback_url: `${appBaseUrl()}/api/payments/webhook/kopokopo${cbToken}`,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`KopoKopo STK push failed: ${err}`);
      }

      // KopoKopo's initiation response carries the polling location in a
      // header, not the body — the real transaction id only arrives later
      // via webhook or checkIncomingPaymentStatus.
      const location = res.headers.get("Location");
      if (!location) throw new Error("KopoKopo STK push returned no Location header");
      const requestId = location.split("/").pop();
      if (!requestId) throw new Error(`Could not parse KopoKopo request id from Location: ${location}`);
      return { providerRef: requestId };
    },

    async checkIncomingPaymentStatus(requestId: string): Promise<InboundResult | null> {
      const token = await getAccessToken();
      const res = await fetch(`${baseUrl}/api/v1/incoming_payments/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const status = data?.data?.attributes?.status;
      if (status === "Success") {
        const attrs = data.data.attributes;
        return {
          providerRef: attrs.reference ?? requestId,
          amountCents: Math.round(Number(attrs.amount?.value ?? attrs.amount) * 100),
          payerPhone: attrs.sender_phone_number,
          requestRef: requestId,
          paidAt: new Date().toISOString(),
          raw: data,
        };
      }
      if (status === "Failed" || status === "Rejected") {
        return { failed: true, requestRef: requestId, raw: data };
      }
      return null; // still pending
    },

    async parseInbound(req: Request): Promise<InboundResult | null> {
      const url = new URL(req.url);
      const token = url.searchParams.get("token") ?? "";
      if (!orgConfig.webhookSecret || !timingSafeEqualStr(token, orgConfig.webhookSecret)) {
        throw new Error("Invalid KopoKopo webhook token");
      }

      const body = await req.json();
      const event = body?.topic;
      const resource = body?.event?.resource;
      if (!event?.startsWith("incoming_payment")) return null;

      const status = resource?.status;
      const requestId = resource?.reference; // KopoKopo echoes the original request reference here

      if (status === "Success") {
        return {
          providerRef: resource.reference ?? resource.id,
          amountCents: Math.round(Number(resource.amount?.value ?? resource.amount) * 100),
          payerPhone: resource.sender_phone_number,
          requestRef: requestId,
          paidAt: new Date().toISOString(),
          raw: body,
        };
      }
      if (status === "Failed" || status === "Rejected") {
        return { failed: true, requestRef: requestId, raw: body };
      }
      return null;
    },
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
