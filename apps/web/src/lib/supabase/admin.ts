import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@nodus/shared";

/**
 * Service-role client — bypasses RLS entirely. Only for server-side code
 * that has already verified authorization itself (webhooks authenticated by
 * gateway token, cron routes authenticated by CRON_SECRET). Never import
 * this into anything that runs in the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}
