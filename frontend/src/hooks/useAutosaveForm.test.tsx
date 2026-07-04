import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type SaveReporter, useAutosaveForm } from "./useAutosaveForm";

interface Source {
  id: string;
  name: string;
  note: string | null;
}

interface Draft {
  name: string;
  note: string;
}

const toDraft = (s: Source): Draft => ({ name: s.name, note: s.note ?? "" });
const toData = (d: Draft): { name: string; note: string | null } | null =>
  d.name.trim() ? { name: d.name, note: d.note || null } : null;

function setup(options?: {
  source?: Source;
  onSave?: (data: { name: string; note: string | null }) => Promise<unknown> | undefined;
  report?: SaveReporter;
  debounceMs?: number;
}) {
  const source = options?.source ?? { id: "s1", name: "Alice", note: null };
  const onSave = options?.onSave ?? vi.fn();
  const hook = renderHook(
    (props: { source: Source }) =>
      useAutosaveForm({
        source: props.source,
        toDraft,
        toData,
        onSave,
        report: options?.report,
        debounceMs: options?.debounceMs,
      }),
    { initialProps: { source } },
  );
  return { hook, onSave, source };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosaveForm", () => {
  it("initializes the draft from the source", () => {
    const { hook } = setup();
    expect(hook.result.current.draft).toEqual({ name: "Alice", note: "" });
  });

  it("update changes the draft without saving", () => {
    const { hook, onSave } = setup();
    act(() => hook.result.current.update((d) => ({ ...d, name: "Bob" })));
    expect(hook.result.current.draft.name).toBe("Bob");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("commit saves a dirty draft", () => {
    const { hook, onSave } = setup();
    act(() => {
      hook.result.current.update((d) => ({ ...d, name: "Bob" }));
      hook.result.current.commit();
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ name: "Bob", note: null });
  });

  it("commit is a no-op when the draft equals the source", () => {
    const { hook, onSave } = setup();
    act(() => hook.result.current.commit());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not re-send identical data twice", () => {
    const { hook, onSave } = setup();
    act(() => {
      hook.result.current.update((d) => ({ ...d, name: "Bob" }));
      hook.result.current.commit();
      hook.result.current.commit();
    });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("updateAndCommit saves in one step", () => {
    const { hook, onSave } = setup();
    act(() => hook.result.current.updateAndCommit((d) => ({ ...d, name: "Carol" })));
    expect(onSave).toHaveBeenCalledWith({ name: "Carol", note: null });
  });

  it("reverts an invalid draft on commit instead of saving", () => {
    const { hook, onSave } = setup();
    act(() => {
      hook.result.current.update((d) => ({ ...d, name: "  " }));
      hook.result.current.commit();
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(hook.result.current.draft.name).toBe("Alice");
  });

  it("scheduleCommit debounces and then saves", () => {
    vi.useFakeTimers();
    const { hook, onSave } = setup({ debounceMs: 500 });
    act(() => {
      hook.result.current.update((d) => ({ ...d, note: "typing" }));
      hook.result.current.scheduleCommit();
    });
    expect(onSave).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).toHaveBeenCalledWith({ name: "Alice", note: "typing" });
  });

  it("a new scheduleCommit resets the debounce window", () => {
    vi.useFakeTimers();
    const { hook, onSave } = setup({ debounceMs: 500 });
    act(() => {
      hook.result.current.update((d) => ({ ...d, note: "a" }));
      hook.result.current.scheduleCommit();
      vi.advanceTimersByTime(400);
      hook.result.current.update((d) => ({ ...d, note: "ab" }));
      hook.result.current.scheduleCommit();
      vi.advanceTimersByTime(400);
    });
    expect(onSave).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ name: "Alice", note: "ab" });
  });

  it("commit cancels a pending debounce (no double save)", () => {
    vi.useFakeTimers();
    const { hook, onSave } = setup({ debounceMs: 500 });
    act(() => {
      hook.result.current.update((d) => ({ ...d, note: "n" }));
      hook.result.current.scheduleCommit();
      hook.result.current.commit();
      vi.advanceTimersByTime(1000);
    });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("flushes a pending edit on unmount", () => {
    const { hook, onSave } = setup();
    act(() => hook.result.current.update((d) => ({ ...d, name: "Zed" })));
    hook.unmount();
    expect(onSave).toHaveBeenCalledWith({ name: "Zed", note: null });
  });

  it("unmount without pending edits saves nothing", () => {
    const { hook, onSave } = setup();
    hook.unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("reports saved when onSave resolves", async () => {
    const report = vi.fn();
    const { hook } = setup({ onSave: () => Promise.resolve("ok"), report });
    await act(async () => {
      hook.result.current.updateAndCommit((d) => ({ ...d, name: "Bob" }));
    });
    expect(report).toHaveBeenCalledWith("saved");
  });

  it("reports saved for a void onSave", () => {
    const report = vi.fn();
    const { hook } = setup({ onSave: vi.fn(), report });
    act(() => hook.result.current.updateAndCommit((d) => ({ ...d, name: "Bob" })));
    expect(report).toHaveBeenCalledWith("saved");
  });

  it("reports error on rejection and retries on the next commit", async () => {
    const report = vi.fn();
    const onSave = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce("ok");
    const { hook } = setup({ onSave, report });

    await act(async () => {
      hook.result.current.updateAndCommit((d) => ({ ...d, name: "Bob" }));
    });
    expect(report).toHaveBeenCalledWith("error");

    // Same data commits again because the failed payload was forgotten.
    await act(async () => {
      hook.result.current.commit();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith("saved");
  });

  it("uses the latest source as the dirty baseline after a refetch", () => {
    const { hook, onSave } = setup();
    // Simulate refetch-after-save delivering the same values.
    hook.rerender({ source: { id: "s1", name: "Alice", note: null } });
    act(() => hook.result.current.commit());
    expect(onSave).not.toHaveBeenCalled();
  });
});
