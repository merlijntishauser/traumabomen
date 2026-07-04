import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAutosaveForm } from "../../hooks/useAutosaveForm";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import type { Person } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { blurOnEnter, sanitizeYearInput } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { InspectorGhostRow } from "../inspector/InspectorGhostRow";
import { useSaveReporter } from "../inspector/InspectorStatus";
import { InspectorToggleRow } from "../inspector/InspectorToggleRow";
import {
  buildPersonData,
  buildPersonDraft,
  computeAgeHint,
  daysInMonth,
  type PersonFormState,
  withBirthMonth,
  withBirthYear,
  withDeathMonth,
  withDeathYear,
} from "./personForm";

function DateFields({
  label,
  monthLabel,
  dayLabel,
  year,
  month,
  day,
  monthNames,
  monthPlaceholder,
  onYearChange,
  onYearCommit,
  onMonthChange,
  onDayChange,
  yearInputRef,
}: {
  label: string;
  monthLabel: string;
  dayLabel: string;
  year: string;
  month: string;
  day: string;
  monthNames: string[];
  monthPlaceholder: string;
  onYearChange: (value: string) => void;
  onYearCommit: () => void;
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
  yearInputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <InspectorField label={label}>
      <div className="inspector-cluster">
        <input
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={year}
          ref={yearInputRef}
          onChange={(e) => onYearChange(sanitizeYearInput(e.target.value))}
          onBlur={onYearCommit}
          onKeyDown={blurOnEnter}
        />
        {year && (
          <select
            aria-label={monthLabel}
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
          >
            <option value="">{monthPlaceholder}</option>
            {monthNames.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </select>
        )}
        {year && month && (
          <select aria-label={dayLabel} value={day} onChange={(e) => onDayChange(e.target.value)}>
            <option value="">{monthPlaceholder}</option>
            {Array.from({ length: daysInMonth(parseInt(month, 10)) }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d)}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>
    </InspectorField>
  );
}

function AgeHint({ state }: { state: PersonFormState }) {
  const { t } = useTranslation();
  const hint = computeAgeHint(state);
  if (!hint) return null;
  const key = hint.isDead ? "person.ageAtDeath" : "person.age";
  return <span className="inspector-hint">{t(key, { age: hint.age })}</span>;
}

interface PersonTabProps {
  person: DecryptedPerson;
  onSavePerson: (data: Person) => Promise<unknown> | undefined;
  onDeletePerson: (personId: string) => void;
}

/**
 * Quiet autosaving person inspector. Fields commit on blur/change; the
 * consuming panel keys this component by person id, so switching persons
 * unmounts this instance and flushes pending edits to the right person.
 */
export function PersonTab({ person, onSavePerson, onDeletePerson }: PersonTabProps) {
  const { t, i18n } = useTranslation();
  const report = useSaveReporter();

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
  }, [i18n.language]);

  const { draft, update, updateAndCommit, commit, scheduleCommit } = useAutosaveForm({
    source: person,
    toDraft: buildPersonDraft,
    toData: (d) => buildPersonData(d, person),
    onSave: onSavePerson,
    report,
  });

  // Death dates disclose progressively: absent, they are one ghost row.
  const [deathOpen, setDeathOpen] = useState(() => Boolean(draft.deathYear));
  // Set by the ghost-row click; the year input's callback ref focuses it as
  // soon as the reveal renders it, keeping the logic in the event.
  const focusDeathYear = useRef(false);
  const deathYearRef = (el: HTMLInputElement | null) => {
    if (el && focusDeathYear.current) {
      focusDeathYear.current = false;
      el.focus();
    }
  };

  const monthPlaceholder = t("person.datePartEmpty");

  return (
    <>
      <InspectorField label={t("person.name")}>
        <input
          type="text"
          aria-label={t("person.name")}
          value={draft.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          onFocus={(e) => {
            const target = e.target;
            requestAnimationFrame(() => target.select());
          }}
        />
      </InspectorField>
      <InspectorField label={t("person.gender")}>
        <select
          value={draft.gender}
          onChange={(e) => updateAndCommit((d) => ({ ...d, gender: e.target.value }))}
        >
          <option value="" disabled>
            {t("person.selectGender")}
          </option>
          <option value="male">{t("person.male")}</option>
          <option value="female">{t("person.female")}</option>
          <option value="other">{t("person.other")}</option>
        </select>
      </InspectorField>

      <div className="inspector-group">
        <DateFields
          label={t("person.birthYear")}
          monthLabel={t("person.birthMonth")}
          dayLabel={t("person.birthDay")}
          year={draft.birthYear}
          month={draft.birthMonth}
          day={draft.birthDay}
          monthNames={monthNames}
          monthPlaceholder={monthPlaceholder}
          onYearChange={(value) => update((d) => withBirthYear(d, value))}
          onYearCommit={commit}
          onMonthChange={(value) => updateAndCommit((d) => withBirthMonth(d, value))}
          onDayChange={(value) => updateAndCommit((d) => ({ ...d, birthDay: value }))}
        />
        <AgeHint state={draft} />
      </div>

      <div className="inspector-group">
        {deathOpen ? (
          <>
            <DateFields
              label={t("person.deathYear")}
              monthLabel={t("person.deathMonth")}
              dayLabel={t("person.deathDay")}
              year={draft.deathYear}
              month={draft.deathMonth}
              day={draft.deathDay}
              monthNames={monthNames}
              monthPlaceholder={monthPlaceholder}
              onYearChange={(value) => update((d) => withDeathYear(d, value))}
              onYearCommit={commit}
              onMonthChange={(value) => updateAndCommit((d) => withDeathMonth(d, value))}
              onDayChange={(value) => updateAndCommit((d) => ({ ...d, deathDay: value }))}
              yearInputRef={deathYearRef}
            />
            {draft.deathYear && (
              <InspectorField label={t("person.causeOfDeath")}>
                <input
                  type="text"
                  aria-label={t("person.causeOfDeath")}
                  value={draft.causeOfDeath}
                  onChange={(e) => update((d) => ({ ...d, causeOfDeath: e.target.value }))}
                  onBlur={commit}
                  onKeyDown={blurOnEnter}
                />
              </InspectorField>
            )}
          </>
        ) : (
          <InspectorGhostRow
            label={t("person.addDeathDate")}
            onClick={() => {
              focusDeathYear.current = true;
              setDeathOpen(true);
            }}
          />
        )}
      </div>

      <InspectorToggleRow
        label={t("person.isAdopted")}
        checked={draft.isAdopted}
        onChange={(checked) => updateAndCommit((d) => ({ ...d, isAdopted: checked }))}
      />

      <InspectorField label={t("person.notes")} className="inspector-field--notes">
        <textarea
          aria-label={t("person.notes")}
          value={draft.notes}
          onChange={(e) => {
            update((d) => ({ ...d, notes: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
          rows={3}
        />
      </InspectorField>

      <div className="inspector-danger">
        <ConfirmDeleteButton
          onConfirm={() => onDeletePerson(person.id)}
          label={t("person.delete")}
          confirmLabel={t("person.confirmDelete")}
        />
      </div>
    </>
  );
}
