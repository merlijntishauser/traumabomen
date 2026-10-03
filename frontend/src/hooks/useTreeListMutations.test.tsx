import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTreeListMutations } from "./useTreeListMutations";

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "nl" } }),
}));

const MASTER_KEY = {} as CryptoKey;
let mockMasterKey: CryptoKey | null = MASTER_KEY;
const mockEncrypt = vi.fn();
const mockAddTreeKey = vi.fn();
const mockRemoveTreeKey = vi.fn();
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    encrypt: mockEncrypt,
    masterKey: mockMasterKey,
    addTreeKey: mockAddTreeKey,
    removeTreeKey: mockRemoveTreeKey,
  }),
}));

const mockCreateTree = vi.fn();
const mockDeleteTree = vi.fn();
const mockUpdateTree = vi.fn();
const mockModifyKeyRing = vi.fn();
vi.mock("../lib/api", () => ({
  createTree: (...args: unknown[]) => mockCreateTree(...args),
  deleteTree: (...args: unknown[]) => mockDeleteTree(...args),
  updateTree: (...args: unknown[]) => mockUpdateTree(...args),
  modifyKeyRing: (...args: unknown[]) => mockModifyKeyRing(...args),
}));

const TREE_KEY = { kind: "tree-key" } as unknown as CryptoKey;
const mockEncryptForApi = vi.fn();
vi.mock("../lib/crypto", () => ({
  generateTreeKey: () => Promise.resolve({ key: TREE_KEY, base64: "tree-key-b64" }),
  encryptForApi: (...args: unknown[]) => mockEncryptForApi(...args),
}));

const mockCreateDemoTree = vi.fn();
vi.mock("../lib/createDemoTree", () => ({
  createDemoTree: (...args: unknown[]) => mockCreateDemoTree(...args),
}));

vi.mock("../lib/compactId", () => ({
  uuidToCompact: (id: string) => `c-${id}`,
}));

/** Apply the transform handed to modifyKeyRing to a given key ring. */
function keyRingAfter(entries: Record<string, string>): Record<string, string> {
  const transform = mockModifyKeyRing.mock.calls[0][1] as (
    e: Record<string, string>,
  ) => Record<string, string>;
  return transform(entries);
}

function setup() {
  const callbacks = { onCreated: vi.fn(), onRenamed: vi.fn(), onDeleted: vi.fn() };
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useTreeListMutations(callbacks), { wrapper });
  return { result, callbacks, invalidate };
}

describe("useTreeListMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMasterKey = MASTER_KEY;
    mockSearchParams = new URLSearchParams();
    mockModifyKeyRing.mockResolvedValue(undefined);
    mockEncryptForApi.mockResolvedValue("encrypted-name");
  });

  it("creates a tree under its own key, records it in the key ring, and opens it", async () => {
    mockCreateTree.mockResolvedValue({ id: "tree-1" });
    const { result, callbacks, invalidate } = setup();

    await act(() => result.current.createMutation.mutateAsync("Mum's side"));

    expect(mockEncryptForApi).toHaveBeenCalledWith({ name: "Mum's side" }, TREE_KEY);
    expect(mockCreateTree).toHaveBeenCalledWith({ encrypted_data: "encrypted-name" });
    expect(mockAddTreeKey).toHaveBeenCalledWith("tree-1", TREE_KEY, "tree-key-b64");
    expect(mockModifyKeyRing.mock.calls[0][0]).toBe(MASTER_KEY);
    expect(keyRingAfter({ old: "k" })).toEqual({ old: "k", "tree-1": "tree-key-b64" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["trees"] });
    expect(callbacks.onCreated).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/trees/c-tree-1");
  });

  it("does not report success or navigate when creating fails", async () => {
    mockCreateTree.mockRejectedValue(new Error("offline"));
    const { result, callbacks } = setup();

    await act(async () => {
      await result.current.createMutation.mutateAsync("Mum's side").catch(() => {});
    });

    expect(callbacks.onCreated).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockModifyKeyRing).not.toHaveBeenCalled();
  });

  it("creates the demo tree in the UI language and opens it", async () => {
    mockCreateDemoTree.mockResolvedValue("demo-1");
    const { result } = setup();

    await act(() => result.current.demoMutation.mutateAsync());

    expect(mockCreateDemoTree).toHaveBeenCalledWith(expect.any(Function), "nl");
    // The encrypt function handed to the demo builder is bound to the new tree key.
    const boundEncrypt = mockCreateDemoTree.mock.calls[0][0] as (d: unknown) => unknown;
    await boundEncrypt({ x: 1 });
    expect(mockEncryptForApi).toHaveBeenCalledWith({ x: 1 }, TREE_KEY);
    expect(mockAddTreeKey).toHaveBeenCalledWith("demo-1", TREE_KEY, "tree-key-b64");
    expect(keyRingAfter({})).toEqual({ "demo-1": "tree-key-b64" });
    expect(mockNavigate).toHaveBeenCalledWith("/trees/c-demo-1");
  });

  it("renames by encrypting the new name under the tree's key", async () => {
    mockEncrypt.mockResolvedValue("encrypted-new-name");
    mockUpdateTree.mockResolvedValue({});
    const { result, callbacks } = setup();

    await act(() => result.current.renameMutation.mutateAsync({ id: "tree-1", name: "New" }));

    expect(mockEncrypt).toHaveBeenCalledWith({ name: "New" }, "tree-1");
    expect(mockUpdateTree).toHaveBeenCalledWith("tree-1", {
      encrypted_data: "encrypted-new-name",
    });
    expect(callbacks.onRenamed).toHaveBeenCalledTimes(1);
  });

  it("deletes a tree and drops its key from memory and the key ring", async () => {
    mockDeleteTree.mockResolvedValue(undefined);
    const { result, callbacks } = setup();

    await act(() => result.current.deleteMutation.mutateAsync("tree-1"));

    expect(mockDeleteTree).toHaveBeenCalledWith("tree-1");
    expect(mockRemoveTreeKey).toHaveBeenCalledWith("tree-1");
    const before = { "tree-1": "a", "tree-2": "b" };
    expect(keyRingAfter(before)).toEqual({ "tree-2": "b" });
    expect(before).toEqual({ "tree-1": "a", "tree-2": "b" });
    expect(callbacks.onDeleted).toHaveBeenCalledTimes(1);
  });

  it("creates the demo once when arriving with ?start=demo and drops the param", async () => {
    mockSearchParams = new URLSearchParams("start=demo");
    mockCreateDemoTree.mockResolvedValue("demo-1");
    const { result } = setup();

    await waitFor(() => expect(mockCreateDemoTree).toHaveBeenCalledTimes(1));
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
    await waitFor(() => expect(result.current.demoMutation.isSuccess).toBe(true));
    expect(mockCreateDemoTree).toHaveBeenCalledTimes(1);
  });

  it("waits for the key before acting on ?start=demo", () => {
    mockSearchParams = new URLSearchParams("start=demo");
    mockMasterKey = null;
    setup();

    expect(mockSetSearchParams).not.toHaveBeenCalled();
    expect(mockCreateDemoTree).not.toHaveBeenCalled();
  });
});
