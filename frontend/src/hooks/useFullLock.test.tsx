import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFullLock } from "./useFullLock";

const clearKey = vi.fn();
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({ clearKey }),
}));

describe("useFullLock", () => {
  it("drops the key and every decrypted query", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["trees", "t1", "persons"], [{ id: "p1", name: "Anna Smith" }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useFullLock(), { wrapper });
    act(() => result.current());

    expect(clearKey).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["trees", "t1", "persons"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
