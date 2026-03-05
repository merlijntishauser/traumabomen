import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFeatureFlags } from "./useFeatureFlags";

const mockGetFeatureFlags = vi.fn();
vi.mock("../lib/api", () => ({
  getFeatureFlags: (...args: unknown[]) => mockGetFeatureFlags(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    QueryClientProvider({ client: queryClient, children });
}

describe("useFeatureFlags", () => {
  it("fetches feature flags from the API", async () => {
    mockGetFeatureFlags.mockResolvedValueOnce({ watercolor_theme: true });

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ watercolor_theme: true });
    expect(mockGetFeatureFlags).toHaveBeenCalledOnce();
  });

  it("returns undefined data while loading", () => {
    mockGetFeatureFlags.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("handles API errors", async () => {
    mockGetFeatureFlags.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
