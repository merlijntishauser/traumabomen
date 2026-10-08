import { describe, expect, it } from "vitest";
import { workspaceNavOptions } from "./workspaceNavState";

describe("workspaceNavOptions", () => {
  it("opens nothing without navigation state", () => {
    expect(workspaceNavOptions(null)).toEqual({
      openPatternId: undefined,
      initialPatternPanelOpen: false,
      initialPatternCreating: false,
    });
  });

  it("opens the pattern panel on a pattern", () => {
    expect(workspaceNavOptions({ openPatternId: "p1" })).toEqual({
      openPatternId: "p1",
      initialPatternPanelOpen: true,
      initialPatternCreating: false,
    });
  });

  it("asks for the new-pattern form", () => {
    expect(workspaceNavOptions({ newPattern: true }).initialPatternCreating).toBe(true);
  });

  it("ignores state of the wrong shape", () => {
    expect(workspaceNavOptions({ openPatternId: 42, newPattern: "yes" })).toEqual({
      openPatternId: undefined,
      initialPatternPanelOpen: false,
      initialPatternCreating: false,
    });
  });
});
