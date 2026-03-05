import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImportTree } from "./useImportTree";

const fakeMasterKey = {} as CryptoKey;
const fakeTreeKey = { id: "treeKey" } as unknown as CryptoKey;
const mockAddTreeKey = vi.fn();

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    masterKey: fakeMasterKey,
    addTreeKey: mockAddTreeKey,
  }),
}));

const mockCreateTree = vi.fn();
const mockSyncTree = vi.fn();
const mockModifyKeyRing = vi.fn();

vi.mock("../lib/api", () => ({
  createTree: (...args: unknown[]) => mockCreateTree(...args),
  syncTree: (...args: unknown[]) => mockSyncTree(...args),
  modifyKeyRing: (...args: unknown[]) => mockModifyKeyRing(...args),
}));

const mockDecryptFromApi = vi.fn();
const mockImportTreeKey = vi.fn();

vi.mock("../lib/crypto", () => ({
  decryptFromApi: (...args: unknown[]) => mockDecryptFromApi(...args),
  importTreeKey: (...args: unknown[]) => mockImportTreeKey(...args),
}));

const NEW_TREE_ID = "new-tree-id";

function makeValidExport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    format: "encrypted",
    exported_at: "2026-02-24T10:00:00Z",
    encrypted_tree_key: "enc-tree-key",
    tree: { id: "old-tree-id", encrypted_data: "tree-enc" },
    persons: [{ id: "p1", encrypted_data: "p-enc" }],
    relationships: [
      { id: "r1", source_person_id: "p1", target_person_id: "p2", encrypted_data: "r-enc" },
    ],
    events: [{ id: "e1", person_ids: ["p1"], encrypted_data: "e-enc" }],
    life_events: [{ id: "le1", person_ids: ["p1"], encrypted_data: "le-enc" }],
    turning_points: [{ id: "tp1", person_ids: ["p1"], encrypted_data: "tp-enc" }],
    classifications: [{ id: "c1", person_ids: ["p1"], encrypted_data: "c-enc" }],
    patterns: [{ id: "pat1", person_ids: ["p1"], encrypted_data: "pat-enc" }],
    journal_entries: [{ id: "j1", encrypted_data: "j-enc" }],
    ...overrides,
  });
}

function makeFile(content: string): File {
  return new File([content], "backup.json", { type: "application/json" });
}

describe("useImportTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDecryptFromApi
      .mockResolvedValueOnce("raw-tree-key-b64") // decrypt tree key from backup
      .mockResolvedValueOnce({ name: "Test Tree" }); // verify tree data
    mockImportTreeKey.mockResolvedValue(fakeTreeKey);
    mockCreateTree.mockResolvedValue({ id: NEW_TREE_ID });
    mockSyncTree.mockResolvedValue({});
    mockModifyKeyRing.mockResolvedValue(undefined);
  });

  it("imports a valid encrypted backup", async () => {
    const file = makeFile(makeValidExport());
    const { result } = renderHook(() => useImportTree());

    const treeId = await result.current.importTree(file);

    expect(treeId).toBe(NEW_TREE_ID);
    expect(mockDecryptFromApi).toHaveBeenCalledWith("enc-tree-key", fakeMasterKey);
    expect(mockImportTreeKey).toHaveBeenCalled();
    expect(mockCreateTree).toHaveBeenCalledWith({ encrypted_data: "tree-enc" });
    expect(mockAddTreeKey).toHaveBeenCalledWith(NEW_TREE_ID, fakeTreeKey, "raw-tree-key-b64");
  });

  it("syncs all entities via bulk sync endpoint", async () => {
    const file = makeFile(makeValidExport());
    const { result } = renderHook(() => useImportTree());

    await result.current.importTree(file);

    expect(mockSyncTree).toHaveBeenCalledWith(NEW_TREE_ID, {
      persons_create: [{ id: "p1", encrypted_data: "p-enc" }],
      relationships_create: [
        { id: "r1", source_person_id: "p1", target_person_id: "p2", encrypted_data: "r-enc" },
      ],
      events_create: [{ id: "e1", person_ids: ["p1"], encrypted_data: "e-enc" }],
      life_events_create: [{ id: "le1", person_ids: ["p1"], encrypted_data: "le-enc" }],
      classifications_create: [{ id: "c1", person_ids: ["p1"], encrypted_data: "c-enc" }],
      turning_points_create: [{ id: "tp1", person_ids: ["p1"], encrypted_data: "tp-enc" }],
      patterns_create: [{ id: "pat1", person_ids: ["p1"], encrypted_data: "pat-enc" }],
      journal_entries_create: [{ id: "j1", encrypted_data: "j-enc" }],
    });
  });

  it("updates key ring on server after import", async () => {
    const file = makeFile(makeValidExport());
    const { result } = renderHook(() => useImportTree());

    await result.current.importTree(file);

    expect(mockModifyKeyRing).toHaveBeenCalledWith(fakeMasterKey, expect.any(Function));
    // Verify the transform function adds the new tree key
    const transform = mockModifyKeyRing.mock.calls[0][1];
    const updated = transform({ existingTree: "existing-key" });
    expect(updated).toEqual({ existingTree: "existing-key", [NEW_TREE_ID]: "raw-tree-key-b64" });
  });

  it("rejects files with wrong version", async () => {
    const file = makeFile(makeValidExport({ version: 2 }));
    const { result } = renderHook(() => useImportTree());

    await expect(result.current.importTree(file)).rejects.toThrow("Invalid backup file");
    expect(mockCreateTree).not.toHaveBeenCalled();
  });

  it("rejects files with wrong format", async () => {
    const file = makeFile(makeValidExport({ format: "plaintext" }));
    const { result } = renderHook(() => useImportTree());

    await expect(result.current.importTree(file)).rejects.toThrow("Invalid backup file");
    expect(mockCreateTree).not.toHaveBeenCalled();
  });

  it("handles backup with no optional entities", async () => {
    const minimal = makeValidExport({
      life_events: undefined,
      turning_points: undefined,
      classifications: undefined,
      patterns: undefined,
      journal_entries: undefined,
    });
    const file = makeFile(minimal);
    const { result } = renderHook(() => useImportTree());

    await result.current.importTree(file);

    expect(mockSyncTree).toHaveBeenCalledWith(
      NEW_TREE_ID,
      expect.objectContaining({
        life_events_create: [],
        classifications_create: [],
        turning_points_create: [],
        patterns_create: [],
        journal_entries_create: [],
      }),
    );
  });
});
