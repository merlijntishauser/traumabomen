import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useLogout } from "./useLogout";

const mockNavigate = vi.fn();
const mockClearKey = vi.fn();
const mockLogout = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    clearKey: mockClearKey,
  }),
}));

vi.mock("../lib/api", () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
}));

const queryClient = new QueryClient();

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useLogout", () => {
  it("calls logout, clearKey, clears query cache, and navigates to /login", () => {
    const clearSpy = vi.spyOn(queryClient, "clear");
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => {
      result.current();
    });

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockClearKey).toHaveBeenCalledOnce();
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith("/login");

    clearSpy.mockRestore();
  });

  it("returns the same callback reference on re-renders", () => {
    const { result, rerender } = renderHook(() => useLogout(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
