import { describe, expect, it } from "vitest";
import { applyPatternFocusToNodes } from "./usePatternFocus";
import type { PersonNodeType, SiblingGroupNodeType } from "./useTreeLayout";

function person(id: string, className?: string): PersonNodeType {
  return {
    id,
    type: "person",
    position: { x: 0, y: 0 },
    data: {},
    ...(className ? { className } : {}),
  } as unknown as PersonNodeType;
}

function siblingGroup(id: string): SiblingGroupNodeType {
  return {
    id,
    type: "siblingGroup",
    position: { x: 0, y: 0 },
    data: {},
  } as unknown as SiblingGroupNodeType;
}

function focusColorOf(node: PersonNodeType | SiblingGroupNodeType): string | undefined {
  return (node.data as { focusColor?: string }).focusColor;
}

describe("applyPatternFocusToNodes", () => {
  it("returns the same array reference when nothing is focused", () => {
    const nodes = [person("a"), person("b")];
    expect(applyPatternFocusToNodes(nodes, null, null)).toBe(nodes);
  });

  it("recolours members and dims everyone else", () => {
    const out = applyPatternFocusToNodes([person("a"), person("b")], new Set(["a"]), "#4f46e5");
    expect(focusColorOf(out[0])).toBe("#4f46e5");
    expect(out[0].className ?? "").not.toContain("rf-node-dimmed");
    expect(focusColorOf(out[1])).toBeUndefined();
    expect(out[1].className).toContain("rf-node-dimmed");
  });

  it("preserves an existing className when dimming a node", () => {
    const out = applyPatternFocusToNodes([person("b", "existing")], new Set(["a"]), "#000");
    expect(out[0].className).toBe("existing rf-node-dimmed");
  });

  it("dims sibling-group nodes (never members) without touching their data", () => {
    const out = applyPatternFocusToNodes([siblingGroup("sg1")], new Set(["sg1"]), "#000");
    expect(out[0].className).toContain("rf-node-dimmed");
    expect(focusColorOf(out[0])).toBeUndefined();
  });
});
