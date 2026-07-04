import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditingState } from "../../hooks/useEditingState";
import type { DecryptedClassification, DecryptedPerson } from "../../hooks/useTreeData";
import { getClassificationColor } from "../../lib/classificationColors";
import { DSM_CATEGORIES } from "../../lib/dsmCategories";
import type {
  Classification,
  ClassificationPeriod,
  ClassificationStatus,
} from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { blurOnEnter, sanitizeYearInput } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { useSaveReporter } from "../inspector/InspectorStatus";
import { useEntityAutosave } from "../inspector/useEntityAutosave";
import { EditSubPanel } from "./EditSubPanel";
import { PersonLinkField } from "./PersonLinkField";

/** Subcategory label when present, otherwise the category label. */
function classificationLabel(
  cls: { dsm_category: string; dsm_subcategory: string | null },
  t: (key: string) => string,
): string {
  return cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : t(`dsm.${cls.dsm_category}`);
}

/** Format classification periods as a compact summary string. */
function formatClassificationPeriods(
  cls: {
    periods: { start_year: number; end_year: number | null }[];
    diagnosis_year: number | null;
  },
  t: (key: string) => string,
): React.ReactNode {
  if (cls.periods.length > 0) {
    const parts = cls.periods.map((p) =>
      p.end_year ? `${p.start_year}-${p.end_year}` : `${p.start_year}, ${t("common.ongoing")}`,
    );
    return <span className="detail-panel__period-summary">{parts.join("; ")}</span>;
  }
  if (cls.diagnosis_year) {
    return (
      <span className="detail-panel__period-summary">
        {cls.diagnosis_year}, {t("common.ongoing")}
      </span>
    );
  }
  return null;
}

interface ClassificationsTabProps {
  person: DecryptedPerson;
  classifications: DecryptedClassification[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveClassification: (
    classificationId: string | null,
    data: Classification,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDeleteClassification: (classificationId: string) => void;
  initialEditId?: string;
}

export function ClassificationsTab({
  person,
  classifications,
  allPersons,
  onSaveClassification,
  onDeleteClassification,
  initialEditId,
}: ClassificationsTabProps) {
  const { t } = useTranslation();
  const { editingId, setEditingId, isEditing, setShowNew, clearEditing } =
    useEditingState(initialEditId);

  if (isEditing) {
    const cls = editingId ? (classifications.find((c) => c.id === editingId) ?? null) : null;
    return (
      <EditSubPanel
        title={
          editingId
            ? cls
              ? classificationLabel(cls, t)
              : t("classification.editClassification")
            : t("classification.newClassification")
        }
        onBack={clearEditing}
        closeLabel={editingId ? t("common.close") : undefined}
      >
        <ClassificationForm
          key={editingId ?? "new"}
          classification={cls}
          allPersons={allPersons}
          initialPersonIds={cls?.person_ids ?? [person.id]}
          onSave={(data, personIds) => {
            const result = onSaveClassification(editingId, data, personIds);
            if (!editingId) clearEditing();
            return result;
          }}
          onDelete={
            editingId
              ? () => {
                  onDeleteClassification(editingId);
                  setEditingId(null);
                }
              : undefined
          }
        />
      </EditSubPanel>
    );
  }

  return (
    <>
      {classifications.map((cls) => (
        <button
          key={cls.id}
          type="button"
          className="detail-panel__event-card"
          onClick={() => setEditingId(cls.id)}
        >
          <div className="detail-panel__event-card-row">
            <span
              className="detail-panel__event-card-dot"
              style={{
                backgroundColor: getClassificationColor(cls.status),
                borderRadius: 0,
                clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
              }}
            />
            <span className="detail-panel__event-card-title">{classificationLabel(cls, t)}</span>
          </div>
          <div className="detail-panel__event-card-meta">
            <span className={`detail-panel__status-pill detail-panel__status-pill--${cls.status}`}>
              {t(`classification.status.${cls.status}`)}
            </span>
            {cls.dsm_subcategory && (
              <span className="detail-panel__classification-category">
                {t(`dsm.${cls.dsm_category}`)}
              </span>
            )}
            {formatClassificationPeriods(cls, t)}
          </div>
        </button>
      ))}
      <button
        type="button"
        className="btn detail-panel__btn--secondary"
        onClick={() => setShowNew(true)}
      >
        {t("classification.newClassification")}
      </button>
    </>
  );
}

interface ClassificationFormProps {
  classification: DecryptedClassification | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: Classification, personIds: string[]) => Promise<unknown> | undefined;
  onDelete?: () => void;
}

type KeyedClassificationPeriod = ClassificationPeriod & { _key: string };

interface ClassificationDraft {
  dsmCategory: string;
  dsmSubcategory: string | null;
  status: ClassificationStatus;
  diagnosisYear: string;
  periods: KeyedClassificationPeriod[];
  notes: string;
  personIds: string[];
}

function buildClassificationData(
  draft: ClassificationDraft,
): { data: Classification; personIds: string[] } | null {
  if (draft.personIds.length === 0) return null;
  const parsedDiagnosisYear =
    draft.status === "diagnosed" && draft.diagnosisYear ? parseInt(draft.diagnosisYear, 10) : null;

  // Strip internal _key before saving
  const cleanedPeriods = draft.periods.map(({ _key, ...rest }) => rest);

  // Auto-create a period from diagnosis year when no periods are set
  const effectivePeriods =
    cleanedPeriods.length === 0 && parsedDiagnosisYear != null
      ? [{ start_year: parsedDiagnosisYear, end_year: null }]
      : cleanedPeriods;

  return {
    data: {
      dsm_category: draft.dsmCategory,
      dsm_subcategory: draft.dsmSubcategory,
      status: draft.status,
      diagnosis_year: parsedDiagnosisYear,
      periods: effectivePeriods,
      notes: draft.notes || null,
    },
    personIds: draft.personIds,
  };
}

function ClassificationForm({
  classification,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: ClassificationFormProps) {
  const { t } = useTranslation();
  const report = useSaveReporter();
  // Search narrows the category select; purely local, never persisted.
  const [categorySearch, setCategorySearch] = useState("");

  const { isNew, draft, update, commit, changeAndCommit, scheduleCommit, buildData } =
    useEntityAutosave({
      entity: classification,
      toDraft: (c) => ({
        dsmCategory: c?.dsm_category ?? "anxiety",
        dsmSubcategory: c?.dsm_subcategory ?? null,
        status: c?.status ?? ("suspected" as ClassificationStatus),
        diagnosisYear: c?.diagnosis_year != null ? String(c.diagnosis_year) : "",
        periods: (c?.periods ?? []).map((p) => ({ ...p, _key: crypto.randomUUID() })),
        notes: c?.notes ?? "",
        personIds: c?.person_ids ?? initialPersonIds,
      }),
      toData: buildClassificationData,
      onAutoSave: (payload) => onSave(payload.data, payload.personIds),
    });

  // Build compound select value from category + subcategory
  const selectValue = draft.dsmSubcategory
    ? `${draft.dsmCategory}::${draft.dsmSubcategory}`
    : draft.dsmCategory;

  // Filter categories and subcategories based on search
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return DSM_CATEGORIES;
    const q = categorySearch.toLowerCase();
    return DSM_CATEGORIES.flatMap((cat) => {
      const categoryLabel = t(`dsm.${cat.key}`).toLowerCase();
      const categoryCodeMatch = cat.code.toLowerCase().includes(q);
      const categoryLabelMatch = categoryLabel.includes(q);

      if (categoryLabelMatch || categoryCodeMatch) return [cat];

      if (cat.subcategories) {
        const matchedSubs = cat.subcategories.filter((sub) => {
          const subLabel = t(`dsm.sub.${sub.key}`).toLowerCase();
          return subLabel.includes(q) || sub.code.toLowerCase().includes(q);
        });
        if (matchedSubs.length > 0) return [{ ...cat, subcategories: matchedSubs }];
      }

      return [];
    });
  }, [categorySearch, t]);

  function handleSelectChange(compoundValue: string) {
    const parts = compoundValue.split("::");
    changeAndCommit((d) => ({
      ...d,
      dsmCategory: parts[0],
      dsmSubcategory: parts.length > 1 ? parts[1] : null,
    }));
    setCategorySearch("");
  }

  function addPeriod() {
    changeAndCommit((d) => ({
      ...d,
      periods: [
        ...d.periods,
        {
          start_year: new Date().getFullYear(),
          end_year: null,
          _key: crypto.randomUUID(),
        },
      ],
    }));
  }

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
      <InspectorField label={t("classification.category")}>
        <input
          type="text"
          aria-label={t("classification.searchPlaceholder")}
          value={categorySearch}
          onChange={(e) => setCategorySearch(e.target.value)}
          placeholder={t("classification.searchPlaceholder")}
        />
      </InspectorField>
      <InspectorField label="" className="inspector-field--select-only">
        <select
          aria-label={t("classification.category")}
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
        >
          {filteredCategories.map((cat) => (
            <optgroup key={cat.key} label={`${cat.code} - ${t(`dsm.${cat.key}`)}`}>
              <option value={cat.key}>{t(`dsm.${cat.key}`)}</option>
              {cat.subcategories?.map((sub) => (
                <option key={sub.key} value={`${cat.key}::${sub.key}`}>
                  {sub.code} - {t(`dsm.sub.${sub.key}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </InspectorField>
      <fieldset className="inspector-field">
        <span className="inspector-field__label">{t("classification.status")}</span>
        <div className="detail-panel__radios">
          <label className="detail-panel__field--checkbox">
            <input
              type="radio"
              name="cls-status"
              checked={draft.status === "suspected"}
              onChange={() => changeAndCommit((d) => ({ ...d, status: "suspected" }))}
            />
            <span>{t("classification.status.suspected")}</span>
          </label>
          <label className="detail-panel__field--checkbox">
            <input
              type="radio"
              name="cls-status"
              checked={draft.status === "diagnosed"}
              onChange={() => changeAndCommit((d) => ({ ...d, status: "diagnosed" }))}
            />
            <span>{t("classification.status.diagnosed")}</span>
          </label>
        </div>
      </fieldset>
      {draft.status === "diagnosed" && (
        <InspectorField label={t("classification.diagnosisYear")} className="inspector-field--year">
          <input
            type="text"
            inputMode="numeric"
            aria-label={t("classification.diagnosisYear")}
            value={draft.diagnosisYear}
            onChange={(e) =>
              update((d) => ({ ...d, diagnosisYear: sanitizeYearInput(e.target.value) }))
            }
            onBlur={commit}
            onKeyDown={blurOnEnter}
          />
        </InspectorField>
      )}
      <fieldset className="inspector-field">
        <span className="inspector-field__label">{t("classification.periods")}</span>
        {draft.periods.map((period, i) => (
          <div key={period._key} className="detail-panel__period-row">
            <div className="detail-panel__period-years">
              <InspectorField
                label={t("common.startYear")}
                className="inspector-field--stacked inspector-field--year"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t("common.startYear")}
                  value={period.start_year || ""}
                  onChange={(e) => {
                    const value = sanitizeYearInput(e.target.value);
                    update((d) => ({
                      ...d,
                      periods: d.periods.map((p, idx) =>
                        idx === i ? { ...p, start_year: parseInt(value, 10) || 0 } : p,
                      ),
                    }));
                  }}
                  onBlur={commit}
                  onKeyDown={blurOnEnter}
                />
              </InspectorField>
              <InspectorField
                label={t("common.endYear")}
                className="inspector-field--stacked inspector-field--year"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t("common.endYear")}
                  value={period.end_year ?? ""}
                  onChange={(e) => {
                    const value = sanitizeYearInput(e.target.value);
                    update((d) => ({
                      ...d,
                      periods: d.periods.map((p, idx) =>
                        idx === i ? { ...p, end_year: value ? parseInt(value, 10) : null } : p,
                      ),
                    }));
                  }}
                  onBlur={commit}
                  onKeyDown={blurOnEnter}
                />
              </InspectorField>
            </div>
            <button
              type="button"
              className="detail-panel__btn--small detail-panel__btn--danger"
              onClick={() =>
                changeAndCommit((d) => ({
                  ...d,
                  periods: d.periods.filter((_, idx) => idx !== i),
                }))
              }
            >
              {t("classification.removePeriod")}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="detail-panel__btn--small detail-panel__btn--add-period"
          onClick={addPeriod}
        >
          {t("classification.addPeriod")}
        </button>
      </fieldset>
      <InspectorField label={t("classification.notes")}>
        <textarea
          aria-label={t("classification.notes")}
          value={draft.notes}
          onChange={(e) => {
            update((d) => ({ ...d, notes: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
          rows={2}
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
              confirmLabel={t("classification.confirmDelete")}
            />
          </div>
        )
      )}
    </>
  );
}
