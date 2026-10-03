import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useRegistrationOpen } from "./useRegistrationOpen";

const mockGetRegistrationStatus = vi.fn();
vi.mock("../lib/api", () => ({
  getRegistrationStatus: () => mockGetRegistrationStatus(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useRegistrationOpen", () => {
  it("is undefined until the status is known", () => {
    mockGetRegistrationStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useRegistrationOpen(), { wrapper });
    expect(result.current).toBeUndefined();
  });

  it("reports a full beta", async () => {
    mockGetRegistrationStatus.mockResolvedValue({ open: false });
    const { result } = renderHook(() => useRegistrationOpen(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("stays undefined when the check fails, so callers treat it as open", async () => {
    mockGetRegistrationStatus.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useRegistrationOpen(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeUndefined();
  });
});
