import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { formatAge } from "../../lib/age";
import type { Person } from "../../types/domain";

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

  const [name, setName] = useState(person.name);
  const [birthYear, setBirthYear] = useState(toStr(person.birth_year));
  const [birthMonth, setBirthMonth] = useState(toStr(person.birth_month));
  const [birthDay, setBirthDay] = useState(toStr(person.birth_day));
  const [deathYear, setDeathYear] = useState(toStr(person.death_year));
  const [deathMonth, setDeathMonth] = useState(toStr(person.death_month));
  const [deathDay, setDeathDay] = useState(toStr(person.death_day));
  const [causeOfDeath, setCauseOfDeath] = useState(person.cause_of_death ?? "");
  const [gender, setGender] = useState(person.gender);
  const [isAdopted, setIsAdopted] = useState(person.is_adopted);
  const [notes, setNotes] = useState(person.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset form when person changes
  useEffect(() => {
    setName(person.name);
    setBirthYear(toStr(person.birth_year));
    setBirthMonth(toStr(person.birth_month));
    setBirthDay(toStr(person.birth_day));
    setDeathYear(toStr(person.death_year));
    setDeathMonth(toStr(person.death_month));
    setDeathDay(toStr(person.death_day));
    setCauseOfDeath(person.cause_of_death ?? "");
    setGender(person.gender);
    setIsAdopted(person.is_adopted);
    setNotes(person.notes ?? "");
    setConfirmDelete(false);
  }, [
    person.birth_year,
    person.birth_month,
    person.birth_day,
    person.cause_of_death,
    person.death_year,
    person.death_month,
    person.death_day,
    person.gender,
    person.is_adopted,
    person.name,
    person.notes,
  ]);

  function handleBirthYearChange(value: string) {
    setBirthYear(value);
    // Clear dependent fields when year is removed
    setBirthMonth(value ? birthMonth : "");
    setBirthDay(value ? birthDay : "");
  }

  function handleBirthMonthChange(value: string) {
    setBirthMonth(value);
    setBirthDay(value ? birthDay : "");
  }

  function handleDeathYearChange(value: string) {
    setDeathYear(value);
    setDeathMonth(value ? deathMonth : "");
    setDeathDay(value ? deathDay : "");
  }

  function handleDeathMonthChange(value: string) {
    setDeathMonth(value);
    setDeathDay(value ? deathDay : "");
  }

  function handleSavePerson() {
    onSavePerson({
      name,
      birth_year: parseOptionalInt(birthYear),
      birth_month: parseOptionalInt(birthMonth),
      birth_day: parseOptionalInt(birthDay),
      death_year: parseOptionalInt(deathYear),
      death_month: parseOptionalInt(deathMonth),
      death_day: parseOptionalInt(deathDay),
      cause_of_death: causeOfDeath || null,
      gender,
      is_adopted: isAdopted,
      notes: notes || null,
    });
  }

  function handleDeletePerson() {
    if (confirmDelete) {
      onDeletePerson(person.id);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <>
      <div className="detail-panel__field-inline">
        <label className="detail-panel__field" style={{ flex: 1 }}>
          <span>{t("person.name")}</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="detail-panel__field">
          <span>{t("person.gender")}</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">{t("person.male")}</option>
            <option value="female">{t("person.female")}</option>
            <option value="other">{t("person.other")}</option>
          </select>
        </label>
      </div>
      <div className="detail-panel__field-group">
        <DateFields
          yearLabel={t("person.birthYear")}
          yearValue={birthYear}
          monthLabel={t("person.birthMonth")}
          dayLabel={t("person.birthDay")}
          month={birthMonth}
          day={birthDay}
          monthNames={monthNames}
          onYearChange={handleBirthYearChange}
          onMonthChange={handleBirthMonthChange}
          onDayChange={setBirthDay}
        />
        <div className="detail-panel__field-group-footer">
          <AgeHint
            birthYear={birthYear}
            deathYear={deathYear}
            birthMonth={birthMonth}
            birthDay={birthDay}
            deathMonth={deathMonth}
            deathDay={deathDay}
            t={t}
          />
          <label className="detail-panel__field detail-panel__field--checkbox">
            <input
              type="checkbox"
              checked={isAdopted}
              onChange={(e) => setIsAdopted(e.target.checked)}
            />
            <span>{t("person.isAdopted")}</span>
          </label>
        </div>
      </div>
      <div className="detail-panel__field-group">
        <DateFields
          yearLabel={t("person.deathYear")}
          yearValue={deathYear}
          monthLabel={t("person.deathMonth")}
          dayLabel={t("person.deathDay")}
          month={deathMonth}
          day={deathDay}
          monthNames={monthNames}
          onYearChange={handleDeathYearChange}
          onMonthChange={handleDeathMonthChange}
          onDayChange={setDeathDay}
          yearPlaceholder="---"
        />
        {deathYear && (
          <label className="detail-panel__field" style={{ marginTop: 8 }}>
            <span>{t("person.causeOfDeath")}</span>
            <input
              type="text"
              value={causeOfDeath}
              onChange={(e) => setCauseOfDeath(e.target.value)}
            />
          </label>
        )}
      </div>
      <label className="detail-panel__field">
        <span>{t("person.notes")}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>
      <div className="detail-panel__actions">
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--primary"
          onClick={handleSavePerson}
        >
          {t("person.save")}
        </button>
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--danger"
          onClick={handleDeletePerson}
        >
          {confirmDelete ? t("person.confirmDelete") : t("person.delete")}
        </button>
      </div>
    </>
  );
}
