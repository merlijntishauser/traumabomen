import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShareOptions } from "./useShareOptions";

let mockFlags: Record<string, boolean> | undefined;
vi.mock("./useFeatureFlags", () => ({ useFeatureFlags: () => ({ data: mockFlags }) }));

const mockTreesWithLinks = vi.fn();
vi.mock("./useGuestLinks", () => ({
  useTreesWithGuestLinks: (ids: string[], enabled: boolean) => mockTreesWithLinks(ids, enabled),
}));

describe("useShareOptions", () => {
  beforeEach(() => {
    mockFlags = {};
    mockTreesWithLinks.mockReset().mockReturnValue(new Set(["t2"]));
  });

  it("opens Share for every tree when either flag is on, without asking for links", () => {
    for (const flags of [{ tree_sharing: true }, { guest_links: true }]) {
      mockFlags = flags;
      const { result } = renderHook(() => useShareOptions(["t1", "t2"]));
      expect(result.current.canShareTree("t1")).toBe(true);
      expect(mockTreesWithLinks).toHaveBeenLastCalledWith(["t1", "t2"], false);
    }
  });

  it("passes the flags on to the dialog", () => {
    mockFlags = { tree_sharing: true, guest_links: false };
    const { result } = renderHook(() => useShareOptions([]));
    expect(result.current).toMatchObject({ accountSharing: true, guestLinks: false });
  });

  it("with both flags off, opens Share only for trees that have guest links", () => {
    const { result } = renderHook(() => useShareOptions(["t1", "t2"]));
    expect(mockTreesWithLinks).toHaveBeenLastCalledWith(["t1", "t2"], true);
    expect(result.current.canShareTree("t1")).toBe(false);
    expect(result.current.canShareTree("t2")).toBe(true);
  });

  it("asks for links only once the flags are known", () => {
    mockFlags = undefined;
    renderHook(() => useShareOptions(["t1"]));
    expect(mockTreesWithLinks).toHaveBeenLastCalledWith(["t1"], false);
  });
});
