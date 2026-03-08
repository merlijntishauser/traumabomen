import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EncryptionProvider } from "./EncryptionContext";
import { useEncryption } from "./useEncryption";

// Mock crypto module — provider delegates all crypto to these
vi.mock("../lib/crypto", () => ({
  encryptForApi: vi.fn(async (data: unknown) => `encrypted:${JSON.stringify(data)}`),
  decryptFromApi: vi.fn(async (enc: string) => JSON.parse(enc.replace("encrypted:", ""))),
  hashPassphrase: vi.fn(async (p: string) => `hash:${p}`),
  timingSafeEqual: vi.fn((a: string, b: string) => a === b),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <EncryptionProvider>{children}</EncryptionProvider>;
}

function renderEncryption() {
  return renderHook(() => useEncryption(), { wrapper });
}

async function createMockKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("EncryptionProvider initial state", () => {
  it("starts with no master key", () => {
    const { result } = renderEncryption();
    expect(result.current.masterKey).toBeNull();
  });

  it("starts with empty tree keys", () => {
    const { result } = renderEncryption();
    expect(result.current.treeKeys.size).toBe(0);
  });

  it("starts with empty key ring", () => {
    const { result } = renderEncryption();
    expect(result.current.keyRingBase64.size).toBe(0);
  });

  it("starts with no passphrase hash", () => {
    const { result } = renderEncryption();
    expect(result.current.passphraseHash).toBeNull();
  });

  it("starts with isMigrated false", () => {
    const { result } = renderEncryption();
    expect(result.current.isMigrated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearKey — security-critical: must zero ALL state
// ---------------------------------------------------------------------------

describe("clearKey", () => {
  it("clears all encryption state completely", async () => {
    const { result } = renderEncryption();
    const mockKey = await createMockKey();

    // Set up all state fields
    act(() => {
      result.current.setMasterKey(mockKey);
      result.current.setTreeKeys(new Map([["tree-1", mockKey]]));
      result.current.setKeyRingBase64(new Map([["tree-1", "base64data"]]));
      result.current.setPassphraseHash("somehash");
      result.current.setIsMigrated(true);
    });

    // Verify state is populated
    expect(result.current.masterKey).not.toBeNull();
    expect(result.current.treeKeys.size).toBe(1);
    expect(result.current.keyRingBase64.size).toBe(1);
    expect(result.current.passphraseHash).toBe("somehash");
    expect(result.current.isMigrated).toBe(true);

    // Clear everything
    act(() => result.current.clearKey());

    // Verify every field is zeroed
    expect(result.current.masterKey).toBeNull();
    expect(result.current.treeKeys.size).toBe(0);
    expect(result.current.keyRingBase64.size).toBe(0);
    expect(result.current.passphraseHash).toBeNull();
    expect(result.current.isMigrated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addTreeKey / removeTreeKey
// ---------------------------------------------------------------------------

describe("addTreeKey", () => {
  it("adds key and base64 to both maps", async () => {
    const { result } = renderEncryption();
    const mockKey = await createMockKey();

    act(() => result.current.addTreeKey("tree-1", mockKey, "b64data"));

    expect(result.current.treeKeys.get("tree-1")).toBe(mockKey);
    expect(result.current.keyRingBase64.get("tree-1")).toBe("b64data");
  });

  it("preserves existing keys when adding new ones", async () => {
    const { result } = renderEncryption();
    const key1 = await createMockKey();
    const key2 = await createMockKey();

    act(() => result.current.addTreeKey("tree-1", key1, "b64-1"));
    act(() => result.current.addTreeKey("tree-2", key2, "b64-2"));

    expect(result.current.treeKeys.size).toBe(2);
    expect(result.current.keyRingBase64.size).toBe(2);
  });
});

describe("removeTreeKey", () => {
  it("removes key and base64 from both maps", async () => {
    const { result } = renderEncryption();
    const key1 = await createMockKey();
    const key2 = await createMockKey();

    act(() => {
      result.current.addTreeKey("tree-1", key1, "b64-1");
      result.current.addTreeKey("tree-2", key2, "b64-2");
    });

    act(() => result.current.removeTreeKey("tree-1"));

    expect(result.current.treeKeys.has("tree-1")).toBe(false);
    expect(result.current.keyRingBase64.has("tree-1")).toBe(false);
    expect(result.current.treeKeys.has("tree-2")).toBe(true);
    expect(result.current.keyRingBase64.has("tree-2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// encrypt / decrypt — key lookup guards
// ---------------------------------------------------------------------------

describe("encrypt", () => {
  it("throws when no tree key exists", async () => {
    const { result } = renderEncryption();
    await expect(result.current.encrypt({ data: "test" }, "missing-tree")).rejects.toThrow(
      "No encryption key for tree missing-tree",
    );
  });

  it("delegates to encryptForApi with tree key", async () => {
    const { result } = renderEncryption();
    const mockKey = await createMockKey();

    act(() => result.current.addTreeKey("tree-1", mockKey, "b64"));

    const encrypted = await result.current.encrypt({ name: "Alice" }, "tree-1");
    expect(encrypted).toBe('encrypted:{"name":"Alice"}');
  });
});

describe("decrypt", () => {
  it("throws when no tree key exists", async () => {
    const { result } = renderEncryption();
    await expect(result.current.decrypt("ciphertext", "missing-tree")).rejects.toThrow(
      "No encryption key for tree missing-tree",
    );
  });

  it("delegates to decryptFromApi with tree key", async () => {
    const { result } = renderEncryption();
    const mockKey = await createMockKey();

    act(() => result.current.addTreeKey("tree-1", mockKey, "b64"));

    const decrypted = await result.current.decrypt('encrypted:{"name":"Alice"}', "tree-1");
    expect(decrypted).toEqual({ name: "Alice" });
  });
});

// ---------------------------------------------------------------------------
// masterEncrypt / masterDecrypt — master key guards
// ---------------------------------------------------------------------------

describe("masterEncrypt", () => {
  it("throws when no master key is set", async () => {
    const { result } = renderEncryption();
    await expect(result.current.masterEncrypt({ data: "test" })).rejects.toThrow(
      "No master key available",
    );
  });

  it("delegates to encryptForApi with master key", async () => {
    const { result } = renderEncryption();
    const mockKey = await createMockKey();

    act(() => result.current.setMasterKey(mockKey));

    const encrypted = await result.current.masterEncrypt({ ring: true });
    expect(encrypted).toBe('encrypted:{"ring":true}');
  });
});

describe("masterDecrypt", () => {
  it("throws when no master key is set", async () => {
    const { result } = renderEncryption();
    await expect(result.current.masterDecrypt("ciphertext")).rejects.toThrow(
      "No master key available",
    );
  });

  it("delegates to decryptFromApi with master key", async () => {
    const { result } = renderEncryption();
    const mockKey = await createMockKey();

    act(() => result.current.setMasterKey(mockKey));

    const decrypted = await result.current.masterDecrypt('encrypted:{"ring":true}');
    expect(decrypted).toEqual({ ring: true });
  });
});

// ---------------------------------------------------------------------------
// verifyPassphrase
// ---------------------------------------------------------------------------

describe("verifyPassphrase", () => {
  it("returns false when no passphrase hash is stored", async () => {
    const { result } = renderEncryption();
    const ok = await result.current.verifyPassphrase("anything");
    expect(ok).toBe(false);
  });

  it("returns true for matching passphrase", async () => {
    const { result } = renderEncryption();

    act(() => result.current.setPassphraseHash("hash:correct-pass"));

    const ok = await result.current.verifyPassphrase("correct-pass");
    expect(ok).toBe(true);
  });

  it("returns false for wrong passphrase", async () => {
    const { result } = renderEncryption();

    act(() => result.current.setPassphraseHash("hash:correct-pass"));

    const ok = await result.current.verifyPassphrase("wrong-pass");
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useEncryption outside provider
// ---------------------------------------------------------------------------

describe("useEncryption", () => {
  it("throws when used outside EncryptionProvider", () => {
    expect(() => {
      renderHook(() => useEncryption());
    }).toThrow("useEncryption must be used within an EncryptionProvider");
  });
});
