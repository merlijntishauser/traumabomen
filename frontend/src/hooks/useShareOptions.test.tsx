import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShareOptions } from "./useShareOptions";

let mockFlags: Record<string, boolean> | undefined;
vi.mock("./useFeatureFlags", () => ({ useFeatureFlags: () => ({ data: mockFlags }) }));

describe("useShareOptions", () => {
  beforeEach(() => {
    mockFlags = {};
  });

  it("opens Share for every tree when either flag is on", () => {
    for (const flags of [{ tree_sharing: true }, { guest_links: true }]) {
      mockFlags = flags;
      const { result } = renderHook(() => useShareOptions());
      expect(result.current.canShareTree({ has_guest_links: false })).toBe(true);
    }
  });

  it("passes the flags on to the dialog", () => {
    mockFlags = { tree_sharing: true, guest_links: false };
    const { result } = renderHook(() => useShareOptions());
    expect(result.current).toMatchObject({ accountSharing: true, guestLinks: false });
  });

  it("with both flags off, opens Share only for trees that have guest links", () => {
    const { result } = renderHook(() => useShareOptions());
    expect(result.current.canShareTree({ has_guest_links: false })).toBe(false);
    expect(result.current.canShareTree({})).toBe(false);
    expect(result.current.canShareTree({ has_guest_links: true })).toBe(true);
  });

  it("opens nothing extra while the flags load", () => {
    mockFlags = undefined;
    const { result } = renderHook(() => useShareOptions());
    expect(result.current.canShareTree({ has_guest_links: false })).toBe(false);
  });
});
