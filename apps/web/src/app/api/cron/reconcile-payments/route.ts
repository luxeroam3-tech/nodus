import { NextRequest, NextResponse } from "next/server";
import { reconcileUnconfirmedKopoKopoPayments } from "@nodus/mpesa";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backstop for KopoKopo webhooks that never arrive (see reconcile*() in
 * @nodus/mpesa/webhook — a documented, confirmed-in-production gap, not a
 * hypothetical one). Trigger via a scheduled external caller (Vercel Cron,
 * or a Supabase pg_cron job hitting this URL) with CRON_SECRET as a bearer
 * token so it can't be invoked by anyone else.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcileUnconfirmedKopoKopoPayments(createAdminClient());
  return NextResponse.json(result);
}
