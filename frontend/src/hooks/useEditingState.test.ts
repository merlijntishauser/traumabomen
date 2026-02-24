import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEditingState } from "./useEditingState";

describe("useEditingState", () => {
  it("starts with no editing state", () => {
    const { result } = renderHook(() => useEditingState());
    expect(result.current.editingId).toBeNull();
    expect(result.current.showNew).toBe(false);
    expect(result.current.isEditing).toBe(false);
  });

  it("initializes with initialEditId", () => {
    const { result } = renderHook(() => useEditingState("evt-1"));
    expect(result.current.editingId).toBe("evt-1");
    expect(result.current.isEditing).toBe(true);
  });

  it("setEditingId makes isEditing true", () => {
    const { result } = renderHook(() => useEditingState());
    act(() => result.current.setEditingId("evt-2"));
    expect(result.current.editingId).toBe("evt-2");
    expect(result.current.isEditing).toBe(true);
  });

  it("setShowNew makes isEditing true", () => {
    const { result } = renderHook(() => useEditingState());
    act(() => result.current.setShowNew(true));
    expect(result.current.showNew).toBe(true);
    expect(result.current.isEditing).toBe(true);
  });

  it("clearEditing resets both states", () => {
    const { result } = renderHook(() => useEditingState());
    act(() => {
      result.current.setEditingId("evt-3");
      result.current.setShowNew(true);
    });
    expect(result.current.isEditing).toBe(true);

    act(() => result.current.clearEditing());
    expect(result.current.editingId).toBeNull();
    expect(result.current.showNew).toBe(false);
    expect(result.current.isEditing).toBe(false);
  });

  it("updates when initialEditId changes", () => {
    const { result, rerender } = renderHook(({ id }: { id?: string }) => useEditingState(id), {
      initialProps: { id: undefined as string | undefined },
    });
    expect(result.current.editingId).toBeNull();

    rerender({ id: "evt-4" });
    expect(result.current.editingId).toBe("evt-4");
    expect(result.current.showNew).toBe(false);
  });
});
