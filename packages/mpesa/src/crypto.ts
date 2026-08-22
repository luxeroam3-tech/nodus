import crypto from "node:crypto";

/**
 * Gateway credentials (Daraja consumer secret, KopoKopo client secret, etc.)
 * are stored encrypted in payment_gateways.config_json — never in plaintext,
 * since that table is readable by every owner-role query in the org and
 * backed up wherever the database is backed up.
 *
 * AES-256-GCM, key from GATEWAY_CONFIG_KEY (32 raw bytes, base64-encoded).
 * Format: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext).
 */
function getKey(): Buffer {
  const raw = process.env.GATEWAY_CONFIG_KEY;
  if (!raw) throw new Error("GATEWAY_CONFIG_KEY is not set — cannot encrypt/decrypt gateway config");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("GATEWAY_CONFIG_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptConfig(config: Record<string, string>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(config), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptConfig(stored: string | null): Record<string, string> {
  if (!stored) return {};
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed gateway config ciphertext");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
