import { describe, expect, it, vi } from "vitest";
import {
  DecryptError,
  decrypt,
  decryptFromApi,
  deriveKey,
  encrypt,
  encryptForApi,
  generateSalt,
  hashPassphrase,
} from "./crypto";

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

describe("hashPassphrase", () => {
  it("returns a base64 string", async () => {
    const hash = await hashPassphrase("test-passphrase");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
    // Verify it's valid base64 by decoding
    const bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));
    expect(bytes.length).toBe(32); // SHA-256 produces 32 bytes
  });

  it("returns same hash for same input", async () => {
    const hash1 = await hashPassphrase("deterministic");
    const hash2 = await hashPassphrase("deterministic");
    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different input", async () => {
    const hash1 = await hashPassphrase("passphrase-one");
    const hash2 = await hashPassphrase("passphrase-two");
    expect(hash1).not.toBe(hash2);
  });
});

describe("decrypt IV validation", () => {
  it("throws DecryptError when IV has wrong length", async () => {
    const key = await createTestKey();
    // Create a blob with an IV that decodes to the wrong number of bytes (not 12)
    // 8 random bytes encoded as base64 instead of the required 12
    const shortIv = btoa(String.fromCharCode(...new Uint8Array(8)));
    const blob = { iv: shortIv, ciphertext: btoa("dummy") };

    await expect(decrypt(blob, key)).rejects.toThrow(DecryptError);
    await expect(decrypt(blob, key)).rejects.toThrow("Invalid IV length: expected 12, got 8");
  });

  it("throws DecryptError when IV is too long", async () => {
    const key = await createTestKey();
    const longIv = btoa(String.fromCharCode(...new Uint8Array(16)));
    const blob = { iv: longIv, ciphertext: btoa("dummy") };

    await expect(decrypt(blob, key)).rejects.toThrow(DecryptError);
    await expect(decrypt(blob, key)).rejects.toThrow("Invalid IV length: expected 12, got 16");
  });
});

describe("deriveKey", () => {
  const mockArgon2 = {
    ArgonType: { Argon2d: 0 as const, Argon2i: 1 as const, Argon2id: 2 as const },
    hash: vi.fn(),
  };

  beforeEach(() => {
    (self as unknown as { argon2: typeof mockArgon2 }).argon2 = mockArgon2;
    mockArgon2.hash.mockReset();
  });

  afterEach(() => {
    delete (self as unknown as { argon2?: unknown }).argon2;
  });

  it("derives a CryptoKey from passphrase and salt", async () => {
    const mockHash = new Uint8Array(32);
    crypto.getRandomValues(mockHash);
    mockArgon2.hash.mockResolvedValueOnce({ hash: mockHash, hashHex: "", encoded: "" });

    const salt = generateSalt();
    const key = await deriveKey("test-passphrase", salt);

    expect(key).toBeDefined();
    expect(key.algorithm).toEqual({ name: "AES-GCM", length: 256 });
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
    expect(key.extractable).toBe(false);

    expect(mockArgon2.hash).toHaveBeenCalledOnce();
    const callArgs = mockArgon2.hash.mock.calls[0][0];
    expect(callArgs.pass).toBe("test-passphrase");
    expect(callArgs.time).toBe(3);
    expect(callArgs.mem).toBe(65536);
    expect(callArgs.hashLen).toBe(32);
    expect(callArgs.parallelism).toBe(1);
    expect(callArgs.type).toBe(2); // Argon2id
  });

  it("propagates errors from argon2", async () => {
    mockArgon2.hash.mockRejectedValueOnce(new Error("argon2 failed"));

    const salt = generateSalt();
    await expect(deriveKey("test-passphrase", salt)).rejects.toThrow("argon2 failed");
  });
});
