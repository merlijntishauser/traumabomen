import { useAutosaveForm } from "../../hooks/useAutosaveForm";
import { useSaveReporter } from "./InspectorStatus";

const noop = () => {};

export interface EntityAutosave<TDraft, TData> {
  /** True while creating: commits are inert and the explicit Add persists. */
  isNew: boolean;
  draft: TDraft;
  /** Change the draft without committing (text input onChange). */
  update: (updater: (draft: TDraft) => TDraft) => void;
  /** Blur handler; inert while creating. */
  commit: () => void;
  /** Selects/toggles: update and commit in one step; update-only while creating. */
  changeAndCommit: (updater: (draft: TDraft) => TDraft) => void;
  /** Debounced commit for textareas; inert while creating. */
  scheduleCommit: () => void;
  /** Serialize the current draft (null = invalid); for the explicit Add. */
  buildData: () => TData | null;
}

/**
 * Autosave wiring for sub-entity forms that serve both editing and creation.
 * Editing an existing entity commits per field like every inspector; creating
 * keeps the whole form local until the explicit Add persists it, so closing
 * a half-filled creation form never writes anything.
 */
export function useEntityAutosave<TSource, TDraft, TData>({
  entity,
  toDraft,
  toData,
  onAutoSave,
}: {
  /** The entity being edited, or null when creating. */
  entity: TSource | null;
  toDraft: (entity: TSource | null) => TDraft;
  toData: (draft: TDraft) => TData | null;
  /** Persist callback for edit-mode commits. */
  onAutoSave: (data: TData) => Promise<unknown> | undefined;
}): EntityAutosave<TDraft, TData> {
  const isNew = entity == null;
  const report = useSaveReporter();

  const form = useAutosaveForm<TSource | null, TDraft, TData>({
    source: entity,
    toDraft,
    toData,
    // While creating, the unmount flush and any stray commit must not write.
    onSave: isNew ? () => undefined : onAutoSave,
    report: isNew ? undefined : report,
  });

  return {
    isNew,
    draft: form.draft,
    update: form.update,
    commit: isNew ? noop : form.commit,
    changeAndCommit: isNew ? form.update : form.updateAndCommit,
    scheduleCommit: isNew ? noop : form.scheduleCommit,
    buildData: () => toData(form.draft),
  };
}
