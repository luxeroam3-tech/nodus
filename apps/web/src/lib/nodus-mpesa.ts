import "server-only";
import { normalizeKenyanPhone } from "@nodus/mpesa";

/**
 * STK push for Nodus's own subscription revenue — collected to Nodus's own
 * paybill via NODUS_MPESA_* env vars, not per-org payment_gateways (that
 * table holds a *landlord's* credentials for collecting from their own
 * tenants, a different party entirely).
 */

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PROD_BASE = "https://api.safaricom.co.ke";

function config() {
  const shortcode = process.env.NODUS_MPESA_SHORTCODE;
  const passkey = process.env.NODUS_MPESA_PASSKEY;
  const consumerKey = process.env.NODUS_MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.NODUS_MPESA_CONSUMER_SECRET;
  const environment = process.env.NODUS_MPESA_ENV === "production" ? "production" : "sandbox";
  if (!shortcode || !passkey || !consumerKey || !consumerSecret) {
    throw new Error("Nodus's own M-Pesa collection isn't configured yet (NODUS_MPESA_* env vars) — billing runs in simulator-only mode until then.");
  }
  return { shortcode, passkey, consumerKey, consumerSecret, baseUrl: environment === "production" ? PROD_BASE : SANDBOX_BASE };
}

async function getAccessToken(consumerKey: string, consumerSecret: string, baseUrl: string): Promise<string> {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error("Failed to get M-Pesa access token");
  const data = await res.json();
  return data.access_token;
}

export async function requestNodusSubscriptionStkPush(input: { phone: string; amountCents: number; paymentId: string; description: string }): Promise<{ checkoutRequestId: string }> {
  const { shortcode, passkey, consumerKey, consumerSecret, baseUrl } = config();
  const msisdn = normalizeKenyanPhone(input.phone);
  const token = await getAccessToken(consumerKey, consumerSecret, baseUrl);
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const webhookSecret = process.env.NODUS_BILLING_WEBHOOK_SECRET ?? "";
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

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
      CallBackURL: `${origin}/api/billing/webhook?token=${webhookSecret}`,
      AccountReference: input.paymentId.replace(/-/g, "").slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
  });

  if (!res.ok) throw new Error(`M-Pesa STK push failed: ${await res.text()}`);
  const data = await res.json();
  if (!data.CheckoutRequestID) throw new Error(`M-Pesa STK push returned no CheckoutRequestID: ${JSON.stringify(data)}`);
  return { checkoutRequestId: data.CheckoutRequestID };
}
