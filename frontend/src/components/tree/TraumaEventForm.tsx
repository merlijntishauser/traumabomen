import { useTranslation } from "react-i18next";
import type { DecryptedEvent, DecryptedPerson } from "../../hooks/useTreeData";
import type { TraumaEvent } from "../../types/domain";
import { TraumaCategory } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { blurOnEnter } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { useSaveReporter } from "../inspector/InspectorStatus";
import { useEntityAutosave } from "../inspector/useEntityAutosave";
import { PersonLinkField } from "./PersonLinkField";

export interface TraumaEventFormProps {
  event: DecryptedEvent | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: TraumaEvent, personIds: string[]) => Promise<unknown> | undefined;
  onDelete?: () => void;
}

interface EventDraft {
  title: string;
  description: string;
  category: TraumaCategory;
  approximateDate: string;
  severity: string;
  tags: string;
  personIds: string[];
}

function buildEventData(draft: EventDraft): { data: TraumaEvent; personIds: string[] } | null {
  if (!draft.title.trim() || draft.personIds.length === 0) return null;
  return {
    data: {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      approximate_date: draft.approximateDate,
      severity: parseInt(draft.severity, 10) || 1,
      tags: draft.tags.split(",").flatMap((s) => {
        const trimmed = s.trim();
        return trimmed ? [trimmed] : [];
      }),
    },
    personIds: draft.personIds,
  };
}

export function TraumaEventForm({
  event,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: TraumaEventFormProps) {
  const { t } = useTranslation();
  const report = useSaveReporter();

  const { isNew, draft, update, commit, changeAndCommit, scheduleCommit, buildData } =
    useEntityAutosave({
      entity: event,
      toDraft: (e) => ({
        title: e?.title ?? "",
        description: e?.description ?? "",
        category: e?.category ?? TraumaCategory.Loss,
        approximateDate: e?.approximate_date ?? "",
        severity: String(e?.severity ?? 5),
        tags: e?.tags?.join(", ") ?? "",
        personIds: e?.person_ids ?? initialPersonIds,
      }),
      toData: buildEventData,
      onAutoSave: (payload) => onSave(payload.data, payload.personIds),
    });

  function handleAdd() {
    const payload = buildData();
    if (!payload) return;
    const result = onSave(payload.data, payload.personIds);
    Promise.resolve(result).then(
      () => report?.("saved"),
      () => report?.("error"),
    );
  }

  return (
    <>
      <InspectorField label={t("trauma.title")}>
        <input
          type="text"
          aria-label={t("trauma.title")}
          value={draft.title}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
      </InspectorField>
      <InspectorField label={t("trauma.description")}>
        <textarea
          aria-label={t("trauma.description")}
          value={draft.description}
          onChange={(e) => {
            update((d) => ({ ...d, description: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
          rows={2}
        />
      </InspectorField>
      <InspectorField label={t("trauma.category")}>
        <select
          value={draft.category}
          onChange={(e) =>
            changeAndCommit((d) => ({ ...d, category: e.target.value as TraumaCategory }))
          }
        >
          {Object.values(TraumaCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`trauma.category.${cat}`)}
            </option>
          ))}
        </select>
      </InspectorField>
      <InspectorField label={t("trauma.approximateDate")}>
        <input
          type="text"
          aria-label={t("trauma.approximateDate")}
          value={draft.approximateDate}
          onChange={(e) => update((d) => ({ ...d, approximateDate: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          placeholder={t("trauma.datePlaceholder")}
        />
      </InspectorField>
      <InspectorField label={`${t("trauma.severity")} (${draft.severity})`}>
        <input
          type="range"
          aria-label={t("trauma.severity")}
          min="1"
          max="10"
          value={draft.severity}
          onChange={(e) => {
            update((d) => ({ ...d, severity: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
        />
      </InspectorField>
      <InspectorField label={t("trauma.tags")}>
        <input
          type="text"
          aria-label={t("trauma.tags")}
          value={draft.tags}
          onChange={(e) => update((d) => ({ ...d, tags: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          placeholder={t("trauma.tagsPlaceholder")}
        />
      </InspectorField>
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={new Set(draft.personIds)}
        onChange={(ids) => changeAndCommit((d) => ({ ...d, personIds: Array.from(ids) }))}
      />
      {isNew ? (
        <div className="detail-panel__actions">
          <button type="button" className="btn btn--primary" onClick={handleAdd}>
            {t("common.add")}
          </button>
        </div>
      ) : (
        onDelete && (
          <div className="inspector-danger">
            <ConfirmDeleteButton
              onConfirm={onDelete}
              label={t("common.delete")}
              confirmLabel={t("trauma.confirmDelete")}
            />
          </div>
        )
      )}
    </>
  );
}
