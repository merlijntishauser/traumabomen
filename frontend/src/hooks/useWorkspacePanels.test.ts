import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspacePanels } from "./useWorkspacePanels";

describe("useWorkspacePanels", () => {
  it("initializes with all panels closed and no selection", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    expect(result.current.selectedPersonId).toBeNull();
    expect(result.current.patternPanelOpen).toBe(false);
    expect(result.current.journalPanelOpen).toBe(false);
    expect(result.current.hoveredPatternId).toBeNull();
    expect(result.current.initialSection).toBeNull();
    expect(result.current.journalInitialPrompt).toBe("");
    expect(result.current.journalInitialLinkedRef).toBeUndefined();
  });

  it("respects initialPatternPanelOpen option", () => {
    const { result } = renderHook(() => useWorkspacePanels({ initialPatternPanelOpen: true }));
    expect(result.current.patternPanelOpen).toBe(true);
  });

  it("sets selectedPersonId", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    act(() => result.current.setSelectedPersonId("person-1"));
    expect(result.current.selectedPersonId).toBe("person-1");
  });

  it("toggles pattern panel", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    act(() => result.current.setPatternPanelOpen(true));
    expect(result.current.patternPanelOpen).toBe(true);
    act(() => result.current.setPatternPanelOpen((v) => !v));
    expect(result.current.patternPanelOpen).toBe(false);
  });

  it("toggles journal panel", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    act(() => result.current.setJournalPanelOpen(true));
    expect(result.current.journalPanelOpen).toBe(true);
  });

  it("openJournal sets prompt, linkedRef, and opens panel", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    const linkedRef = { entity_type: "person" as const, entity_id: "p1" };
    act(() => result.current.openJournal("test prompt", linkedRef));
    expect(result.current.journalPanelOpen).toBe(true);
    expect(result.current.journalInitialPrompt).toBe("test prompt");
    expect(result.current.journalInitialLinkedRef).toEqual(linkedRef);
  });

  it("openJournal works without linkedRef", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    act(() => result.current.openJournal("reflection prompt"));
    expect(result.current.journalPanelOpen).toBe(true);
    expect(result.current.journalInitialPrompt).toBe("reflection prompt");
    expect(result.current.journalInitialLinkedRef).toBeUndefined();
  });

  it("sets hoveredPatternId", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    act(() => result.current.setHoveredPatternId("pat-1"));
    expect(result.current.hoveredPatternId).toBe("pat-1");
  });

  it("sets initialSection", () => {
    const { result } = renderHook(() => useWorkspacePanels());
    act(() => result.current.setInitialSection("relationships"));
    expect(result.current.initialSection).toBe("relationships");
  });
});
