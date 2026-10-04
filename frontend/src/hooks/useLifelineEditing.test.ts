import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CREATE_NEW, useLifelineEditing } from "./useLifelineEditing";

describe("useLifelineEditing", () => {
  it("starts closed without a request", () => {
    const { result } = renderHook(() => useLifelineEditing(null));
    expect(result.current.editing).toBeNull();
  });

  it("opens the requested entity", () => {
    const { result } = renderHook(() => useLifelineEditing("life_event", "le1"));
    expect(result.current.editing).toEqual({ kind: "life_event", id: "le1" });
    expect(result.current.isOpen("life_event", "le1")).toBe(true);
    expect(result.current.isOpen("trauma_event", "le1")).toBe(false);
  });

  it("opens a new form for the CREATE_NEW sentinel", () => {
    const { result } = renderHook(() => useLifelineEditing("classification", CREATE_NEW));
    expect(result.current.editing).toEqual({ kind: "classification", id: null });
    expect(result.current.isOpen("classification", null)).toBe(true);
  });

  it("ignores sections that are not on the lifeline", () => {
    const { result } = renderHook(() => useLifelineEditing("relationships", "r1"));
    expect(result.current.editing).toBeNull();
  });

  it("ignores a section without an entity", () => {
    const { result } = renderHook(() => useLifelineEditing("trauma_event"));
    expect(result.current.editing).toBeNull();
  });

  it("toggles an entry open and closed", () => {
    const { result } = renderHook(() => useLifelineEditing(null));
    act(() => result.current.toggle("trauma_event", "e1"));
    expect(result.current.editing).toEqual({ kind: "trauma_event", id: "e1" });
    act(() => result.current.toggle("trauma_event", "e1"));
    expect(result.current.editing).toBeNull();
  });

  it("switches to another entry when toggling a different one", () => {
    const { result } = renderHook(() => useLifelineEditing(null));
    act(() => result.current.toggle("trauma_event", "e1"));
    act(() => result.current.toggle("life_event", "le1"));
    expect(result.current.editing).toEqual({ kind: "life_event", id: "le1" });
  });

  it("starts a new entry and closes it", () => {
    const { result } = renderHook(() => useLifelineEditing(null));
    act(() => result.current.startNew("turning_point"));
    expect(result.current.editing).toEqual({ kind: "turning_point", id: null });
    act(() => result.current.close());
    expect(result.current.editing).toBeNull();
  });

  it("follows a new request while mounted", () => {
    const { result, rerender } = renderHook(
      ({ section, id }: { section: string | null; id?: string }) => useLifelineEditing(section, id),
      { initialProps: { section: null as string | null, id: undefined as string | undefined } },
    );
    act(() => result.current.toggle("trauma_event", "e1"));
    rerender({ section: "life_event", id: CREATE_NEW });
    expect(result.current.editing).toEqual({ kind: "life_event", id: null });
  });

  it("keeps the user's choice when the request does not change", () => {
    const { result, rerender } = renderHook(() => useLifelineEditing("life_event", "le1"));
    act(() => result.current.close());
    rerender();
    expect(result.current.editing).toBeNull();
  });

  it("starts over when a different person is shown", () => {
    const { result, rerender } = renderHook(
      ({ personId }: { personId: string }) => useLifelineEditing(null, undefined, personId),
      { initialProps: { personId: "a" } },
    );
    act(() => result.current.startNew("trauma_event"));
    rerender({ personId: "b" });
    expect(result.current.editing).toBeNull();
  });

  it("opens the new person's requested entity", () => {
    const { result, rerender } = renderHook(
      ({ personId, id }: { personId: string; id?: string }) =>
        useLifelineEditing(id ? "life_event" : null, id, personId),
      { initialProps: { personId: "a", id: undefined as string | undefined } },
    );
    act(() => result.current.toggle("trauma_event", "e1"));
    rerender({ personId: "b", id: "le2" });
    expect(result.current.editing).toEqual({ kind: "life_event", id: "le2" });
  });
});
