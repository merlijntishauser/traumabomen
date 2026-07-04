import { useCallback, useEffect, useRef, useState } from "react";

export type SaveOutcome = "saved" | "error";
export type SaveReporter = (outcome: SaveOutcome) => void;

export interface UseAutosaveFormOptions<TSource, TDraft, TData> {
  /** Last-saved entity (server state, decrypted). */
  source: TSource;
  /** Build the editable draft from the saved entity. */
  toDraft: (source: TSource) => TDraft;
  /** Serialize the draft for persisting; null means invalid, never persist. */
  toData: (draft: TDraft) => TData | null;
  /**
   * Persist callback (today's save path: encrypt, PUT). When it returns a
   * promise, the outcome is reported; a rejection keeps the draft dirty so
   * the next commit retries.
   */
  onSave: (data: TData) => Promise<unknown> | undefined;
  /** Receives "saved" / "error" for the panel's status whisper. */
  report?: SaveReporter;
  /** Debounce for scheduleCommit (textareas). */
  debounceMs?: number;
}

export interface AutosaveForm<TDraft> {
  draft: TDraft;
  /** Update the draft without committing (text input onChange). */
  update: (updater: (draft: TDraft) => TDraft) => void;
  /** Update and commit in one step (selects, checkboxes). */
  updateAndCommit: (updater: (draft: TDraft) => TDraft) => void;
  /** Commit now when dirty and valid (blur). Invalid drafts revert. */
  commit: () => void;
  /** Commit after debounceMs of quiet (textarea onChange, after update). */
  scheduleCommit: () => void;
}

/**
 * Autosave form state for inspector panels.
 *
 * - Commits are dirty-gated: nothing is sent unless the serialized draft
 *   differs from the serialized source.
 * - Invalid drafts (toData returns null) never persist; committing one
 *   reverts the draft to the last saved state. The server never receives a
 *   worse state than it has.
 * - Pending edits flush on unmount, which covers tab switches, panel close,
 *   and entity switches (key the consuming component by entity id so the
 *   unmounting instance flushes with its own save closure).
 */
export function useAutosaveForm<TSource, TDraft, TData>({
  source,
  toDraft,
  toData,
  onSave,
  report,
  debounceMs = 800,
}: UseAutosaveFormOptions<TSource, TDraft, TData>): AutosaveForm<TDraft> {
  const [draft, setDraft] = useState<TDraft>(() => toDraft(source));
  const draftRef = useRef(draft);

  // Latest inputs, so commit (also called from unmount cleanup and timers)
  // always uses current serializers and the current baseline.
  const optionsRef = useRef({ source, toDraft, toData, onSave, report });
  optionsRef.current = { source, toDraft, toData, onSave, report };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialized payload of the last in-flight save, so a blur right after a
  // commit does not re-send identical data while the refetch is pending.
  const lastSentRef = useRef<string | null>(null);

  const commit = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const { source, toDraft, toData, onSave, report } = optionsRef.current;
    const data = toData(draftRef.current);
    if (data == null) {
      // Invalid: revert to the last saved state rather than persisting it.
      const reverted = toDraft(source);
      draftRef.current = reverted;
      setDraft(reverted);
      return;
    }
    const serialized = JSON.stringify(data);
    const baseline = toData(toDraft(source));
    if (baseline != null && serialized === JSON.stringify(baseline)) return;
    if (serialized === lastSentRef.current) return;
    lastSentRef.current = serialized;
    const result = onSave(data) as Promise<unknown> | undefined;
    if (result && typeof result.then === "function") {
      result.then(
        () => report?.("saved"),
        () => {
          // Keep the draft dirty: clearing lastSent lets the next commit retry.
          lastSentRef.current = null;
          report?.("error");
        },
      );
    } else {
      report?.("saved");
    }
  }, []);

  const update = useCallback((updater: (draft: TDraft) => TDraft) => {
    const next = updater(draftRef.current);
    draftRef.current = next;
    setDraft(next);
  }, []);

  const updateAndCommit = useCallback(
    (updater: (draft: TDraft) => TDraft) => {
      update(updater);
      commit();
    },
    [update, commit],
  );

  const scheduleCommit = useCallback(() => {
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commit();
    }, debounceMs);
  }, [commit, debounceMs]);

  // Flush pending edits on unmount: covers tab switch, panel close, and
  // entity switch (via key). The cleanup closure holds this instance's own
  // onSave, so a switch saves to the right entity.
  useEffect(() => () => commit(), [commit]);

  return { draft, update, updateAndCommit, commit, scheduleCommit };
}
