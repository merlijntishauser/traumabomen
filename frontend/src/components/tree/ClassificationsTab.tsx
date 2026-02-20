import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedClassification, DecryptedPerson } from "../../hooks/useTreeData";
import { getClassificationColor } from "../../lib/classificationColors";
import { DSM_CATEGORIES, type DsmCategory } from "../../lib/dsmCategories";
import type {
  Classification,
  ClassificationPeriod,
  ClassificationStatus,
} from "../../types/domain";
import { EditSubPanel } from "./EditSubPanel";
import { PersonLinkField } from "./PersonLinkField";

// Shared i18n keys used across sub-forms
const T_SAVE = "common.save";
const T_CANCEL = "common.cancel";
const T_DELETE = "common.delete";

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
  ) => void;
  onDeleteClassification: (classificationId: string) => void;
}

export function ClassificationsTab({
  person,
  classifications,
  allPersons,
  onSaveClassification,
  onDeleteClassification,
}: ClassificationsTabProps) {
  const { t } = useTranslation();

  const [editingClassificationId, setEditingClassificationId] = useState<string | null>(null);
  const [showNewClassification, setShowNewClassification] = useState(false);

  if (editingClassificationId || showNewClassification) {
    return (
      <EditSubPanel
        title={
          editingClassificationId
            ? (() => {
                const cls = classifications.find((c) => c.id === editingClassificationId);
                if (!cls) return t("classification.editClassification");
                return cls.dsm_subcategory
                  ? t(`dsm.sub.${cls.dsm_subcategory}`)
                  : t(`dsm.${cls.dsm_category}`);
              })()
            : t("classification.newClassification")
        }
        onBack={() => {
          setEditingClassificationId(null);
          setShowNewClassification(false);
        }}
      >
        <ClassificationForm
          classification={
            editingClassificationId
              ? (classifications.find((c) => c.id === editingClassificationId) ?? null)
              : null
          }
          allPersons={allPersons}
          initialPersonIds={
            editingClassificationId
              ? (classifications.find((c) => c.id === editingClassificationId)?.person_ids ?? [
                  person.id,
                ])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveClassification(editingClassificationId, data, personIds);
            setEditingClassificationId(null);
            setShowNewClassification(false);
          }}
          onCancel={() => {
            setEditingClassificationId(null);
            setShowNewClassification(false);
          }}
          onDelete={
            editingClassificationId
              ? () => {
                  onDeleteClassification(editingClassificationId);
                  setEditingClassificationId(null);
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
          onClick={() => setEditingClassificationId(cls.id)}
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
            <span className="detail-panel__event-card-title">
              {cls.dsm_subcategory
                ? t(`dsm.sub.${cls.dsm_subcategory}`)
                : t(`dsm.${cls.dsm_category}`)}
            </span>
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
        className="detail-panel__btn detail-panel__btn--secondary"
        onClick={() => setShowNewClassification(true)}
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
  onSave: (data: Classification, personIds: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function ClassificationForm({
  classification,
  allPersons,
  initialPersonIds,
  onSave,
  onCancel,
  onDelete,
}: ClassificationFormProps) {
  const { t } = useTranslation();
  const [dsmCategory, setDsmCategory] = useState(classification?.dsm_category ?? "anxiety");
  const [dsmSubcategory, setDsmSubcategory] = useState<string | null>(
    classification?.dsm_subcategory ?? null,
  );
  const [status, setStatus] = useState<ClassificationStatus>(classification?.status ?? "suspected");
  const [diagnosisYear, setDiagnosisYear] = useState(
    classification?.diagnosis_year != null ? String(classification.diagnosis_year) : "",
  );
  const [periods, setPeriods] = useState<ClassificationPeriod[]>(classification?.periods ?? []);
  const [notes, setNotes] = useState(classification?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );
  const [categorySearch, setCategorySearch] = useState("");

  // Build compound select value from category + subcategory
  const selectValue = dsmSubcategory ? `${dsmCategory}::${dsmSubcategory}` : dsmCategory;

  // Filter categories and subcategories based on search
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return DSM_CATEGORIES;
    const q = categorySearch.toLowerCase();
    return DSM_CATEGORIES.map((cat) => {
      const categoryLabel = t(`dsm.${cat.key}`).toLowerCase();
      const categoryCodeMatch = cat.code.toLowerCase().includes(q);
      const categoryLabelMatch = categoryLabel.includes(q);

      if (categoryLabelMatch || categoryCodeMatch) return cat;

      if (cat.subcategories) {
        const matchedSubs = cat.subcategories.filter((sub) => {
          const subLabel = t(`dsm.sub.${sub.key}`).toLowerCase();
          return subLabel.includes(q) || sub.code.toLowerCase().includes(q);
        });
        if (matchedSubs.length > 0) return { ...cat, subcategories: matchedSubs };
      }

      return null;
    }).filter((cat): cat is DsmCategory => cat !== null);
  }, [categorySearch, t]);

  function addPeriod() {
    setPeriods((prev) => [...prev, { start_year: new Date().getFullYear(), end_year: null }]);
  }

  function removePeriod(index: number) {
    setPeriods((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePeriod(index: number, field: keyof ClassificationPeriod, value: string) {
    setPeriods((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "end_year") return { ...p, end_year: value ? parseInt(value, 10) : null };
        return { ...p, [field]: parseInt(value, 10) || 0 };
      }),
    );
  }

  function handleSelectChange(compoundValue: string) {
    const parts = compoundValue.split("::");
    setDsmCategory(parts[0]);
    setDsmSubcategory(parts.length > 1 ? parts[1] : null);
    setCategorySearch("");
  }

  function handleSave() {
    const parsedDiagnosisYear =
      status === "diagnosed" && diagnosisYear ? parseInt(diagnosisYear, 10) : null;

    // Auto-create a period from diagnosis year when no periods are set
    const effectivePeriods =
      periods.length === 0 && parsedDiagnosisYear != null
        ? [{ start_year: parsedDiagnosisYear, end_year: null }]
        : periods;

    onSave(
      {
        dsm_category: dsmCategory,
        dsm_subcategory: dsmSubcategory,
        status,
        diagnosis_year: parsedDiagnosisYear,
        periods: effectivePeriods,
        notes: notes || null,
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("classification.category")}</span>
        <input
          type="text"
          value={categorySearch}
          onChange={(e) => setCategorySearch(e.target.value)}
          placeholder={t("classification.searchPlaceholder")}
        />
        <select value={selectValue} onChange={(e) => handleSelectChange(e.target.value)}>
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
      </label>
      <fieldset className="detail-panel__field">
        <span>{t("classification.status")}</span>
        <div className="detail-panel__radios">
          <label className="detail-panel__field--checkbox">
            <input
              type="radio"
              name="cls-status"
              checked={status === "suspected"}
              onChange={() => setStatus("suspected")}
            />
            <span>{t("classification.status.suspected")}</span>
          </label>
          <label className="detail-panel__field--checkbox">
            <input
              type="radio"
              name="cls-status"
              checked={status === "diagnosed"}
              onChange={() => setStatus("diagnosed")}
            />
            <span>{t("classification.status.diagnosed")}</span>
          </label>
        </div>
      </fieldset>
      {status === "diagnosed" && (
        <label className="detail-panel__field">
          <span>{t("classification.diagnosisYear")}</span>
          <input
            type="number"
            value={diagnosisYear}
            onChange={(e) => setDiagnosisYear(e.target.value)}
            placeholder="---"
          />
        </label>
      )}
      <fieldset className="detail-panel__field">
        <span>{t("classification.periods")}</span>
        {periods.map((period, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: periods are edited by index
            key={i}
            className="detail-panel__period-row"
          >
            <div className="detail-panel__period-years">
              <label className="detail-panel__field">
                <span>{t("common.startYear")}</span>
                <input
                  type="number"
                  value={period.start_year}
                  onChange={(e) => updatePeriod(i, "start_year", e.target.value)}
                />
              </label>
              <label className="detail-panel__field">
                <span>{t("common.endYear")}</span>
                <input
                  type="number"
                  value={period.end_year ?? ""}
                  onChange={(e) => updatePeriod(i, "end_year", e.target.value)}
                  placeholder="---"
                />
              </label>
            </div>
            <button
              type="button"
              className="detail-panel__btn--small detail-panel__btn--danger"
              onClick={() => removePeriod(i)}
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
      <label className="detail-panel__field">
        <span>{t("classification.notes")}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={selectedPersonIds}
        onChange={setSelectedPersonIds}
      />
      <div className="detail-panel__actions">
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--primary"
          onClick={handleSave}
        >
          {t(T_SAVE)}
        </button>
        <button type="button" className="detail-panel__btn" onClick={onCancel}>
          {t(T_CANCEL)}
        </button>
        {onDelete && (
          <button
            type="button"
            className="detail-panel__btn detail-panel__btn--danger"
            onClick={() => {
              if (confirmDelete) {
                onDelete();
              } else {
                setConfirmDelete(true);
              }
            }}
          >
            {confirmDelete ? t("classification.confirmDelete") : t(T_DELETE)}
          </button>
        )}
      </div>
    </div>
  );
}
