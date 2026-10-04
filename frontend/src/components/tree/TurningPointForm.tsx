import { useTranslation } from "react-i18next";
import type { DecryptedPerson, DecryptedTurningPoint } from "../../hooks/useTreeData";
import type { TurningPoint } from "../../types/domain";
import { TurningPointCategory } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { blurOnEnter } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { useSaveReporter } from "../inspector/InspectorStatus";
import { useEntityAutosave } from "../inspector/useEntityAutosave";
import { PersonLinkField } from "./PersonLinkField";

export interface TurningPointFormProps {
  turningPoint: DecryptedTurningPoint | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: TurningPoint, personIds: string[]) => Promise<unknown> | undefined;
  onDelete?: () => void;
}

interface TurningPointDraft {
  title: string;
  description: string;
  category: TurningPointCategory;
  approximateDate: string;
  significance: string;
  tags: string;
  personIds: string[];
}

function buildTurningPointData(
  draft: TurningPointDraft,
): { data: TurningPoint; personIds: string[] } | null {
  if (!draft.title.trim() || draft.personIds.length === 0) return null;
  return {
    data: {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      approximate_date: draft.approximateDate,
      significance: draft.significance ? parseInt(draft.significance, 10) || null : null,
      tags: draft.tags.split(",").flatMap((s) => {
        const trimmed = s.trim();
        return trimmed ? [trimmed] : [];
      }),
    },
    personIds: draft.personIds,
  };
}

export function TurningPointForm({
  turningPoint,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: TurningPointFormProps) {
  const { t } = useTranslation();
  const report = useSaveReporter();

  const { isNew, draft, update, commit, changeAndCommit, scheduleCommit, buildData } =
    useEntityAutosave({
      entity: turningPoint,
      toDraft: (tp) => ({
        title: tp?.title ?? "",
        description: tp?.description ?? "",
        category: tp?.category ?? TurningPointCategory.CycleBreaking,
        approximateDate: tp?.approximate_date ?? "",
        significance: tp?.significance != null ? String(tp.significance) : "",
        tags: tp?.tags?.join(", ") ?? "",
        personIds: tp?.person_ids ?? initialPersonIds,
      }),
      toData: buildTurningPointData,
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
      <InspectorField label={t("turningPoint.titleField")}>
        <input
          type="text"
          aria-label={t("turningPoint.titleField")}
          value={draft.title}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
      </InspectorField>
      <InspectorField label={t("turningPoint.description")}>
        <textarea
          aria-label={t("turningPoint.description")}
          value={draft.description}
          onChange={(e) => {
            update((d) => ({ ...d, description: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
          rows={2}
        />
      </InspectorField>
      <InspectorField label={t("turningPoint.category")}>
        <select
          value={draft.category}
          onChange={(e) =>
            changeAndCommit((d) => ({ ...d, category: e.target.value as TurningPointCategory }))
          }
        >
          {Object.values(TurningPointCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`turningPoint.category.${cat}`)}
            </option>
          ))}
        </select>
      </InspectorField>
      <InspectorField label={t("turningPoint.approximate_date")}>
        <input
          type="text"
          aria-label={t("turningPoint.approximate_date")}
          value={draft.approximateDate}
          onChange={(e) => update((d) => ({ ...d, approximateDate: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          placeholder={t("turningPoint.datePlaceholder")}
        />
      </InspectorField>
      <InspectorField label={`${t("turningPoint.significance")} (${draft.significance || "-"})`}>
        <input
          type="range"
          aria-label={t("turningPoint.significance")}
          min="1"
          max="10"
          value={draft.significance || "5"}
          onChange={(e) => {
            update((d) => ({ ...d, significance: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
        />
      </InspectorField>
      <InspectorField label={t("turningPoint.tags")}>
        <input
          type="text"
          aria-label={t("turningPoint.tags")}
          value={draft.tags}
          onChange={(e) => update((d) => ({ ...d, tags: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          placeholder={t("turningPoint.tagsPlaceholder")}
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
              confirmLabel={t("turningPoint.confirmDelete")}
            />
          </div>
        )
      )}
    </>
  );
}
