import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import { useSharedTrees } from "./useSharedTrees";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockGetTree = vi.fn();
vi.mock("../lib/api", async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public detail: string,
    ) {
      super(detail);
    }
  }
  return { ApiError, getTree: (id: string) => mockGetTree(id) };
});

const mockDecrypt = vi.fn();
let mockSharedTrees: Map<string, { shareId: string; treeId: string; ownerLabel: string }>;
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    masterKey: {} as CryptoKey,
    sharedTrees: mockSharedTrees,
    decrypt: mockDecrypt,
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function info(treeId: string, ownerLabel: string) {
  return [treeId, { shareId: `s-${treeId}`, treeId, ownerLabel }] as const;
}

describe("useSharedTrees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharedTrees = new Map([info("t1", "Ana"), info("t2", "ben@example.com")]);
    mockGetTree.mockImplementation(async (id: string) => ({ id, encrypted_data: `enc-${id}` }));
    mockDecrypt.mockImplementation(async (data: string) => ({ name: `name of ${data}` }));
  });

  it("decrypts each shared tree and carries the owner label", async () => {
    const { result } = renderHook(() => useSharedTrees(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data).toEqual([
      { id: "t1", name: "name of enc-t1", ownerLabel: "Ana" },
      { id: "t2", name: "name of enc-t2", ownerLabel: "ben@example.com" },
    ]);
  });

  it("drops a tree that returns 404", async () => {
    mockGetTree.mockImplementation(async (id: string) => {
      if (id === "t1") throw new ApiError(404, "not found");
      return { id, encrypted_data: `enc-${id}` };
    });
    const { result } = renderHook(() => useSharedTrees(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].id).toBe("t2");
  });

  it("marks an undecryptable tree as unreadable without failing the list", async () => {
    mockDecrypt.mockImplementation(async (data: string) => {
      if (data === "enc-t1") throw new Error("bad key");
      return { name: "Readable" };
    });
    const { result } = renderHook(() => useSharedTrees(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.[0]).toMatchObject({ id: "t1", unreadable: true });
    expect(result.current.data?.[1]).toMatchObject({ id: "t2", name: "Readable" });
  });

  it("does not fetch when nothing is shared", () => {
    mockSharedTrees = new Map();
    renderHook(() => useSharedTrees(), { wrapper });
    expect(mockGetTree).not.toHaveBeenCalled();
  });
});
