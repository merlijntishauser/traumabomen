import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import { useRemoveSharedTree } from "./useRemoveSharedTree";

const mockRemoveSharedTree = vi.fn();
vi.mock("../lib/api", async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public detail: string,
    ) {
      super(detail);
    }
  }
  return { ApiError, removeSharedTree: (id: string) => mockRemoveSharedTree(id) };
});

const mockDropSharedTree = vi.fn();
const sharedTrees = new Map([["t1", { shareId: "s1", treeId: "t1", ownerLabel: "Ana" }]]);
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({ sharedTrees, dropSharedTree: mockDropSharedTree }),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const RECEIVED = ["shares", "received"];

describe("useRemoveSharedTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(RECEIVED, [
      { id: "t1", name: "One", ownerLabel: "Ana" },
      { id: "t2", name: "Two", ownerLabel: "Ben" },
    ]);
  });

  it("deletes the share, drops the tree and takes it off the received list", async () => {
    mockRemoveSharedTree.mockResolvedValue(undefined);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRemoveSharedTree(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.remove("t1");
    });
    expect(ok).toBe(true);
    expect(mockRemoveSharedTree).toHaveBeenCalledWith("s1");
    expect(mockDropSharedTree).toHaveBeenCalledWith("t1");
    expect(client.getQueryData<{ id: string }[]>(RECEIVED)?.map((i) => i.id)).toEqual(["t2"]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: RECEIVED });
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("treats an already gone share (404) as removed", async () => {
    mockRemoveSharedTree.mockRejectedValue(new ApiError(404, "Share not found"));
    const { result } = renderHook(() => useRemoveSharedTree(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.remove("t1");
    });
    expect(ok).toBe(true);
    expect(mockDropSharedTree).toHaveBeenCalledWith("t1");
  });

  it("keeps the tree and reports a generic error on failure", async () => {
    mockRemoveSharedTree.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useRemoveSharedTree(), { wrapper });
    let ok = true;
    await act(async () => {
      ok = await result.current.remove("t1");
    });
    expect(ok).toBe(false);
    expect(mockDropSharedTree).not.toHaveBeenCalled();
    expect(result.current.error).toBe("share.errorGeneric");
    expect(client.getQueryData<unknown[]>(RECEIVED)).toHaveLength(2);
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it("reports rate limiting in its own words", async () => {
    mockRemoveSharedTree.mockRejectedValue(new ApiError(429, "Too many requests"));
    const { result } = renderHook(() => useRemoveSharedTree(), { wrapper });
    await act(async () => {
      await result.current.remove("t1");
    });
    expect(result.current.error).toBe("share.errorRateLimited");
  });

  it("does nothing for a tree that is not shared", async () => {
    const { result } = renderHook(() => useRemoveSharedTree(), { wrapper });
    let ok = true;
    await act(async () => {
      ok = await result.current.remove("own-tree");
    });
    expect(ok).toBe(false);
    expect(mockRemoveSharedTree).not.toHaveBeenCalled();
  });
});
