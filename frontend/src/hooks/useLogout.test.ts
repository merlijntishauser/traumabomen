import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLogout } from "./useLogout";

const mockNavigate = vi.fn();
const mockClearKey = vi.fn();
const mockLogout = vi.fn();
const mockClearTokens = vi.fn();
const mockGetRefreshToken = vi.fn();
const mockClearWasAuthenticated = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    clearKey: mockClearKey,
  }),
}));

vi.mock("../lib/api", () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
  clearTokens: () => mockClearTokens(),
  clearWasAuthenticated: () => mockClearWasAuthenticated(),
  getRefreshToken: () => mockGetRefreshToken(),
}));

const queryClient = new QueryClient();

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useLogout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("clears tokens and key before navigating, then revokes refresh token", () => {
    mockGetRefreshToken.mockReturnValue("refresh-abc");
    const clearSpy = vi.spyOn(queryClient, "clear");
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => {
      result.current();
    });

    expect(mockClearTokens).toHaveBeenCalledOnce();
    expect(mockClearWasAuthenticated).toHaveBeenCalledOnce();
    expect(mockClearKey).toHaveBeenCalledOnce();
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
    expect(mockLogout).toHaveBeenCalledWith("refresh-abc");

    clearSpy.mockRestore();
  });

  it("skips server logout when no refresh token exists", () => {
    mockGetRefreshToken.mockReturnValue(null);
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => {
      result.current();
    });

    expect(mockClearTokens).toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("returns the same callback reference on re-renders", () => {
    const { result, rerender } = renderHook(() => useLogout(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
