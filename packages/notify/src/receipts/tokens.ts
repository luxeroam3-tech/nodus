import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no 0/O/1/l/I

function generateToken(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** One stable token per payment — created on first request, reused after. */
export async function getOrCreateReceiptToken(admin: SupabaseClient, orgId: string, paymentId: string): Promise<string> {
  const { data: existing } = await admin
    .from("receipt_tokens")
    .select("token")
    .eq("payment_id", paymentId)
    .eq("org_id", orgId)
    .eq("revoked", false)
    .maybeSingle();
  if (existing) return existing.token;

  // Retry on the (astronomically rare) token collision; the partial unique
  // index on payment_id also makes concurrent calls converge on one row.
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateToken();
    const { data: row } = await admin
      .from("receipt_tokens")
      .insert({ org_id: orgId, payment_id: paymentId, token })
      .select("token")
      .maybeSingle();
    if (row) return row.token;

    const { data: raced } = await admin
      .from("receipt_tokens")
      .select("token")
      .eq("payment_id", paymentId)
      .eq("revoked", false)
      .maybeSingle();
    if (raced) return raced.token;
  }
  throw new Error("Failed to create receipt token");
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function receiptUrl(token: string): string {
  return `${appOrigin()}/r/${token}`;
}

/** Public lookup: full receipt payload for a valid token, else null. */
export async function getReceiptByToken(admin: SupabaseClient, token: string) {
  if (!/^[A-Za-z0-9]{8,32}$/.test(token)) return null;

  const { data: tok } = await admin.from("receipt_tokens").select("*").eq("token", token).eq("revoked", false).maybeSingle();
  if (!tok) return null;

  const { data: payment } = await admin.from("payments").select("*").eq("id", tok.payment_id).maybeSingle();
  if (!payment) return null;

  const { data: org } = await admin.from("organizations").select("*").eq("id", tok.org_id).maybeSingle();
  if (!org) return null;

  const doc = payment.document_id
    ? (await admin.from("documents").select("*").eq("id", payment.document_id).maybeSingle()).data
    : null;
  const tenant = doc?.tenant_id ? (await admin.from("tenants").select("*").eq("id", doc.tenant_id).maybeSingle()).data : null;

  return { org, payment, doc, tenant };
}
