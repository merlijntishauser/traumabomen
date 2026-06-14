import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePatternFocus } from "./usePatternFocus";
import type { DecryptedPattern } from "./useTreeData";
import type { PersonNodeType } from "./useTreeLayout";

function person(id: string): PersonNodeType {
  return { id, type: "person", position: { x: 0, y: 0 }, data: {} } as unknown as PersonNodeType;
}

const pattern: DecryptedPattern = {
  id: "p1",
  name: "Coping",
  description: "",
  color: "#1f77b4",
  person_ids: ["a"],
  linked_entities: [],
};

const patterns = new Map<string, DecryptedPattern>([["p1", pattern]]);
const nodes = [person("a"), person("b")];

describe("usePatternFocus", () => {
  it("starts unfocused and exposes no spotlight", () => {
    const { result } = renderHook(() => usePatternFocus(patterns, nodes, null));
    expect(result.current.focusedPattern).toBeNull();
    expect(result.current.focusColor).toBeNull();
    expect(result.current.visiblePatternIds.size).toBe(0);
    expect(result.current.displayNodes).toBe(nodes);
  });

  it("spotlights a pattern: resolves colour, visible set, and dims non-members", () => {
    const { result } = renderHook(() => usePatternFocus(patterns, nodes, null));

    act(() => result.current.setFocusedPatternId("p1"));

    expect(result.current.focusedPattern?.id).toBe("p1");
    expect(result.current.focusColor).toBeTruthy();
    expect(result.current.visiblePatternIds).toEqual(new Set(["p1"]));
    // Member "a" keeps clarity; non-member "b" is dimmed.
    expect(result.current.displayNodes[1].className).toContain("rf-node-dimmed");
  });

  it("honours an initial focus id", () => {
    const { result } = renderHook(() => usePatternFocus(patterns, nodes, "p1"));
    expect(result.current.focusedPattern?.id).toBe("p1");
  });
});
