/**
 * Gateway provider refs are long UUIDs (KopoKopo) or verbose conversation
 * ids (Daraja) — unreadable on an SMS or a receipt. Compress to the last 8
 * alphanumeric characters, uppercased, as a short code a landlord can
 * actually read back or note down; still specific enough per payment to be
 * useful for a quick "does this match what I see" check.
 */
export function shortRef(providerRef: string): string {
  const alnum = (providerRef || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return alnum.slice(-8) || providerRef;
}
