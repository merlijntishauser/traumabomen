import { act, renderHook } from "@testing-library/react";
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

describe("useLogout", () => {
  it("calls logout, clearKey, and navigates to /login", () => {
    const { result } = renderHook(() => useLogout());

    act(() => {
      result.current();
    });

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockClearKey).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("returns the same callback reference on re-renders", () => {
    const { result, rerender } = renderHook(() => useLogout());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
