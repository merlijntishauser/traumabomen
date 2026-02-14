import { describe, expect, it } from "vitest";
import { decrypt, decryptFromApi, encrypt, encryptForApi, generateSalt } from "./crypto";

async function createTestKey(): Promise<CryptoKey> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function createDifferentKey(): Promise<CryptoKey> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

describe("generateSalt", () => {
  it("returns a base64 string that decodes to 16 bytes", () => {
    const salt = generateSalt();
    const bytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    expect(bytes.length).toBe(16);
  });

  it("returns different values on each call", () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);
  });
});

describe("encrypt / decrypt", () => {
  it("round-trips plaintext", async () => {
    const key = await createTestKey();
    const plaintext = "hello world";
    const blob = await encrypt(plaintext, key);
    const result = await decrypt(blob, key);
    expect(result).toBe(plaintext);
  });

  it("produces output with iv and ciphertext fields", async () => {
    const key = await createTestKey();
    const blob = await encrypt("test", key);
    expect(blob).toHaveProperty("iv");
    expect(blob).toHaveProperty("ciphertext");
    expect(typeof blob.iv).toBe("string");
    expect(typeof blob.ciphertext).toBe("string");
  });

  it("produces different IVs for the same plaintext", async () => {
    const key = await createTestKey();
    const blob1 = await encrypt("same input", key);
    const blob2 = await encrypt("same input", key);
    expect(blob1.iv).not.toBe(blob2.iv);
  });

  it("throws when decrypting with wrong key", async () => {
    const key = await createTestKey();
    const wrongKey = await createDifferentKey();
    const blob = await encrypt("secret", key);
    await expect(decrypt(blob, wrongKey)).rejects.toThrow();
  });

  it("handles empty string", async () => {
    const key = await createTestKey();
    const blob = await encrypt("", key);
    const result = await decrypt(blob, key);
    expect(result).toBe("");
  });

  it("handles unicode text", async () => {
    const key = await createTestKey();
    const plaintext = "Traumabomen \u{1f333} generaties";
    const blob = await encrypt(plaintext, key);
    const result = await decrypt(blob, key);
    expect(result).toBe(plaintext);
  });
});

describe("encryptForApi / decryptFromApi", () => {
  it("round-trips objects", async () => {
    const key = await createTestKey();
    const data = {
      name: "Alice",
      birth_year: 1960,
      death_year: null,
      gender: "female",
      is_adopted: false,
      notes: null,
    };
    const encrypted = await encryptForApi(data, key);
    const result = await decryptFromApi(encrypted, key);
    expect(result).toEqual(data);
  });

  it("produces a JSON string containing iv and ciphertext", async () => {
    const key = await createTestKey();
    const encrypted = await encryptForApi({ test: true }, key);
    const parsed = JSON.parse(encrypted);
    expect(parsed).toHaveProperty("iv");
    expect(parsed).toHaveProperty("ciphertext");
  });

  it("throws on corrupted ciphertext", async () => {
    const key = await createTestKey();
    const encrypted = await encryptForApi({ test: true }, key);
    const parsed = JSON.parse(encrypted);
    parsed.ciphertext = "corrupted_data_here";
    const corrupted = JSON.stringify(parsed);
    await expect(decryptFromApi(corrupted, key)).rejects.toThrow();
  });
});
