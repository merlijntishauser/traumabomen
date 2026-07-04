import { useTranslation } from "react-i18next";
import { useAutosaveForm } from "../../hooks/useAutosaveForm";
import type { DecryptedRelationship } from "../../hooks/useTreeData";
import type { RelationshipData, RelationshipPeriod } from "../../types/domain";
import { PartnerStatus, withAutoDissolvedPeriods } from "../../types/domain";
import { blurOnEnter, sanitizeYearInput } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { useSaveReporter } from "../inspector/InspectorStatus";

type KeyedPeriod = RelationshipPeriod & { _key: string };

function toKeyed(period: RelationshipPeriod): KeyedPeriod {
  return { ...period, _key: crypto.randomUUID() };
}

interface PartnerPeriodsEditorProps {
  relationship: DecryptedRelationship;
  sourceDeathYear: number | null | undefined;
  targetDeathYear: number | null | undefined;
  onSave: (data: RelationshipData) => Promise<unknown> | undefined;
}

/**
 * Quiet autosaving editor for partner relationship periods. Year fields
 * commit on blur; status selects, add, and remove commit immediately.
 * Mount keyed by relationship id so switching relationships flushes to the
 * right edge. There is no seeded first period: adding one is the explicit
 * act that creates it.
 */
export function PartnerPeriodsEditor({
  relationship,
  sourceDeathYear,
  targetDeathYear,
  onSave,
}: PartnerPeriodsEditorProps) {
  const { t } = useTranslation();
  const report = useSaveReporter();

  const { draft, update, updateAndCommit, commit } = useAutosaveForm({
    source: relationship,
    toDraft: (rel) => ({ periods: rel.periods.map(toKeyed) }),
    toData: (d): RelationshipData => ({
      type: relationship.type,
      periods: withAutoDissolvedPeriods(
        d.periods.map(({ _key, ...rest }) => rest),
        { source: sourceDeathYear, target: targetDeathYear },
      ),
      active_period: relationship.active_period,
    }),
    onSave,
    report,
  });

  function patchPeriod(key: string, patch: Partial<RelationshipPeriod>) {
    update((d) => ({
      periods: d.periods.map((p) => (p._key === key ? { ...p, ...patch } : p)),
    }));
  }

  function addPeriod() {
    updateAndCommit((d) => ({
      periods: [
        ...d.periods,
        toKeyed({
          start_year: new Date().getFullYear(),
          end_year: null,
          status: PartnerStatus.Together,
        }),
      ],
    }));
  }

  return (
    <div className="detail-panel__period-editor">
      {draft.periods.map((period) => (
        <div key={period._key} className="detail-panel__period-row">
          <InspectorField label={t("relationship.status")} className="inspector-field--stacked">
            <select
              value={period.status}
              onChange={(e) =>
                updateAndCommit((d) => ({
                  periods: d.periods.map((p) =>
                    p._key === period._key ? { ...p, status: e.target.value as PartnerStatus } : p,
                  ),
                }))
              }
            >
              {Object.values(PartnerStatus).map((s) => (
                <option key={s} value={s}>
                  {t(`relationship.status.${s}`)}
                </option>
              ))}
            </select>
          </InspectorField>
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
                  patchPeriod(period._key, { start_year: parseInt(value, 10) || 0 });
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
                  patchPeriod(period._key, { end_year: value ? parseInt(value, 10) : null });
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
              updateAndCommit((d) => ({
                periods: d.periods.filter((p) => p._key !== period._key),
              }))
            }
          >
            {t("relationship.removePeriod")}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="detail-panel__btn--small detail-panel__btn--add-period"
        onClick={addPeriod}
      >
        {t("relationship.addPeriod")}
      </button>
    </div>
  );
}
