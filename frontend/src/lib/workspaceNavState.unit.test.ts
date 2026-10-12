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

  it("spotlights a pattern without opening its edit panel", () => {
    expect(workspaceNavOptions({ openPatternId: "p1" })).toEqual({
      openPatternId: "p1",
      initialPatternPanelOpen: false,
      initialPatternCreating: false,
    });
  });

  it("opens the edit panel when asked to edit the pattern", () => {
    expect(workspaceNavOptions({ openPatternId: "p1", editPattern: true })).toEqual({
      openPatternId: "p1",
      initialPatternPanelOpen: true,
      initialPatternCreating: false,
    });
  });

  it("does not open the edit panel without a pattern", () => {
    expect(workspaceNavOptions({ editPattern: true }).initialPatternPanelOpen).toBe(false);
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
