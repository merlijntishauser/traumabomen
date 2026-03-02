import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExportTree } from "./useExportTree";

const mockTreeKeys = new Map<string, CryptoKey>();
const mockKeyRingBase64 = new Map<string, string>();
const fakeMasterKey = {} as CryptoKey;
const fakeTreeKey = { id: "treeKey" } as unknown as CryptoKey;

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    treeKeys: mockTreeKeys,
    keyRingBase64: mockKeyRingBase64,
    masterKey: fakeMasterKey,
  }),
}));

const mockGetTree = vi.fn();
const mockGetPersons = vi.fn();
const mockGetRelationships = vi.fn();
const mockGetEvents = vi.fn();
const mockGetLifeEvents = vi.fn();
const mockGetTurningPoints = vi.fn();
const mockGetClassifications = vi.fn();
const mockGetPatterns = vi.fn();
const mockGetJournalEntries = vi.fn();

vi.mock("../lib/api", () => ({
  getTree: (...args: unknown[]) => mockGetTree(...args),
  getPersons: (...args: unknown[]) => mockGetPersons(...args),
  getRelationships: (...args: unknown[]) => mockGetRelationships(...args),
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  getLifeEvents: (...args: unknown[]) => mockGetLifeEvents(...args),
  getTurningPoints: (...args: unknown[]) => mockGetTurningPoints(...args),
  getClassifications: (...args: unknown[]) => mockGetClassifications(...args),
  getPatterns: (...args: unknown[]) => mockGetPatterns(...args),
  getJournalEntries: (...args: unknown[]) => mockGetJournalEntries(...args),
}));

const mockEncryptForApi = vi.fn();

vi.mock("../lib/crypto", () => ({
  encryptForApi: (...args: unknown[]) => mockEncryptForApi(...args),
}));

const mockCreateObjectURL = vi.fn(() => "blob:test-url");
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal("URL", {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

const TREE_ID = "tree-123";

// Save the real createElement before any spying
const realCreateElement = document.createElement.bind(document);

// Track anchor elements created for download
let lastAnchor: HTMLAnchorElement | null = null;
let createElementSpy: ReturnType<typeof vi.spyOn> | null = null;

function makeFakeTreeData(overrides: Record<string, unknown> = {}) {
  return {
    treeName: "My Tree",
    persons: new Map([["p1", { id: "p1", name: "Alice" }]]),
    relationships: new Map([
      [
        "r1",
        { id: "r1", source_person_id: "p1", target_person_id: "p2", type: "biological_parent" },
      ],
    ]),
    events: new Map([["e1", { id: "e1", person_ids: ["p1"], title: "Event" }]]),
    lifeEvents: new Map([["le1", { id: "le1", person_ids: ["p1"], title: "Life" }]]),
    turningPoints: new Map([["tp1", { id: "tp1", person_ids: ["p1"], title: "Turn" }]]),
    classifications: new Map([["c1", { id: "c1", person_ids: ["p1"], dsm_category: "anxiety" }]]),
    patterns: new Map([["pat1", { id: "pat1", person_ids: ["p1"], name: "Pattern" }]]),
    journalEntries: new Map([["j1", { id: "j1", text: "Entry" }]]),
    isLoading: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof import("./useTreeData").useTreeData>;
}

describe("useExportTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTreeKeys.clear();
    mockKeyRingBase64.clear();
    mockTreeKeys.set(TREE_ID, fakeTreeKey);
    mockKeyRingBase64.set(TREE_ID, "raw-key-b64");
    lastAnchor = null;

    createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string, options?: ElementCreationOptions) => {
        const el = realCreateElement(tag, options);
        if (tag === "a") {
          lastAnchor = el as HTMLAnchorElement;
          vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {});
        }
        return el;
      });
  });

  afterEach(() => {
    createElementSpy?.mockRestore();
  });

  describe("exportEncrypted", () => {
    it("fetches all entities and triggers download", async () => {
      mockEncryptForApi.mockResolvedValue("encrypted-tree-key");
      mockGetTree.mockResolvedValue({ id: TREE_ID, encrypted_data: "tree-enc" });
      mockGetPersons.mockResolvedValue([{ id: "p1", encrypted_data: "p-enc" }]);
      mockGetRelationships.mockResolvedValue([
        { id: "r1", source_person_id: "p1", target_person_id: "p2", encrypted_data: "r-enc" },
      ]);
      mockGetEvents.mockResolvedValue([{ id: "e1", person_ids: ["p1"], encrypted_data: "e-enc" }]);
      mockGetLifeEvents.mockResolvedValue([
        { id: "le1", person_ids: ["p1"], encrypted_data: "le-enc" },
      ]);
      mockGetTurningPoints.mockResolvedValue([
        { id: "tp1", person_ids: ["p1"], encrypted_data: "tp-enc" },
      ]);
      mockGetClassifications.mockResolvedValue([
        { id: "c1", person_ids: ["p1"], encrypted_data: "c-enc" },
      ]);
      mockGetPatterns.mockResolvedValue([
        { id: "pat1", person_ids: ["p1"], encrypted_data: "pat-enc" },
      ]);
      mockGetJournalEntries.mockResolvedValue([{ id: "j1", encrypted_data: "j-enc" }]);

      const { result } = renderHook(() => useExportTree(TREE_ID, makeFakeTreeData()));
      await result.current.exportEncrypted();

      expect(mockEncryptForApi).toHaveBeenCalledWith("raw-key-b64", fakeMasterKey);
      expect(mockGetTree).toHaveBeenCalledWith(TREE_ID);
      expect(mockGetPersons).toHaveBeenCalledWith(TREE_ID);

      // Verify download was triggered
      expect(lastAnchor).not.toBeNull();
      expect(lastAnchor!.click).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");

      // Verify blob content
      const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blobArg.text();
      const data = JSON.parse(text);
      expect(data.version).toBe(1);
      expect(data.format).toBe("encrypted");
      expect(data.encrypted_tree_key).toBe("encrypted-tree-key");
      expect(data.tree.id).toBe(TREE_ID);
      expect(data.persons).toHaveLength(1);
      expect(data.relationships).toHaveLength(1);
      expect(data.events).toHaveLength(1);
      expect(data.life_events).toHaveLength(1);
      expect(data.turning_points).toHaveLength(1);
      expect(data.classifications).toHaveLength(1);
      expect(data.patterns).toHaveLength(1);
      expect(data.journal_entries).toHaveLength(1);
    });

    it("uses slugified tree name in filename", async () => {
      mockEncryptForApi.mockResolvedValue("enc");
      mockGetTree.mockResolvedValue({ id: TREE_ID, encrypted_data: "enc" });
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

      const { result } = renderHook(() =>
        useExportTree(TREE_ID, makeFakeTreeData({ treeName: "My Family Tree" })),
      );
      await result.current.exportEncrypted();

      expect(lastAnchor!.download).toMatch(
        /^traumatrees-backup-my-family-tree-\d{4}-\d{2}-\d{2}\.json$/,
      );
    });

    it("throws when tree key is missing", async () => {
      mockTreeKeys.clear();
      mockKeyRingBase64.clear();

      const { result } = renderHook(() => useExportTree(TREE_ID, makeFakeTreeData()));
      await expect(result.current.exportEncrypted()).rejects.toThrow("Missing encryption keys");
    });
  });

  describe("exportPlaintext", () => {
    it("exports decrypted data from tree data", async () => {
      const { result } = renderHook(() => useExportTree(TREE_ID, makeFakeTreeData()));
      await result.current.exportPlaintext();

      expect(lastAnchor).not.toBeNull();
      expect(lastAnchor!.click).toHaveBeenCalled();

      const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const text = await blobArg.text();
      const data = JSON.parse(text);
      expect(data.version).toBe(1);
      expect(data.format).toBe("plaintext");
      expect(data.tree.name).toBe("My Tree");
      expect(data.persons).toHaveLength(1);
      expect(data.persons[0].name).toBe("Alice");
      expect(data.relationships).toHaveLength(1);
      expect(data.events).toHaveLength(1);
      expect(data.life_events).toHaveLength(1);
      expect(data.turning_points).toHaveLength(1);
      expect(data.classifications).toHaveLength(1);
      expect(data.patterns).toHaveLength(1);
      expect(data.journal_entries).toHaveLength(1);
    });

    it("does not call any API functions", async () => {
      const { result } = renderHook(() => useExportTree(TREE_ID, makeFakeTreeData()));
      await result.current.exportPlaintext();

      expect(mockGetTree).not.toHaveBeenCalled();
      expect(mockGetPersons).not.toHaveBeenCalled();
    });

    it("uses slugified tree name in filename", async () => {
      const { result } = renderHook(() =>
        useExportTree(TREE_ID, makeFakeTreeData({ treeName: "Mijn Stamboom" })),
      );
      await result.current.exportPlaintext();

      expect(lastAnchor!.download).toMatch(
        /^traumatrees-export-mijn-stamboom-\d{4}-\d{2}-\d{2}\.json$/,
      );
    });
  });
});
