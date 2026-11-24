import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { EncryptionContext, type SharingStatus } from "../contexts/EncryptionContext";
import type { SharedTreeInfo } from "../lib/sharingLoader";
import { useTreeAccess } from "./useTreeAccess";

type ContextValue = NonNullable<React.ContextType<typeof EncryptionContext>>;

function renderAccess(
  treeId: string,
  sharedTrees: Map<string, SharedTreeInfo>,
  sharingStatus: SharingStatus = "loaded",
) {
  const treeKeys = new Map<string, CryptoKey>([["own-tree", {} as CryptoKey]]);
  for (const id of sharedTrees.keys()) treeKeys.set(id, {} as CryptoKey);
  const value = { sharedTrees, treeKeys, sharingStatus } as unknown as ContextValue;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(EncryptionContext.Provider, { value }, children);
  return renderHook(() => useTreeAccess(treeId), { wrapper });
}

const shared = new Map([
  ["shared-tree", { shareId: "share-1", treeId: "shared-tree", ownerLabel: "Anna" }],
]);

describe("useTreeAccess", () => {
  it("marks a tree shared with the user as read-only, with its owner", () => {
    const { result } = renderAccess("shared-tree", shared);
    expect(result.current).toEqual({ readOnly: true, ownerLabel: "Anna", availability: "shared" });
  });

  it("leaves the user's own tree editable", () => {
    const { result } = renderAccess("own-tree", shared);
    expect(result.current).toEqual({ readOnly: false, ownerLabel: null, availability: "own" });
  });

  it("knows an own tree before sharing has loaded", () => {
    const { result } = renderAccess("own-tree", new Map(), "loading");
    expect(result.current.availability).toBe("own");
  });

  it("holds an unknown tree as pending while sharing loads", () => {
    for (const status of ["idle", "loading"] as const) {
      const { result } = renderAccess("other-tree", new Map(), status);
      expect(result.current.availability).toBe("pending");
      expect(result.current.readOnly).toBe(false);
    }
  });

  it("calls an unknown tree unavailable once sharing has loaded", () => {
    const { result } = renderAccess("other-tree", shared, "loaded");
    expect(result.current.availability).toBe("unavailable");
  });

  it("keeps the same object across renders while access is unchanged", () => {
    const { result, rerender } = renderAccess("shared-tree", shared);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
