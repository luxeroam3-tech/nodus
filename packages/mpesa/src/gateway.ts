export type GatewayId = "mpesa_daraja" | "kopokopo";

import { getMpesaDarajaGateway } from "./mpesaDaraja";
import { getKopoKopoGateway } from "./kopokopo";

export interface GatewayOrgConfig {
  orgId: string;
  gatewayId: GatewayId;
  configJson: string | null;
  environment: "sandbox" | "production";
  webhookSecret?: string | null;
}

export interface PaymentGateway {
  id: GatewayId;
  /** Prompt a customer's phone to pay (STK push / incoming payment). */
  requestPayment(input: {
    phone: string;
    amountCents: number;
    accountRef: string; // invoice number — echoed back in the callback
    description: string;
    payerName?: string;
  }): Promise<{ providerRef: string }>;
  /** Verify + normalize an inbound webhook/callback into a common shape.
   *  Throws on signature verification failure; returns null for
   *  unrecognized payloads. */
  parseInbound(req: Request): Promise<InboundResult | null>;
  /** Register C2B confirmation/validation URLs with the provider (Daraja paybill). */
  registerC2b?(): Promise<void>;
  /** Actively re-fetch an inbound payment's current status by its own
   *  request id — a backstop for when the webhook callback never arrives.
   *  Returns the same InboundResult shape parseInbound would have produced,
   *  or null if still in progress. */
  checkIncomingPaymentStatus?(requestId: string): Promise<InboundResult | null>;
}

export interface InboundPayment {
  providerRef: string; // idempotency key (M-Pesa receipt / KopoKopo id)
  amountCents: number;
  payerPhone?: string;
  payerName?: string;
  accountRef?: string; // what the customer typed (invoice number, if paybill)
  /** Provider ref of the originating request (e.g. Daraja CheckoutRequestID),
   *  used to reconcile against the pending event created at push time. */
  requestRef?: string;
  paidAt: string;
  raw: unknown; // full payload, stored for audit
}

/** A callback for a request that failed or was cancelled by the customer. */
export interface InboundFailure {
  failed: true;
  requestRef: string;
  raw: unknown;
}

export type InboundResult = InboundPayment | InboundFailure;

export function isInboundFailure(r: InboundResult): r is InboundFailure {
  return (r as InboundFailure).failed === true;
}

export function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set — cannot build gateway callback URLs");
  return url.replace(/\/$/, "");
}

export function getGateway(orgConfig: GatewayOrgConfig): PaymentGateway {
  if (orgConfig.gatewayId === "mpesa_daraja") {
    return getMpesaDarajaGateway(orgConfig);
  }
  if (orgConfig.gatewayId === "kopokopo") {
    return getKopoKopoGateway(orgConfig);
  }
  throw new Error(`Unknown gateway: ${orgConfig.gatewayId}`);
}
