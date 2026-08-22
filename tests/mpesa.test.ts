import { describe, it, expect } from "vitest";
import { normalizeKenyanPhone, toE164 } from "../packages/mpesa/src/phone";
import { shortRef } from "../packages/mpesa/src/ref-format";
import { encryptConfig, decryptConfig } from "../packages/mpesa/src/crypto";

describe("normalizeKenyanPhone()", () => {
  it("normalizes 07... to 254...", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
  });

  it("normalizes 0712 345 678 with spaces", () => {
    expect(normalizeKenyanPhone("0712 345 678")).toBe("254712345678");
  });

  it("normalizes +254... to bare 254...", () => {
    expect(normalizeKenyanPhone("+254712345678")).toBe("254712345678");
  });

  it("normalizes bare 254...", () => {
    expect(normalizeKenyanPhone("254712345678")).toBe("254712345678");
  });

  it("normalizes 712345678 (no leading 0)", () => {
    expect(normalizeKenyanPhone("712345678")).toBe("254712345678");
  });

  it("accepts Airtel-range 01... numbers", () => {
    expect(normalizeKenyanPhone("0112345678")).toBe("254112345678");
  });

  it("rejects a non-Kenyan number", () => {
    expect(() => normalizeKenyanPhone("+14155552671")).toThrow(/valid Safaricom number/i);
  });

  it("rejects garbage input", () => {
    expect(() => normalizeKenyanPhone("not a phone")).toThrow(/valid Safaricom number/i);
  });

  it("toE164 adds the + prefix", () => {
    expect(toE164("0712345678")).toBe("+254712345678");
  });
});

describe("shortRef()", () => {
  it("takes the last 8 alphanumeric characters, uppercased", () => {
    expect(shortRef("sfh3kx92p1")).toBe("H3KX92P1");
  });

  it("strips punctuation before truncating", () => {
    expect(shortRef("ws_CO_191220191020363925")).toBe("20363925");
  });

  it("falls back to the raw ref if nothing alphanumeric survives", () => {
    expect(shortRef("---")).toBe("---");
  });
});

describe("encryptConfig() / decryptConfig()", () => {
  const key = Buffer.alloc(32, 7).toString("base64");

  it("round-trips a config object", () => {
    process.env.GATEWAY_CONFIG_KEY = key;
    const config = { consumerKey: "abc123", consumerSecret: "s3cr3t", shortcode: "174379" };
    const encrypted = encryptConfig(config);
    expect(encrypted).not.toContain("s3cr3t");
    expect(decryptConfig(encrypted)).toEqual(config);
  });

  it("returns an empty object for null input", () => {
    process.env.GATEWAY_CONFIG_KEY = key;
    expect(decryptConfig(null)).toEqual({});
  });

  it("fails closed on a tampered ciphertext (auth tag mismatch)", () => {
    process.env.GATEWAY_CONFIG_KEY = key;
    const encrypted = encryptConfig({ a: "b" });
    const [iv, tag, data] = encrypted.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");
    expect(() => decryptConfig(tampered)).toThrow();
  });
});
