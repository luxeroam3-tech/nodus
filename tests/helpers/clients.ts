import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget } from "./guard";

config({ path: ".env.test" });

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — run `pnpm db:env` first.",
  );
}

assertSafeTarget(url);

export const supabaseUrl = url;

/** Anon-key client — every isolation assertion must go through this, signed in as a real user. */
export function anonClient() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/** Service-role client — fixture setup/teardown only, never for isolation assertions. */
export const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
