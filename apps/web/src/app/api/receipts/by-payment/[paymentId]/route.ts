import { NextRequest, NextResponse } from "next/server";
import { getOrCreateReceiptToken } from "@nodus/notify";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves a payment id to its receipt link, creating the token on first
 * visit if it doesn't exist yet (payments recorded before the receipt
 * pipeline shipped, or ones where the best-effort send silently failed to
 * create it). Authorization goes through the caller's own session — RLS on
 * `payments` already restricts reads to financial roles in that org, so a
 * null result here means "not visible to you", not "doesn't exist".
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const supabase = await createClient();
  const { data: payment } = await supabase.from("payments").select("id, org_id").eq("id", paymentId).maybeSingle();
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const token = await getOrCreateReceiptToken(admin, payment.org_id, payment.id);
  return NextResponse.redirect(new URL(`/r/${token}`, _req.url));
}
