import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSharing } from "./sharingLoader";

// --- mocks ---

const mockGetKeyPair = vi.fn();
const mockPutKeyPair = vi.fn();
const mockGetSharedKeys = vi.fn();
const mockGetPendingShares = vi.fn();
const mockCompleteShare = vi.fn();

vi.mock("./api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail = "") {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
  getKeyPair: (...args: unknown[]) => mockGetKeyPair(...args),
  putKeyPair: (...args: unknown[]) => mockPutKeyPair(...args),
  getSharedKeys: (...args: unknown[]) => mockGetSharedKeys(...args),
  getPendingShares: (...args: unknown[]) => mockGetPendingShares(...args),
  completeShare: (...args: unknown[]) => mockCompleteShare(...args),
}));

const mockGenerateShareKeyPair = vi.fn();
const mockImportSharePublicKey = vi.fn();
const mockImportSharePrivateKey = vi.fn();
const mockWrapTreeKey = vi.fn();
const mockUnwrapTreeKey = vi.fn();
const mockEncryptForApi = vi.fn();
const mockDecryptFromApi = vi.fn();

vi.mock("./crypto", () => ({
  generateShareKeyPair: (...args: unknown[]) => mockGenerateShareKeyPair(...args),
  importSharePublicKey: (...args: unknown[]) => mockImportSharePublicKey(...args),
  importSharePrivateKey: (...args: unknown[]) => mockImportSharePrivateKey(...args),
  wrapTreeKey: (...args: unknown[]) => mockWrapTreeKey(...args),
  unwrapTreeKey: (...args: unknown[]) => mockUnwrapTreeKey(...args),
  encryptForApi: (...args: unknown[]) => mockEncryptForApi(...args),
  decryptFromApi: (...args: unknown[]) => mockDecryptFromApi(...args),
}));

const mockCaptureException = vi.fn();
vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

async function apiError(status: number, detail = ""): Promise<Error> {
  const { ApiError } = await import("./api");
  return new ApiError(status, detail);
}

const masterKey = { id: "master" } as unknown as CryptoKey;
const privateKey = { id: "private" } as unknown as CryptoKey;
const existingPair = { public_key: "pub-jwk", encrypted_private_key: "enc-priv" };

function grant(treeId: string, overrides: Record<string, unknown> = {}) {
  return {
    share_id: `share-${treeId}`,
    tree_id: treeId,
    encrypted_tree_key: `wrapped-${treeId}`,
    owner_display_name: null,
    owner_email: "owner@example.com",
    ...overrides,
  };
}

describe("loadSharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKeyPair.mockResolvedValue(existingPair);
    mockPutKeyPair.mockResolvedValue(undefined);
    mockGetSharedKeys.mockResolvedValue([]);
    mockGetPendingShares.mockResolvedValue([]);
    mockCompleteShare.mockResolvedValue({});
    mockDecryptFromApi.mockResolvedValue("priv-jwk");
    mockImportSharePrivateKey.mockResolvedValue(privateKey);
    mockImportSharePublicKey.mockImplementation(async (jwk: string) => ({ jwk }));
    mockUnwrapTreeKey.mockImplementation(async (wrapped: string) => ({ wrapped }));
    mockWrapTreeKey.mockImplementation(async (b64: string) => `wrapped:${b64}`);
    mockGenerateShareKeyPair.mockResolvedValue({ publicJwk: "new-pub", privateJwk: "new-priv" });
    mockEncryptForApi.mockResolvedValue("enc-new-priv");
  });

  it("generates and uploads a key pair when none exists", async () => {
    mockGetKeyPair.mockRejectedValueOnce(await apiError(404));

    await loadSharing(masterKey, new Map());

    expect(mockGenerateShareKeyPair).toHaveBeenCalledOnce();
    expect(mockEncryptForApi).toHaveBeenCalledWith("new-priv", masterKey);
    expect(mockPutKeyPair).toHaveBeenCalledWith({
      public_key: "new-pub",
      encrypted_private_key: "enc-new-priv",
    });
    expect(mockDecryptFromApi).toHaveBeenCalledWith("enc-new-priv", masterKey);
    expect(mockImportSharePrivateKey).toHaveBeenCalledWith("priv-jwk");
  });

  it("re-fetches the key pair when another session uploaded one first", async () => {
    mockGetKeyPair.mockRejectedValueOnce(await apiError(404)).mockResolvedValueOnce(existingPair);
    mockPutKeyPair.mockRejectedValueOnce(await apiError(409, "key_pair_exists"));

    await loadSharing(masterKey, new Map());

    expect(mockGetKeyPair).toHaveBeenCalledTimes(2);
    expect(mockDecryptFromApi).toHaveBeenCalledWith("enc-priv", masterKey);
  });

  it("reuses an existing key pair", async () => {
    await loadSharing(masterKey, new Map());

    expect(mockGenerateShareKeyPair).not.toHaveBeenCalled();
    expect(mockPutKeyPair).not.toHaveBeenCalled();
    expect(mockDecryptFromApi).toHaveBeenCalledWith("enc-priv", masterKey);
    expect(mockImportSharePrivateKey).toHaveBeenCalledWith("priv-jwk");
  });

  it("unwraps every grant and labels it with the owner's name or email", async () => {
    mockGetSharedKeys.mockResolvedValue([
      grant("tree-a", { owner_display_name: "Anna" }),
      grant("tree-b"),
    ]);

    const { sharedKeys, sharedTrees } = await loadSharing(masterKey, new Map());

    expect(mockUnwrapTreeKey).toHaveBeenCalledWith("wrapped-tree-a", privateKey);
    expect(sharedKeys.get("tree-a")).toEqual({ wrapped: "wrapped-tree-a" });
    expect(sharedKeys.get("tree-b")).toEqual({ wrapped: "wrapped-tree-b" });
    expect(sharedTrees.get("tree-a")).toEqual({
      shareId: "share-tree-a",
      treeId: "tree-a",
      ownerLabel: "Anna",
    });
    expect(sharedTrees.get("tree-b")?.ownerLabel).toBe("owner@example.com");
  });

  it("skips a grant that fails to unwrap and keeps the rest", async () => {
    mockGetSharedKeys.mockResolvedValue([grant("tree-bad"), grant("tree-good")]);
    mockUnwrapTreeKey.mockImplementation(async (wrapped: string) => {
      if (wrapped === "wrapped-tree-bad") throw new DOMException("bad", "DataError");
      return { wrapped };
    });

    const { sharedKeys, sharedTrees } = await loadSharing(masterKey, new Map());

    expect([...sharedKeys.keys()]).toEqual(["tree-good"]);
    expect([...sharedTrees.keys()]).toEqual(["tree-good"]);
    expect(mockCaptureException).toHaveBeenCalledOnce();
    const reported = mockCaptureException.mock.calls[0][0] as Error;
    expect(reported.message).not.toContain("wrapped-tree-bad");
    expect(reported.message).not.toContain("priv-jwk");
  });

  it("completes pending shares only for trees in the own key ring", async () => {
    mockGetPendingShares.mockResolvedValue([
      {
        share_id: "s-own",
        tree_id: "own-tree",
        recipient_email: "r@x.nl",
        recipient_public_key: "r-pub",
      },
      {
        share_id: "s-other",
        tree_id: "other-tree",
        recipient_email: "r@x.nl",
        recipient_public_key: "r-pub",
      },
    ]);

    await loadSharing(masterKey, new Map([["own-tree", "own-b64"]]));

    expect(mockImportSharePublicKey).toHaveBeenCalledWith("r-pub");
    expect(mockWrapTreeKey).toHaveBeenCalledWith("own-b64", { jwk: "r-pub" });
    expect(mockCompleteShare).toHaveBeenCalledOnce();
    expect(mockCompleteShare).toHaveBeenCalledWith("own-tree", "s-own", "wrapped:own-b64");
  });

  it("treats an already active share as done and keeps completing the rest", async () => {
    mockGetPendingShares.mockResolvedValue([
      { share_id: "s1", tree_id: "t1", recipient_email: "a@x.nl", recipient_public_key: "p1" },
      { share_id: "s2", tree_id: "t2", recipient_email: "b@x.nl", recipient_public_key: "p2" },
    ]);
    mockCompleteShare.mockRejectedValueOnce(await apiError(409, "already_active"));

    await loadSharing(
      masterKey,
      new Map([
        ["t1", "b1"],
        ["t2", "b2"],
      ]),
    );

    expect(mockCompleteShare).toHaveBeenCalledTimes(2);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("keeps received trees when completing a pending share fails", async () => {
    mockGetSharedKeys.mockResolvedValue([grant("tree-a")]);
    mockGetPendingShares.mockResolvedValue([
      { share_id: "s1", tree_id: "t1", recipient_email: "a@x.nl", recipient_public_key: "p1" },
    ]);
    mockCompleteShare.mockRejectedValue(await apiError(500));

    const { sharedKeys } = await loadSharing(masterKey, new Map([["t1", "b1"]]));

    expect(sharedKeys.has("tree-a")).toBe(true);
    expect(mockCaptureException).toHaveBeenCalledOnce();
  });

  it("loadSharing never rejects when an endpoint fails", async () => {
    mockGetKeyPair.mockRejectedValue(await apiError(500));

    const result = await loadSharing(masterKey, new Map([["t1", "b1"]]));

    expect(result.sharedKeys.size).toBe(0);
    expect(result.sharedTrees.size).toBe(0);
    expect(mockGetSharedKeys).not.toHaveBeenCalled();
  });

  it("never rejects when the private key cannot be decrypted", async () => {
    mockDecryptFromApi.mockRejectedValue(new Error("decrypt failed"));

    const result = await loadSharing(masterKey, new Map());

    expect(result.sharedKeys.size).toBe(0);
    expect(result.sharedTrees.size).toBe(0);
  });

  it("never rejects when the shared keys request fails", async () => {
    mockGetSharedKeys.mockRejectedValue(await apiError(503));

    const result = await loadSharing(masterKey, new Map());

    expect(result.sharedKeys.size).toBe(0);
  });
});
