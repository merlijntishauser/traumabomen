import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { EncryptionContext } from "../contexts/EncryptionContext";
import type { SharedTreeInfo } from "../lib/sharingLoader";
import { useTreeAccess } from "./useTreeAccess";

type ContextValue = NonNullable<React.ContextType<typeof EncryptionContext>>;

function renderAccess(treeId: string, sharedTrees: Map<string, SharedTreeInfo>) {
  const value = { sharedTrees } as unknown as ContextValue;
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
    expect(result.current).toEqual({ readOnly: true, ownerLabel: "Anna" });
  });

  it("leaves the user's own tree editable", () => {
    const { result } = renderAccess("own-tree", shared);
    expect(result.current).toEqual({ readOnly: false, ownerLabel: null });
  });

  it("keeps the same object across renders while access is unchanged", () => {
    const { result, rerender } = renderAccess("shared-tree", shared);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
