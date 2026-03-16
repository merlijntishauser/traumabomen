import { useMemo, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { formatAge } from "../../lib/age";
import type { Person } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";

function daysInMonth(month: number): number {
  // Use a non-leap year; Feb = 28, etc.
  return new Date(2001, month, 0).getDate();
}

function parseOptionalInt(value: string): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function toStr(value: number | null): string {
  return value != null ? String(value) : "";
}

function computeAgeHint(
  birthYear: string,
  deathYear: string,
  birthMonth: string,
  birthDay: string,
  deathMonth: string,
  deathDay: string,
): { age: string; isDead: boolean } | null {
  const by = parseOptionalInt(birthYear);
  if (by == null) return null;
  const dy = parseOptionalInt(deathYear);
  const age = formatAge(
    by,
    dy,
    parseOptionalInt(birthMonth),
    parseOptionalInt(birthDay),
    parseOptionalInt(deathMonth),
    parseOptionalInt(deathDay),
  );
  if (age == null) return null;
  return { age, isDead: dy != null };
}

function DateFields({
  yearLabel,
  yearValue,
  monthLabel,
  dayLabel,
  month,
  day,
  monthNames,
  onYearChange,
  onMonthChange,
  onDayChange,
  yearPlaceholder,
}: {
  yearLabel: string;
  yearValue: string;
  monthLabel: string;
  dayLabel: string;
  month: string;
  day: string;
  monthNames: string[];
  onYearChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
  yearPlaceholder?: string;
}) {
  return (
    <div className="detail-panel__date-row">
      <label className="detail-panel__field">
        <span>{yearLabel}</span>
        <input
          type="number"
          value={yearValue}
          onChange={(e) => onYearChange(e.target.value)}
          placeholder={yearPlaceholder}
        />
      </label>
      {yearValue && (
        <label className="detail-panel__field">
          <span>{monthLabel}</span>
          <select value={month} onChange={(e) => onMonthChange(e.target.value)}>
            <option value="">---</option>
            {monthNames.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {yearValue && month && (
        <label className="detail-panel__field">
          <span>{dayLabel}</span>
          <select value={day} onChange={(e) => onDayChange(e.target.value)}>
            <option value="">---</option>
            {Array.from({ length: daysInMonth(parseInt(month, 10)) }, (_, i) => (
              <option key={`day-${i + 1}`} value={String(i + 1)}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function AgeHint({
  birthYear,
  deathYear,
  birthMonth,
  birthDay,
  deathMonth,
  deathDay,
  t,
}: {
  birthYear: string;
  deathYear: string;
  birthMonth: string;
  birthDay: string;
  deathMonth: string;
  deathDay: string;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const hint = computeAgeHint(birthYear, deathYear, birthMonth, birthDay, deathMonth, deathDay);
  if (!hint) return null;
  const key = hint.isDead ? "person.ageAtDeath" : "person.age";
  return <span className="detail-panel__age-hint">{t(key, { age: hint.age })}</span>;
}

interface PersonFormState {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  deathYear: string;
  deathMonth: string;
  deathDay: string;
  causeOfDeath: string;
  gender: string;
  isAdopted: boolean;
  notes: string;
}

type PersonFormAction =
  | { type: "SET_FIELD"; field: keyof PersonFormState; value: string | boolean }
  | { type: "SET_BIRTH_YEAR"; value: string; currentMonth: string; currentDay: string }
  | { type: "SET_BIRTH_MONTH"; value: string; currentDay: string }
  | { type: "SET_DEATH_YEAR"; value: string; currentMonth: string; currentDay: string }
  | { type: "SET_DEATH_MONTH"; value: string; currentDay: string }
  | { type: "RESET"; state: PersonFormState };

function personFormReducer(state: PersonFormState, action: PersonFormAction): PersonFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_BIRTH_YEAR":
      return {
        ...state,
        birthYear: action.value,
        birthMonth: action.value ? action.currentMonth : "",
        birthDay: action.value ? action.currentDay : "",
      };
    case "SET_BIRTH_MONTH":
      return {
        ...state,
        birthMonth: action.value,
        birthDay: action.value ? action.currentDay : "",
      };
    case "SET_DEATH_YEAR":
      return {
        ...state,
        deathYear: action.value,
        deathMonth: action.value ? action.currentMonth : "",
        deathDay: action.value ? action.currentDay : "",
      };
    case "SET_DEATH_MONTH":
      return {
        ...state,
        deathMonth: action.value,
        deathDay: action.value ? action.currentDay : "",
      };
    case "RESET":
      return action.state;
  }
}

function buildInitialState(person: DecryptedPerson): PersonFormState {
  return {
    name: person.name,
    birthYear: toStr(person.birth_year),
    birthMonth: toStr(person.birth_month),
    birthDay: toStr(person.birth_day),
    deathYear: toStr(person.death_year),
    deathMonth: toStr(person.death_month),
    deathDay: toStr(person.death_day),
    causeOfDeath: person.cause_of_death ?? "",
    gender: person.gender,
    isAdopted: person.is_adopted,
    notes: person.notes ?? "",
  };
}

interface PersonTabProps {
  person: DecryptedPerson;
  onSavePerson: (data: Person) => void;
  onDeletePerson: (personId: string) => void;
}

export function PersonTab({ person, onSavePerson, onDeletePerson }: PersonTabProps) {
  const { t, i18n } = useTranslation();

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
  }, [i18n.language]);

  const [state, dispatch] = useReducer(personFormReducer, person, buildInitialState);

  // Reset form when person changes (previous prop pattern)
  const personKey = `${person.name}|${person.birth_year}|${person.birth_month}|${person.birth_day}|${person.death_year}|${person.death_month}|${person.death_day}|${person.cause_of_death}|${person.gender}|${person.is_adopted}|${person.notes}`;
  const prevPersonKeyRef = useRef(personKey);
  if (prevPersonKeyRef.current !== personKey) {
    prevPersonKeyRef.current = personKey;
    dispatch({ type: "RESET", state: buildInitialState(person) });
  }

  function handleSavePerson() {
    onSavePerson({
      name: state.name,
      birth_year: parseOptionalInt(state.birthYear),
      birth_month: parseOptionalInt(state.birthMonth),
      birth_day: parseOptionalInt(state.birthDay),
      death_year: parseOptionalInt(state.deathYear),
      death_month: parseOptionalInt(state.deathMonth),
      death_day: parseOptionalInt(state.deathDay),
      cause_of_death: state.causeOfDeath || null,
      gender: state.gender,
      is_adopted: state.isAdopted,
      notes: state.notes || null,
    });
  }

  return (
    <>
      <div className="detail-panel__field-inline">
        <label className="detail-panel__field" style={{ flex: 1 }}>
          <span>{t("person.name")}</span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })}
            onFocus={(e) => {
              const target = e.target;
              requestAnimationFrame(() => target.select());
            }}
          />
        </label>
        <label className="detail-panel__field">
          <span>{t("person.gender")}</span>
          <select
            value={state.gender}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "gender", value: e.target.value })
            }
          >
            <option value="" disabled>
              {t("person.selectGender")}
            </option>
            <option value="male">{t("person.male")}</option>
            <option value="female">{t("person.female")}</option>
            <option value="other">{t("person.other")}</option>
          </select>
        </label>
      </div>
      <div className="detail-panel__field-group">
        <DateFields
          yearLabel={t("person.birthYear")}
          yearValue={state.birthYear}
          monthLabel={t("person.birthMonth")}
          dayLabel={t("person.birthDay")}
          month={state.birthMonth}
          day={state.birthDay}
          monthNames={monthNames}
          onYearChange={(value) =>
            dispatch({
              type: "SET_BIRTH_YEAR",
              value,
              currentMonth: state.birthMonth,
              currentDay: state.birthDay,
            })
          }
          onMonthChange={(value) =>
            dispatch({ type: "SET_BIRTH_MONTH", value, currentDay: state.birthDay })
          }
          onDayChange={(value) => dispatch({ type: "SET_FIELD", field: "birthDay", value })}
        />
        <div className="detail-panel__field-group-footer">
          <AgeHint
            birthYear={state.birthYear}
            deathYear={state.deathYear}
            birthMonth={state.birthMonth}
            birthDay={state.birthDay}
            deathMonth={state.deathMonth}
            deathDay={state.deathDay}
            t={t}
          />
          <label className="detail-panel__field detail-panel__field--checkbox">
            <input
              type="checkbox"
              checked={state.isAdopted}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "isAdopted", value: e.target.checked })
              }
            />
            <span>{t("person.isAdopted")}</span>
          </label>
        </div>
      </div>
      <div className="detail-panel__field-group">
        <DateFields
          yearLabel={t("person.deathYear")}
          yearValue={state.deathYear}
          monthLabel={t("person.deathMonth")}
          dayLabel={t("person.deathDay")}
          month={state.deathMonth}
          day={state.deathDay}
          monthNames={monthNames}
          onYearChange={(value) =>
            dispatch({
              type: "SET_DEATH_YEAR",
              value,
              currentMonth: state.deathMonth,
              currentDay: state.deathDay,
            })
          }
          onMonthChange={(value) =>
            dispatch({ type: "SET_DEATH_MONTH", value, currentDay: state.deathDay })
          }
          onDayChange={(value) => dispatch({ type: "SET_FIELD", field: "deathDay", value })}
          yearPlaceholder="---"
        />
        {state.deathYear && (
          <label className="detail-panel__field" style={{ marginTop: 8 }}>
            <span>{t("person.causeOfDeath")}</span>
            <input
              type="text"
              value={state.causeOfDeath}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "causeOfDeath", value: e.target.value })
              }
            />
          </label>
        )}
      </div>
      <label className="detail-panel__field">
        <span>{t("person.notes")}</span>
        <textarea
          value={state.notes}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "notes", value: e.target.value })}
          rows={3}
        />
      </label>
      <div className="detail-panel__actions">
        <button type="button" className="btn btn--primary" onClick={handleSavePerson}>
          {t("person.save")}
        </button>
        <ConfirmDeleteButton
          onConfirm={() => onDeletePerson(person.id)}
          label={t("person.delete")}
          confirmLabel={t("person.confirmDelete")}
        />
      </div>
    </>
  );
}
