import { NextRequest, NextResponse } from "next/server";
import { sendRentReminders } from "@nodus/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SMS every tenant with an open/partial rent invoice due within 3 days.
 * Trigger via a scheduled external caller (Vercel Cron / Supabase pg_cron)
 * with CRON_SECRET as a bearer token. Safe to call more than once a day —
 * dedupe is enforced in the DB (one reminder per document per calendar day).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendRentReminders(createAdminClient());
  return NextResponse.json(result);
}
