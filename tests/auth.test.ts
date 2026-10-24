import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, isLegacyHash, verifyPassword } from "@/lib/auth";

describe("password hashing", () => {
  it("round-trips PBKDF2 hashes", async () => {
    const h = await hashPassword("hunter22");
    expect(h.startsWith("pbkdf2_sha256$100000$")).toBe(true);
    expect(await verifyPassword("hunter22", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(isLegacyHash(h)).toBe(false);
  });

  it("accepts the Flask app's legacy SHA-256 hashes", async () => {
    const legacy = createHash("sha256").update("hunter22").digest("hex");
    expect(isLegacyHash(legacy)).toBe(true);
    expect(await verifyPassword("hunter22", legacy)).toBe(true);
    expect(await verifyPassword("nope", legacy)).toBe(false);
  });
});
