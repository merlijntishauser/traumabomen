import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadOrMigrateKeyRing } from "./keyRingLoader";

// --- mocks ---

const mockGetKeyRing = vi.fn();
const mockMigrateKeys = vi.fn();
const mockGetTrees = vi.fn();
const mockGetPersons = vi.fn();
const mockGetRelationships = vi.fn();
const mockGetEvents = vi.fn();
const mockGetLifeEvents = vi.fn();
const mockGetTurningPoints = vi.fn();
const mockGetClassifications = vi.fn();
const mockGetPatterns = vi.fn();
const mockGetJournalEntries = vi.fn();

vi.mock("./api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`API error ${status}`);
      this.status = status;
    }
  },
  getKeyRing: (...args: unknown[]) => mockGetKeyRing(...args),
  migrateKeys: (...args: unknown[]) => mockMigrateKeys(...args),
  getTrees: (...args: unknown[]) => mockGetTrees(...args),
  getPersons: (...args: unknown[]) => mockGetPersons(...args),
  getRelationships: (...args: unknown[]) => mockGetRelationships(...args),
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  getLifeEvents: (...args: unknown[]) => mockGetLifeEvents(...args),
  getTurningPoints: (...args: unknown[]) => mockGetTurningPoints(...args),
  getClassifications: (...args: unknown[]) => mockGetClassifications(...args),
  getPatterns: (...args: unknown[]) => mockGetPatterns(...args),
  getJournalEntries: (...args: unknown[]) => mockGetJournalEntries(...args),
}));

const mockDecryptKeyRing = vi.fn();
const mockEncryptKeyRing = vi.fn();
const mockImportTreeKey = vi.fn();
const mockGenerateTreeKey = vi.fn();
const mockDecryptFromApi = vi.fn();
const mockEncryptForApi = vi.fn();

vi.mock("./crypto", () => ({
  decryptKeyRing: (...args: unknown[]) => mockDecryptKeyRing(...args),
  encryptKeyRing: (...args: unknown[]) => mockEncryptKeyRing(...args),
  importTreeKey: (...args: unknown[]) => mockImportTreeKey(...args),
  generateTreeKey: (...args: unknown[]) => mockGenerateTreeKey(...args),
  decryptFromApi: (...args: unknown[]) => mockDecryptFromApi(...args),
  encryptForApi: (...args: unknown[]) => mockEncryptForApi(...args),
}));

// Lazy-import the mocked ApiError so instanceof checks work
async function createApiError(status: number): Promise<Error> {
  const { ApiError } = await import("./api");
  return new ApiError(status);
}

const fakeMasterKey = {} as CryptoKey;
const fakeTreeKeyA = { id: "keyA" } as unknown as CryptoKey;
const fakeTreeKeyB = { id: "keyB" } as unknown as CryptoKey;

describe("loadOrMigrateKeyRing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when key ring exists (happy path)", () => {
    it("decrypts and imports all tree keys", async () => {
      mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "encrypted-ring" });
      mockDecryptKeyRing.mockResolvedValue({
        "tree-1": "base64-key-1",
        "tree-2": "base64-key-2",
      });
      mockImportTreeKey.mockResolvedValueOnce(fakeTreeKeyA).mockResolvedValueOnce(fakeTreeKeyB);

      const result = await loadOrMigrateKeyRing(fakeMasterKey);

      expect(mockGetKeyRing).toHaveBeenCalledOnce();
      expect(mockDecryptKeyRing).toHaveBeenCalledWith("encrypted-ring", fakeMasterKey);
      expect(mockImportTreeKey).toHaveBeenCalledTimes(2);
      expect(mockImportTreeKey).toHaveBeenCalledWith("base64-key-1");
      expect(mockImportTreeKey).toHaveBeenCalledWith("base64-key-2");
      expect(result.keys).toBeInstanceOf(Map);
      expect(result.keys.size).toBe(2);
      expect(result.keys.get("tree-1")).toBe(fakeTreeKeyA);
      expect(result.keys.get("tree-2")).toBe(fakeTreeKeyB);
      expect(result.base64Map.size).toBe(2);
      expect(result.base64Map.get("tree-1")).toBe("base64-key-1");
      expect(result.base64Map.get("tree-2")).toBe("base64-key-2");
    });

    it("returns empty map when key ring has no entries", async () => {
      mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "encrypted-ring" });
      mockDecryptKeyRing.mockResolvedValue({});

      const result = await loadOrMigrateKeyRing(fakeMasterKey);

      expect(result.keys.size).toBe(0);
      expect(result.base64Map.size).toBe(0);
      expect(mockImportTreeKey).not.toHaveBeenCalled();
    });
  });

  describe("when key ring does not exist (migration)", () => {
    beforeEach(() => {
      mockGetKeyRing.mockRejectedValue(
        // Construct inside beforeEach to avoid async issue; use direct object
        Object.assign(new Error("Not found"), { status: 404, name: "ApiError" }),
      );
    });

    it("falls back to migration on 404", async () => {
      // Override with proper ApiError
      mockGetKeyRing.mockImplementation(async () => {
        throw await createApiError(404);
      });

      mockGetTrees.mockResolvedValue([{ id: "tree-1", encrypted_data: "tree-1-old-enc" }]);
      mockGenerateTreeKey.mockResolvedValue({ key: fakeTreeKeyA, base64: "new-b64-key" });
      mockDecryptFromApi.mockResolvedValue({ name: "My Tree" });
      mockEncryptForApi.mockResolvedValue("tree-1-new-enc");

      // All entity fetches return empty arrays
      mockGetPersons.mockResolvedValue([]);
      mockGetRelationships.mockResolvedValue([]);
      mockGetEvents.mockResolvedValue([]);
      mockGetLifeEvents.mockResolvedValue([]);
      mockGetTurningPoints.mockResolvedValue([]);
      mockGetClassifications.mockResolvedValue([]);
      mockGetPatterns.mockResolvedValue([]);
      mockGetJournalEntries.mockResolvedValue([]);

      mockEncryptKeyRing.mockResolvedValue("encrypted-new-ring");
      mockMigrateKeys.mockResolvedValue(undefined);

      const result = await loadOrMigrateKeyRing(fakeMasterKey);

      expect(result.keys.size).toBe(1);
      expect(result.keys.get("tree-1")).toBe(fakeTreeKeyA);
      expect(result.base64Map.get("tree-1")).toBe("new-b64-key");
      expect(mockMigrateKeys).toHaveBeenCalledWith({
        encrypted_key_ring: "encrypted-new-ring",
        trees: [
          expect.objectContaining({
            tree_id: "tree-1",
            encrypted_data: "tree-1-new-enc",
            persons: [],
            relationships: [],
            events: [],
            life_events: [],
            turning_points: [],
            classifications: [],
            patterns: [],
            journal_entries: [],
          }),
        ],
      });
    });

    it("re-encrypts entities during migration", async () => {
      mockGetKeyRing.mockImplementation(async () => {
        throw await createApiError(404);
      });

      mockGetTrees.mockResolvedValue([{ id: "tree-1", encrypted_data: "tree-enc" }]);
      mockGenerateTreeKey.mockResolvedValue({ key: fakeTreeKeyA, base64: "b64" });
      mockDecryptFromApi.mockResolvedValue({ name: "Tree" });
      mockEncryptForApi.mockImplementation(async (data: unknown) => `enc:${JSON.stringify(data)}`);

      mockGetPersons.mockResolvedValue([{ id: "p1", encrypted_data: "p1-old" }]);
      mockGetRelationships.mockResolvedValue([]);
      mockGetEvents.mockResolvedValue([]);
      mockGetLifeEvents.mockResolvedValue([]);
      mockGetTurningPoints.mockResolvedValue([]);
      mockGetClassifications.mockResolvedValue([]);
      mockGetPatterns.mockResolvedValue([]);
      mockGetJournalEntries.mockResolvedValue([]);

      mockEncryptKeyRing.mockResolvedValue("ring");
      mockMigrateKeys.mockResolvedValue(undefined);

      await loadOrMigrateKeyRing(fakeMasterKey);

      // decryptFromApi called for tree + person
      expect(mockDecryptFromApi).toHaveBeenCalledWith("tree-enc", fakeMasterKey);
      expect(mockDecryptFromApi).toHaveBeenCalledWith("p1-old", fakeMasterKey);

      // encryptForApi called for tree + person
      expect(mockEncryptForApi).toHaveBeenCalledWith({ name: "Tree" }, fakeTreeKeyA);
      expect(mockEncryptForApi).toHaveBeenCalledWith(expect.anything(), fakeTreeKeyA);

      const migrateCall = mockMigrateKeys.mock.calls[0][0];
      expect(migrateCall.trees[0].persons).toHaveLength(1);
      expect(migrateCall.trees[0].persons[0].id).toBe("p1");
    });

    it("handles zero trees during migration", async () => {
      mockGetKeyRing.mockImplementation(async () => {
        throw await createApiError(404);
      });

      mockGetTrees.mockResolvedValue([]);
      mockEncryptKeyRing.mockResolvedValue("empty-ring");
      mockMigrateKeys.mockResolvedValue(undefined);

      const result = await loadOrMigrateKeyRing(fakeMasterKey);

      expect(result.keys.size).toBe(0);
      expect(result.base64Map.size).toBe(0);
      expect(mockMigrateKeys).toHaveBeenCalledWith({
        encrypted_key_ring: "empty-ring",
        trees: [],
      });
    });

    it("generates unique keys per tree", async () => {
      mockGetKeyRing.mockImplementation(async () => {
        throw await createApiError(404);
      });

      mockGetTrees.mockResolvedValue([
        { id: "tree-1", encrypted_data: "enc1" },
        { id: "tree-2", encrypted_data: "enc2" },
      ]);
      mockGenerateTreeKey
        .mockResolvedValueOnce({ key: fakeTreeKeyA, base64: "b64-a" })
        .mockResolvedValueOnce({ key: fakeTreeKeyB, base64: "b64-b" });
      mockDecryptFromApi.mockResolvedValue({ name: "Tree" });
      mockEncryptForApi.mockResolvedValue("enc-new");

      for (const mock of [
        mockGetPersons,
        mockGetRelationships,
        mockGetEvents,
        mockGetLifeEvents,
        mockGetTurningPoints,
        mockGetClassifications,
        mockGetPatterns,
        mockGetJournalEntries,
      ]) {
        mock.mockResolvedValue([]);
      }

      mockEncryptKeyRing.mockResolvedValue("ring");
      mockMigrateKeys.mockResolvedValue(undefined);

      const result = await loadOrMigrateKeyRing(fakeMasterKey);

      expect(mockGenerateTreeKey).toHaveBeenCalledTimes(2);
      expect(result.keys.size).toBe(2);
      expect(result.keys.get("tree-1")).toBe(fakeTreeKeyA);
      expect(result.keys.get("tree-2")).toBe(fakeTreeKeyB);
      expect(result.base64Map.get("tree-1")).toBe("b64-a");
      expect(result.base64Map.get("tree-2")).toBe("b64-b");

      // Key ring should contain both keys
      expect(mockEncryptKeyRing).toHaveBeenCalledWith(
        { "tree-1": "b64-a", "tree-2": "b64-b" },
        fakeMasterKey,
      );
    });
  });

  describe("error handling", () => {
    it("re-throws non-404 API errors", async () => {
      mockGetKeyRing.mockImplementation(async () => {
        throw await createApiError(500);
      });

      await expect(loadOrMigrateKeyRing(fakeMasterKey)).rejects.toThrow();
      expect(mockGetTrees).not.toHaveBeenCalled();
    });

    it("re-throws non-API errors", async () => {
      mockGetKeyRing.mockRejectedValue(new TypeError("Network error"));

      await expect(loadOrMigrateKeyRing(fakeMasterKey)).rejects.toThrow("Network error");
      expect(mockGetTrees).not.toHaveBeenCalled();
    });
  });
});
