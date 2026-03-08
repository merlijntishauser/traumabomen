import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, useAdminData } from "./useAdminData";

vi.mock("../lib/api");
vi.mock("./useFeatureFlags", () => ({
  featureQueryKeys: { flags: () => ["features"] },
}));

let queryClient: QueryClient;

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatDate", () => {
  it("formats an ISO date string with locale en", () => {
    const result = formatDate("2026-01-15T10:00:00Z", "en");
    expect(result).toContain("2026");
    expect(result).toContain("15");
  });

  it("formats an ISO date string with locale nl", () => {
    const result = formatDate("2026-03-08T00:00:00Z", "nl");
    expect(result).toContain("2026");
    expect(result).toContain("8");
  });
});

describe("useAdminData", () => {
  it("returns all query and mutation objects", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // All query objects present
    expect(result.current.overview).toBeDefined();
    expect(result.current.funnel).toBeDefined();
    expect(result.current.growth).toBeDefined();
    expect(result.current.activity).toBeDefined();
    expect(result.current.retention).toBeDefined();
    expect(result.current.usage).toBeDefined();
    expect(result.current.users).toBeDefined();
    expect(result.current.feedback).toBeDefined();
    expect(result.current.waitlist).toBeDefined();
    expect(result.current.waitlistCapacity).toBeDefined();

    // All mutation objects present
    expect(result.current.approveMutation).toBeDefined();
    expect(result.current.deleteMutation).toBeDefined();
    expect(result.current.markReadMutation).toBeDefined();
    expect(result.current.deleteFeedbackMutation).toBeDefined();
    expect(result.current.features).toBeDefined();
    expect(result.current.updateFeatureMutation).toBeDefined();
  });

  it("reports not loading once queries settle", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("approveMutation invalidates waitlist queries on success", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.approveMutation.mutateAsync("entry-1");

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "waitlist"] });
      expect(spy).toHaveBeenCalledWith({
        queryKey: ["admin", "waitlist-capacity"],
      });
    });
  });

  it("deleteMutation invalidates waitlist query on success", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.deleteMutation.mutateAsync("entry-1");

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "waitlist"] });
    });
  });

  it("markReadMutation invalidates feedback query on success", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.markReadMutation.mutateAsync("fb-1");

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "feedback"] });
    });
  });

  it("deleteFeedbackMutation invalidates feedback query on success", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.deleteFeedbackMutation.mutateAsync("fb-1");

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "feedback"] });
    });
  });

  it("updateFeatureMutation invalidates features queries on success", async () => {
    const { result } = renderHook(() => useAdminData(), {
      wrapper: createWrapper(),
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.updateFeatureMutation.mutateAsync({
      key: "test_flag",
      audience: "all" as const,
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "features"] });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["features"] });
    });
  });
});
