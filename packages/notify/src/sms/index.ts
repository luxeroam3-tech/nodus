import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptConfig } from "@nodus/mpesa";
import { sendViaAdvanta, type SmsResult } from "./advanta";

export type { SmsResult };

export interface SmsProviderConfig {
  provider: string;
  config: Record<string, string>;
}

/** Kenyan MSISDN → 2547XXXXXXXX / 2541XXXXXXXX. Returns null if not a valid KE mobile. */
export function normalizeKePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0")) n = "254" + n.slice(1);
  else if (n.startsWith("7") || n.startsWith("1")) n = "254" + n;
  if (!/^254(7|1)\d{8}$/.test(n)) return null;
  return n;
}

export async function getOrgSmsConfig(admin: SupabaseClient, orgId: string): Promise<SmsProviderConfig | null> {
  const { data: row } = await admin.from("sms_settings").select("*").eq("org_id", orgId).maybeSingle();
  if (!row || !row.enabled) return null;
  return { provider: row.provider, config: decryptConfig(row.config_json) };
}

export async function sendSms(cfg: SmsProviderConfig, to: string, message: string): Promise<SmsResult> {
  const phone = normalizeKePhone(to);
  if (!phone) return { ok: false, error: `Invalid Kenyan phone number: ${to}` };

  if (cfg.provider === "advanta") {
    return sendViaAdvanta(cfg.config, phone, message);
  }
  return { ok: false, error: `Unknown SMS provider: ${cfg.provider}` };
}
