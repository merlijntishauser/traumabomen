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

  it("starts with no shared trees", () => {
    const { result } = renderEncryption();
    expect(result.current.sharedTrees.size).toBe(0);
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
    const [key1, key2] = await Promise.all([createMockKey(), createMockKey()]);

    act(() => result.current.addTreeKey("tree-1", key1, "b64-1"));
    act(() => result.current.addTreeKey("tree-2", key2, "b64-2"));

    expect(result.current.treeKeys.size).toBe(2);
    expect(result.current.keyRingBase64.size).toBe(2);
  });
});

describe("removeTreeKey", () => {
  it("removes key and base64 from both maps", async () => {
    const { result } = renderEncryption();
    const [key1, key2] = await Promise.all([createMockKey(), createMockKey()]);

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
// setSharing / isSharedTree
// ---------------------------------------------------------------------------

const sharedInfo = { shareId: "share-1", treeId: "shared-tree", ownerLabel: "Anna" };

describe("setSharing", () => {
  it("shared keys are not added to keyRingBase64", async () => {
    const { result } = renderEncryption();
    const [master, own, shared] = await Promise.all([
      createMockKey(),
      createMockKey(),
      createMockKey(),
    ]);

    act(() => {
      result.current.setMasterKey(master);
      result.current.addTreeKey("own-tree", own, "own-b64");
    });
    act(() =>
      result.current.setSharing(
        master,
        new Map([["shared-tree", shared]]),
        new Map([["shared-tree", sharedInfo]]),
      ),
    );

    expect(result.current.treeKeys.get("own-tree")).toBe(own);
    expect(result.current.treeKeys.get("shared-tree")).toBe(shared);
    expect([...result.current.keyRingBase64.keys()]).toEqual(["own-tree"]);
    expect(result.current.sharedTrees.get("shared-tree")).toEqual(sharedInfo);
  });

  it("marks only shared trees as shared", async () => {
    const { result } = renderEncryption();
    const [master, own, shared] = await Promise.all([
      createMockKey(),
      createMockKey(),
      createMockKey(),
    ]);

    act(() => {
      result.current.setMasterKey(master);
      result.current.addTreeKey("own-tree", own, "own-b64");
    });
    act(() =>
      result.current.setSharing(
        master,
        new Map([["shared-tree", shared]]),
        new Map([["shared-tree", sharedInfo]]),
      ),
    );

    expect(result.current.isSharedTree("shared-tree")).toBe(true);
    expect(result.current.isSharedTree("own-tree")).toBe(false);
    expect(result.current.isSharedTree("unknown")).toBe(false);
  });

  it("ignores sharing that resolves after the session was cleared", async () => {
    const { result } = renderEncryption();
    const [master, shared] = await Promise.all([createMockKey(), createMockKey()]);

    act(() => result.current.setMasterKey(master));
    act(() => result.current.clearKey());
    act(() =>
      result.current.setSharing(
        master,
        new Map([["shared-tree", shared]]),
        new Map([["shared-tree", sharedInfo]]),
      ),
    );

    expect(result.current.treeKeys.size).toBe(0);
    expect(result.current.sharedTrees.size).toBe(0);
  });

  it("ignores sharing that resolves after another session unlocked", async () => {
    const { result } = renderEncryption();
    const [masterA, masterB, sharedA, ownB] = await Promise.all([
      createMockKey(),
      createMockKey(),
      createMockKey(),
      createMockKey(),
    ]);

    // Session A unlocks and starts loading sharing with masterA...
    act(() => result.current.setMasterKey(masterA));
    // ...then locks, and session B unlocks before A's load resolves.
    act(() => result.current.clearKey());
    act(() => {
      result.current.setMasterKey(masterB);
      result.current.addTreeKey("own-tree-b", ownB, "own-b64-b");
    });
    act(() =>
      result.current.setSharing(
        masterA,
        new Map([["shared-tree", sharedA]]),
        new Map([["shared-tree", sharedInfo]]),
      ),
    );

    expect(result.current.treeKeys.has("shared-tree")).toBe(false);
    expect([...result.current.treeKeys.keys()]).toEqual(["own-tree-b"]);
    expect(result.current.sharedTrees.size).toBe(0);
    expect(result.current.isSharedTree("shared-tree")).toBe(false);
  });

  it("setTreeKeys keeps the keys of shared trees, as after a reauth", async () => {
    const { result } = renderEncryption();
    const [master, oldOwn, newOwn, shared] = await Promise.all([
      createMockKey(),
      createMockKey(),
      createMockKey(),
      createMockKey(),
    ]);

    act(() => {
      result.current.setMasterKey(master);
      result.current.setTreeKeys(new Map([["own-tree", oldOwn]]));
    });
    act(() =>
      result.current.setSharing(
        master,
        new Map([["shared-tree", shared]]),
        new Map([["shared-tree", sharedInfo]]),
      ),
    );
    // The reauth hands over the user's own key ring only.
    act(() => result.current.setTreeKeys(new Map([["own-tree", newOwn]])));

    expect(result.current.treeKeys.get("own-tree")).toBe(newOwn);
    expect(result.current.treeKeys.get("shared-tree")).toBe(shared);
    expect(result.current.isSharedTree("shared-tree")).toBe(true);
  });

  it("setTreeKeys still replaces the keys of the user's own trees", async () => {
    const { result } = renderEncryption();
    const [master, gone, kept] = await Promise.all([
      createMockKey(),
      createMockKey(),
      createMockKey(),
    ]);

    act(() => {
      result.current.setMasterKey(master);
      result.current.setTreeKeys(new Map([["deleted-tree", gone]]));
    });
    act(() => result.current.setTreeKeys(new Map([["own-tree", kept]])));

    expect([...result.current.treeKeys.keys()]).toEqual(["own-tree"]);
  });

  it("tracks the sharing load from start to loaded, and resets it on clear", async () => {
    const { result } = renderEncryption();
    const master = await createMockKey();
    expect(result.current.sharingStatus).toBe("idle");

    act(() => result.current.setMasterKey(master));
    act(() => result.current.startSharingLoad(master));
    expect(result.current.sharingStatus).toBe("loading");

    act(() => result.current.setSharing(master, new Map(), new Map()));
    expect(result.current.sharingStatus).toBe("loaded");

    act(() => result.current.clearKey());
    expect(result.current.sharingStatus).toBe("idle");
  });

  it("ignores a sharing load started by another session", async () => {
    const { result } = renderEncryption();
    const [masterA, masterB] = await Promise.all([createMockKey(), createMockKey()]);

    act(() => result.current.setMasterKey(masterB));
    act(() => result.current.startSharingLoad(masterA));
    expect(result.current.sharingStatus).toBe("idle");
    act(() => result.current.setSharing(masterA, new Map(), new Map()));
    expect(result.current.sharingStatus).toBe("idle");
  });

  it("clearKey drops shared trees and their keys", async () => {
    const { result } = renderEncryption();
    const [master, shared] = await Promise.all([createMockKey(), createMockKey()]);

    act(() => result.current.setMasterKey(master));
    act(() =>
      result.current.setSharing(
        master,
        new Map([["shared-tree", shared]]),
        new Map([["shared-tree", sharedInfo]]),
      ),
    );
    act(() => result.current.clearKey());

    expect(result.current.sharedTrees.size).toBe(0);
    expect(result.current.treeKeys.size).toBe(0);
    expect(result.current.isSharedTree("shared-tree")).toBe(false);
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
