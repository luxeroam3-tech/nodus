import { PaymentGateway, GatewayOrgConfig, InboundResult, appBaseUrl } from "./gateway";
import { decryptConfig } from "./crypto";
import { normalizeKenyanPhone } from "./phone";

/**
 * Daraja validates AccountReference/TransactionDesc as alphanumeric and
 * rejects the payload (USSD_103) on punctuation — document numbers like
 * "RENT-202608-a1b2c3d4" would fail, so strip anything else before
 * truncating.
 */
function safeRef(raw: string, max: number): string {
  return (raw || "").replace(/[^A-Za-z0-9]/g, "").slice(0, max) || "PAYMENT";
}

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PROD_BASE = "https://api.safaricom.co.ke";

export function getMpesaDarajaGateway(orgConfig: GatewayOrgConfig): PaymentGateway {
  const config = decryptConfig(orgConfig.configJson);
  const baseUrl = orgConfig.environment === "production" ? PROD_BASE : SANDBOX_BASE;
  const shortcode = config.shortcode;
  const passkey = config.passkey;
  const consumerKey = config.consumerKey;
  const consumerSecret = config.consumerSecret;

  async function getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error("Failed to get M-Pesa access token");
    const data = await res.json();
    return data.access_token;
  }

  return {
    id: "mpesa_daraja",

    async requestPayment(input) {
      // Daraja needs a bare 2547XXXXXXXX MSISDN — it rejects 07…, +254… and
      // anything with spaces.
      const msisdn = normalizeKenyanPhone(input.phone);
      const token = await getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
      // Daraja has no webhook signature — a per-org random token in the
      // callback URL is what authenticates inbound callbacks.
      const cbToken = orgConfig.webhookSecret ? `&token=${orgConfig.webhookSecret}` : "";

      const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.ceil(input.amountCents / 100),
          PartyA: msisdn,
          PartyB: shortcode,
          PhoneNumber: msisdn,
          CallBackURL: `${appBaseUrl()}/api/payments/webhook/mpesa_daraja?orgId=${orgConfig.orgId}${cbToken}`,
          AccountReference: safeRef(input.accountRef, 12),
          TransactionDesc: input.description.slice(0, 13),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`M-Pesa STK push failed: ${err}`);
      }

      const data = await res.json();
      if (!data.CheckoutRequestID) {
        throw new Error(`M-Pesa STK push returned no CheckoutRequestID: ${JSON.stringify(data)}`);
      }
      return { providerRef: data.CheckoutRequestID };
    },

    async registerC2b() {
      const token = await getAccessToken();
      const cbToken = orgConfig.webhookSecret ? `?token=${orgConfig.webhookSecret}` : "";
      const res = await fetch(`${baseUrl}/mpesa/c2b/v2/registerurl`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ShortCode: shortcode,
          ResponseType: "Completed",
          ConfirmationURL: `${appBaseUrl()}/api/payments/webhook/mpesa_daraja?orgId=${orgConfig.orgId}${cbToken}`,
          ValidationURL: `${appBaseUrl()}/api/payments/webhook/mpesa_daraja?orgId=${orgConfig.orgId}&c2b=validation${cbToken ? "&" + cbToken.slice(1) : ""}`,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`M-Pesa C2B URL registration failed: ${err}`);
      }
    },

    async parseInbound(req: Request): Promise<InboundResult | null> {
      const body = await req.json();

      // C2B confirmation (paybill deposit, no prior STK push).
      if (body.TransID) {
        return {
          providerRef: body.TransID,
          amountCents: Math.round(Number(body.TransAmount) * 100),
          payerPhone: body.MSISDN,
          payerName: [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(" "),
          accountRef: body.BillRefNumber,
          paidAt: new Date().toISOString(),
          raw: body,
        };
      }

      // STK push result callback.
      const stkCallback = body.Body?.stkCallback;
      if (!stkCallback) return null;

      const checkoutRequestId = stkCallback.CheckoutRequestID;
      if (stkCallback.ResultCode !== 0) {
        return { failed: true, requestRef: checkoutRequestId, raw: body };
      }

      const items: Array<{ Name: string; Value?: string | number }> = stkCallback.CallbackMetadata?.Item ?? [];
      const get = (name: string) => items.find((i) => i.Name === name)?.Value;

      return {
        providerRef: String(get("MpesaReceiptNumber") ?? checkoutRequestId),
        amountCents: Math.round(Number(get("Amount")) * 100),
        payerPhone: get("PhoneNumber") ? String(get("PhoneNumber")) : undefined,
        requestRef: checkoutRequestId,
        paidAt: new Date().toISOString(),
        raw: body,
      };
    },
  };
}
