import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { formatAge } from "../../lib/age";
import { getClassificationColor } from "../../lib/classificationColors";
import { DSM_CATEGORIES, type DsmCategory } from "../../lib/dsmCategories";
import type { InferredSibling } from "../../lib/inferSiblings";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import { getTraumaColor } from "../../lib/traumaColors";
import type {
  Classification,
  ClassificationPeriod,
  ClassificationStatus,
  LifeEvent,
  Person,
  RelationshipData,
  RelationshipPeriod,
  TraumaEvent,
} from "../../types/domain";
import {
  LifeEventCategory,
  PartnerStatus,
  RelationshipType,
  TraumaCategory,
  withAutoDissolvedPeriods,
} from "../../types/domain";
import "./PersonDetailPanel.css";

// Shared i18n keys used across multiple sub-forms
const T_EDIT = "common.edit";
const T_SAVE = "common.save";
const T_CANCEL = "common.cancel";
const T_DELETE = "common.delete";

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

function DateRow({
  year,
  monthLabel,
  dayLabel,
  month,
  day,
  monthNames,
  onMonthChange,
  onDayChange,
}: {
  year: string;
  monthLabel: string;
  dayLabel: string;
  month: string;
  day: string;
  monthNames: string[];
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
}) {
  if (!year) return null;
  return (
    <div className="detail-panel__date-row">
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
      {month && (
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

/** Toggle a person in a Set, preventing removal of the last person. */
function togglePersonInSet(
  personId: string,
  setter: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  setter((prev) => {
    if (prev.has(personId) && prev.size <= 1) return prev;
    const next = new Set(prev);
    if (next.has(personId)) {
      next.delete(personId);
    } else {
      next.add(personId);
    }
    return next;
  });
}

export type PersonDetailSection =
  | "person"
  | "relationships"
  | "trauma_event"
  | "life_event"
  | "classification"
  | null;

interface PersonDetailPanelProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  classifications: DecryptedClassification[];
  allPersons: Map<string, DecryptedPerson>;
  initialSection?: PersonDetailSection;
  onSavePerson: (data: Person) => void;
  onDeletePerson: (personId: string) => void;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => void;
  onSaveEvent: (eventId: string | null, data: TraumaEvent, personIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
  onSaveLifeEvent: (lifeEventId: string | null, data: LifeEvent, personIds: string[]) => void;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  onSaveClassification: (
    classificationId: string | null,
    data: Classification,
    personIds: string[],
  ) => void;
  onDeleteClassification: (classificationId: string) => void;
  onClose: () => void;
}

export function PersonDetailPanel({
  person,
  relationships,
  inferredSiblings,
  events,
  lifeEvents,
  classifications,
  allPersons,
  initialSection,
  onSavePerson,
  onDeletePerson,
  onSaveRelationship,
  onSaveEvent,
  onDeleteEvent,
  onSaveLifeEvent,
  onDeleteLifeEvent,
  onSaveClassification,
  onDeleteClassification,
  onClose,
}: PersonDetailPanelProps) {
  const { t, i18n } = useTranslation();

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
  }, [i18n.language]);

  const [personOpen, setPersonOpen] = useState(initialSection === "person" || !initialSection);
  const [relsOpen, setRelsOpen] = useState(initialSection === "relationships");
  const [eventsOpen, setEventsOpen] = useState(initialSection === "trauma_event");
  const [lifeEventsOpen, setLifeEventsOpen] = useState(initialSection === "life_event");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Person form state
  const [name, setName] = useState(person.name);
  const [birthYear, setBirthYear] = useState(toStr(person.birth_year));
  const [birthMonth, setBirthMonth] = useState(toStr(person.birth_month));
  const [birthDay, setBirthDay] = useState(toStr(person.birth_day));
  const [deathYear, setDeathYear] = useState(toStr(person.death_year));
  const [deathMonth, setDeathMonth] = useState(toStr(person.death_month));
  const [deathDay, setDeathDay] = useState(toStr(person.death_day));
  const [gender, setGender] = useState(person.gender);
  const [isAdopted, setIsAdopted] = useState(person.is_adopted);
  const [notes, setNotes] = useState(person.notes ?? "");

  // Reset form when person changes
  useEffect(() => {
    setName(person.name);
    setBirthYear(toStr(person.birth_year));
    setBirthMonth(toStr(person.birth_month));
    setBirthDay(toStr(person.birth_day));
    setDeathYear(toStr(person.death_year));
    setDeathMonth(toStr(person.death_month));
    setDeathDay(toStr(person.death_day));
    setGender(person.gender);
    setIsAdopted(person.is_adopted);
    setNotes(person.notes ?? "");
    setConfirmDelete(false);
    setEditingRelId(null);
    setEditingEventId(null);
    setShowNewEvent(false);
    setEditingLifeEventId(null);
    setShowNewLifeEvent(false);
    setEditingClassificationId(null);
    setShowNewClassification(false);
  }, [
    person.birth_year,
    person.birth_month,
    person.birth_day,
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

  // Relationship editing state
  const [editingRelId, setEditingRelId] = useState<string | null>(null);

  // Event editing state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);

  // Life event editing state
  const [editingLifeEventId, setEditingLifeEventId] = useState<string | null>(null);
  const [showNewLifeEvent, setShowNewLifeEvent] = useState(false);

  // Classification editing state
  const [classificationsOpen, setClassificationsOpen] = useState(
    initialSection === "classification",
  );
  const [editingClassificationId, setEditingClassificationId] = useState<string | null>(null);
  const [showNewClassification, setShowNewClassification] = useState(false);

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2>{person.name}</h2>
        <button type="button" className="detail-panel__close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <div className="detail-panel__content">
        {/* Person details section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setPersonOpen(!personOpen)}
          >
            {personOpen ? "\u25BC" : "\u25B6"} {t("person.details")}
          </button>
          {personOpen && (
            <div className="detail-panel__section-body">
              <label className="detail-panel__field">
                <span>{t("person.name")}</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="detail-panel__field">
                <span>{t("person.birthYear")}</span>
                <input
                  type="number"
                  value={birthYear}
                  onChange={(e) => handleBirthYearChange(e.target.value)}
                />
                <AgeHint
                  birthYear={birthYear}
                  deathYear={deathYear}
                  birthMonth={birthMonth}
                  birthDay={birthDay}
                  deathMonth={deathMonth}
                  deathDay={deathDay}
                  t={t}
                />
              </label>
              <DateRow
                year={birthYear}
                monthLabel={t("person.birthMonth")}
                dayLabel={t("person.birthDay")}
                month={birthMonth}
                day={birthDay}
                monthNames={monthNames}
                onMonthChange={handleBirthMonthChange}
                onDayChange={setBirthDay}
              />
              <label className="detail-panel__field">
                <span>{t("person.deathYear")}</span>
                <input
                  type="number"
                  value={deathYear}
                  onChange={(e) => handleDeathYearChange(e.target.value)}
                  placeholder="---"
                />
              </label>
              <DateRow
                year={deathYear}
                monthLabel={t("person.deathMonth")}
                dayLabel={t("person.deathDay")}
                month={deathMonth}
                day={deathDay}
                monthNames={monthNames}
                onMonthChange={handleDeathMonthChange}
                onDayChange={setDeathDay}
              />
              <label className="detail-panel__field">
                <span>{t("person.gender")}</span>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="male">{t("person.male")}</option>
                  <option value="female">{t("person.female")}</option>
                  <option value="other">{t("person.other")}</option>
                </select>
              </label>
              <label className="detail-panel__field detail-panel__field--checkbox">
                <input
                  type="checkbox"
                  checked={isAdopted}
                  onChange={(e) => setIsAdopted(e.target.checked)}
                />
                <span>{t("person.isAdopted")}</span>
              </label>
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
            </div>
          )}
        </section>

        {/* Relationships section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setRelsOpen(!relsOpen)}
          >
            {relsOpen ? "\u25BC" : "\u25B6"} {t("relationship.relationships")} (
            {relationships.length + inferredSiblings.length})
          </button>
          {relsOpen && (
            <div className="detail-panel__section-body">
              {relationships.length === 0 && inferredSiblings.length === 0 ? (
                <p className="detail-panel__empty">---</p>
              ) : (
                <ul className="detail-panel__rel-list">
                  {relationships.map((rel) => {
                    const isSource = rel.source_person_id === person.id;
                    const otherId = isSource ? rel.target_person_id : rel.source_person_id;
                    const otherPerson = allPersons.get(otherId);
                    const isParentType =
                      rel.type === RelationshipType.BiologicalParent ||
                      rel.type === RelationshipType.StepParent ||
                      rel.type === RelationshipType.AdoptiveParent;
                    const isExPartner =
                      rel.type === RelationshipType.Partner &&
                      rel.periods.length > 0 &&
                      rel.periods.every((p) => p.end_year != null);
                    const typeLabel = isExPartner
                      ? t("relationship.type.exPartner")
                      : isParentType && isSource
                        ? t(`relationship.childOf.${rel.type}`)
                        : t(`relationship.type.${rel.type}`);
                    return (
                      <li key={rel.id} className="detail-panel__rel-item">
                        <span className="detail-panel__rel-type">{typeLabel}</span>
                        <span className="detail-panel__rel-name">{otherPerson?.name ?? "?"}</span>
                        {rel.type === RelationshipType.Partner &&
                          (editingRelId === rel.id ? (
                            <PartnerPeriodEditor
                              relationship={rel}
                              sourceDeathYear={person.death_year}
                              targetDeathYear={otherPerson?.death_year ?? null}
                              onSave={(data) => {
                                onSaveRelationship(rel.id, data);
                                setEditingRelId(null);
                              }}
                              onCancel={() => setEditingRelId(null)}
                            />
                          ) : (
                            <>
                              {rel.periods.length > 0 && (
                                <div className="detail-panel__rel-periods">
                                  {rel.periods.map((p) => (
                                    <span
                                      key={`${p.status}-${p.start_year}-${p.end_year}`}
                                      className="detail-panel__period"
                                    >
                                      {t(`relationship.status.${p.status}`)}: {p.start_year}
                                      {p.end_year ? ` - ${p.end_year}` : " -"}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                className="detail-panel__btn--small"
                                style={{ marginTop: 4 }}
                                onClick={() => setEditingRelId(rel.id)}
                              >
                                {t(T_EDIT)}
                              </button>
                            </>
                          ))}
                      </li>
                    );
                  })}
                  {inferredSiblings.map((sib) => {
                    const otherId = sib.personAId === person.id ? sib.personBId : sib.personAId;
                    const otherPerson = allPersons.get(otherId);
                    const sharedParentNames = sib.sharedParentIds
                      .map((id) => allPersons.get(id)?.name ?? "?")
                      .join(", ");
                    return (
                      <li key={`inferred-${otherId}`} className="detail-panel__rel-item">
                        <span className="detail-panel__rel-type">
                          {t(`relationship.type.${sib.type}`)}
                        </span>
                        <span className="detail-panel__rel-name">{otherPerson?.name ?? "?"}</span>
                        <span className="detail-panel__rel-via">
                          {t("relationship.viaParent", { name: sharedParentNames })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Trauma events section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setEventsOpen(!eventsOpen)}
          >
            {eventsOpen ? "\u25BC" : "\u25B6"} {t("trauma.events")} ({events.length})
          </button>
          {eventsOpen && (
            <div className="detail-panel__section-body">
              {events.map((event) =>
                editingEventId === event.id ? (
                  <EventForm
                    key={event.id}
                    event={event}
                    allPersons={allPersons}
                    initialPersonIds={event.person_ids}
                    onSave={(data, personIds) => {
                      onSaveEvent(event.id, data, personIds);
                      setEditingEventId(null);
                    }}
                    onCancel={() => setEditingEventId(null)}
                    onDelete={() => {
                      onDeleteEvent(event.id);
                      setEditingEventId(null);
                    }}
                  />
                ) : (
                  <div key={event.id} className="detail-panel__event-item">
                    <div className="detail-panel__event-header">
                      <span
                        className="detail-panel__event-dot"
                        style={{
                          backgroundColor: getTraumaColor(event.category),
                        }}
                      />
                      <span className="detail-panel__event-title">{event.title}</span>
                      <button
                        type="button"
                        className="detail-panel__btn--small"
                        onClick={() => setEditingEventId(event.id)}
                      >
                        {t(T_EDIT)}
                      </button>
                    </div>
                    {event.approximate_date && (
                      <div className="detail-panel__event-date">{event.approximate_date}</div>
                    )}
                  </div>
                ),
              )}

              {showNewEvent ? (
                <EventForm
                  event={null}
                  allPersons={allPersons}
                  initialPersonIds={[person.id]}
                  onSave={(data, personIds) => {
                    onSaveEvent(null, data, personIds);
                    setShowNewEvent(false);
                  }}
                  onCancel={() => setShowNewEvent(false)}
                />
              ) : (
                <button
                  type="button"
                  className="detail-panel__btn detail-panel__btn--secondary"
                  onClick={() => setShowNewEvent(true)}
                >
                  {t("trauma.newEvent")}
                </button>
              )}
            </div>
          )}
        </section>
        {/* Life events section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setLifeEventsOpen(!lifeEventsOpen)}
          >
            {lifeEventsOpen ? "\u25BC" : "\u25B6"} {t("lifeEvent.events")} ({lifeEvents.length})
          </button>
          {lifeEventsOpen && (
            <div className="detail-panel__section-body">
              {lifeEvents.map((event) =>
                editingLifeEventId === event.id ? (
                  <LifeEventForm
                    key={event.id}
                    event={event}
                    allPersons={allPersons}
                    initialPersonIds={event.person_ids}
                    onSave={(data, personIds) => {
                      onSaveLifeEvent(event.id, data, personIds);
                      setEditingLifeEventId(null);
                    }}
                    onCancel={() => setEditingLifeEventId(null)}
                    onDelete={() => {
                      onDeleteLifeEvent(event.id);
                      setEditingLifeEventId(null);
                    }}
                  />
                ) : (
                  <div key={event.id} className="detail-panel__event-item">
                    <div className="detail-panel__event-header">
                      <span
                        className="detail-panel__event-dot"
                        style={{
                          backgroundColor: getLifeEventColor(event.category),
                          borderRadius: 2,
                        }}
                      />
                      <span className="detail-panel__event-title">{event.title}</span>
                      <button
                        type="button"
                        className="detail-panel__btn--small"
                        onClick={() => setEditingLifeEventId(event.id)}
                      >
                        {t(T_EDIT)}
                      </button>
                    </div>
                    {event.approximate_date && (
                      <div className="detail-panel__event-date">{event.approximate_date}</div>
                    )}
                  </div>
                ),
              )}

              {showNewLifeEvent ? (
                <LifeEventForm
                  event={null}
                  allPersons={allPersons}
                  initialPersonIds={[person.id]}
                  onSave={(data, personIds) => {
                    onSaveLifeEvent(null, data, personIds);
                    setShowNewLifeEvent(false);
                  }}
                  onCancel={() => setShowNewLifeEvent(false)}
                />
              ) : (
                <button
                  type="button"
                  className="detail-panel__btn detail-panel__btn--secondary"
                  onClick={() => setShowNewLifeEvent(true)}
                >
                  {t("lifeEvent.newEvent")}
                </button>
              )}
            </div>
          )}
        </section>
        {/* Classifications section */}
        <section className="detail-panel__section">
          <button
            type="button"
            className="detail-panel__section-toggle"
            onClick={() => setClassificationsOpen(!classificationsOpen)}
          >
            {classificationsOpen ? "\u25BC" : "\u25B6"} {t("classification.classifications")} (
            {classifications.length})
          </button>
          {classificationsOpen && (
            <div className="detail-panel__section-body">
              {classifications.map((cls) =>
                editingClassificationId === cls.id ? (
                  <ClassificationForm
                    key={cls.id}
                    classification={cls}
                    allPersons={allPersons}
                    initialPersonIds={cls.person_ids}
                    onSave={(data, personIds) => {
                      onSaveClassification(cls.id, data, personIds);
                      setEditingClassificationId(null);
                    }}
                    onCancel={() => setEditingClassificationId(null)}
                    onDelete={() => {
                      onDeleteClassification(cls.id);
                      setEditingClassificationId(null);
                    }}
                  />
                ) : (
                  <div key={cls.id} className="detail-panel__event-item">
                    <div className="detail-panel__event-header">
                      <span
                        className="detail-panel__event-dot"
                        style={{
                          backgroundColor: getClassificationColor(cls.status),
                          borderRadius: 0,
                          clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
                        }}
                      />
                      <span className="detail-panel__event-title">
                        {t(`dsm.${cls.dsm_category}`)}
                        {cls.dsm_subcategory && ` - ${t(`dsm.sub.${cls.dsm_subcategory}`)}`}
                      </span>
                      <button
                        type="button"
                        className="detail-panel__btn--small"
                        onClick={() => setEditingClassificationId(cls.id)}
                      >
                        {t(T_EDIT)}
                      </button>
                    </div>
                    <div className="detail-panel__event-date">
                      {t(`classification.status.${cls.status}`)}
                      {cls.diagnosis_year && ` (${cls.diagnosis_year})`}
                    </div>
                  </div>
                ),
              )}

              {showNewClassification ? (
                <ClassificationForm
                  classification={null}
                  allPersons={allPersons}
                  initialPersonIds={[person.id]}
                  onSave={(data, personIds) => {
                    onSaveClassification(null, data, personIds);
                    setShowNewClassification(false);
                  }}
                  onCancel={() => setShowNewClassification(false)}
                />
              ) : (
                <button
                  type="button"
                  className="detail-panel__btn detail-panel__btn--secondary"
                  onClick={() => setShowNewClassification(true)}
                >
                  {t("classification.newClassification")}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
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

  const sortedPersons = Array.from(allPersons.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const togglePerson = (personId: string) => togglePersonInSet(personId, setSelectedPersonIds);

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
      <fieldset className="detail-panel__field detail-panel__person-checkboxes">
        <span>{t("classification.linkedPersons")}</span>
        {sortedPersons.map((p) => (
          <label key={p.id} className="detail-panel__field--checkbox">
            <input
              type="checkbox"
              checked={selectedPersonIds.has(p.id)}
              onChange={() => togglePerson(p.id)}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </fieldset>
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

interface LifeEventFormProps {
  event: DecryptedLifeEvent | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: LifeEvent, personIds: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function LifeEventForm({
  event,
  allPersons,
  initialPersonIds,
  onSave,
  onCancel,
  onDelete,
}: LifeEventFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState<LifeEventCategory>(
    event?.category ?? LifeEventCategory.Family,
  );
  const [approximateDate, setApproximateDate] = useState(event?.approximate_date ?? "");
  const [impact, setImpact] = useState(event?.impact != null ? String(event.impact) : "");
  const [tags, setTags] = useState(event?.tags?.join(", ") ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );

  const sortedPersons = Array.from(allPersons.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const togglePerson = (personId: string) => togglePersonInSet(personId, setSelectedPersonIds);

  function handleSave() {
    onSave(
      {
        title,
        description,
        category,
        approximate_date: approximateDate,
        impact: impact ? parseInt(impact, 10) || null : null,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("lifeEvent.title")}</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.description")}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.category")}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as LifeEventCategory)}>
          {Object.values(LifeEventCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`lifeEvent.category.${cat}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.approximateDate")}</span>
        <input
          type="text"
          value={approximateDate}
          onChange={(e) => setApproximateDate(e.target.value)}
          placeholder="e.g. 1985"
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.impact")} (1-10)</span>
        <input
          type="number"
          min="1"
          max="10"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder="---"
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.tags")}</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2"
        />
      </label>
      <fieldset className="detail-panel__field detail-panel__person-checkboxes">
        <span>{t("lifeEvent.linkedPersons")}</span>
        {sortedPersons.map((p) => (
          <label key={p.id} className="detail-panel__field--checkbox">
            <input
              type="checkbox"
              checked={selectedPersonIds.has(p.id)}
              onChange={() => togglePerson(p.id)}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </fieldset>
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
            {confirmDelete ? t("lifeEvent.confirmDelete") : t(T_DELETE)}
          </button>
        )}
      </div>
    </div>
  );
}

interface EventFormProps {
  event: DecryptedEvent | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: TraumaEvent, personIds: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function EventForm({
  event,
  allPersons,
  initialPersonIds,
  onSave,
  onCancel,
  onDelete,
}: EventFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState<TraumaCategory>(event?.category ?? TraumaCategory.Loss);
  const [approximateDate, setApproximateDate] = useState(event?.approximate_date ?? "");
  const [severity, setSeverity] = useState(String(event?.severity ?? 5));
  const [tags, setTags] = useState(event?.tags?.join(", ") ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );

  const sortedPersons = Array.from(allPersons.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const togglePerson = (personId: string) => togglePersonInSet(personId, setSelectedPersonIds);

  function handleSave() {
    onSave(
      {
        title,
        description,
        category,
        approximate_date: approximateDate,
        severity: parseInt(severity, 10) || 1,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("trauma.title")}</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.description")}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.category")}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as TraumaCategory)}>
          {Object.values(TraumaCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`trauma.category.${cat}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.approximateDate")}</span>
        <input
          type="text"
          value={approximateDate}
          onChange={(e) => setApproximateDate(e.target.value)}
          placeholder="e.g. 1985"
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.severity")} (1-10)</span>
        <input
          type="number"
          min="1"
          max="10"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.tags")}</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2"
        />
      </label>
      <fieldset className="detail-panel__field detail-panel__person-checkboxes">
        <span>{t("trauma.linkedPersons")}</span>
        {sortedPersons.map((p) => (
          <label key={p.id} className="detail-panel__field--checkbox">
            <input
              type="checkbox"
              checked={selectedPersonIds.has(p.id)}
              onChange={() => togglePerson(p.id)}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </fieldset>
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
            {confirmDelete ? t("trauma.confirmDelete") : t(T_DELETE)}
          </button>
        )}
      </div>
    </div>
  );
}

interface PartnerPeriodEditorProps {
  relationship: DecryptedRelationship;
  sourceDeathYear: number | null;
  targetDeathYear: number | null;
  onSave: (data: RelationshipData) => void;
  onCancel: () => void;
}

function PartnerPeriodEditor({
  relationship,
  sourceDeathYear,
  targetDeathYear,
  onSave,
  onCancel,
}: PartnerPeriodEditorProps) {
  const { t } = useTranslation();
  const [periods, setPeriods] = useState<RelationshipPeriod[]>(() =>
    relationship.periods.length > 0
      ? relationship.periods
      : [{ start_year: new Date().getFullYear(), end_year: null, status: PartnerStatus.Together }],
  );

  function addPeriod() {
    setPeriods((prev) => [
      ...prev,
      { start_year: new Date().getFullYear(), end_year: null, status: PartnerStatus.Together },
    ]);
  }

  function removePeriod(index: number) {
    setPeriods((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePeriod(index: number, field: keyof RelationshipPeriod, value: string) {
    setPeriods((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "status") return { ...p, status: value as PartnerStatus };
        if (field === "end_year") return { ...p, end_year: value ? parseInt(value, 10) : null };
        return { ...p, [field]: parseInt(value, 10) || 0 };
      }),
    );
  }

  function handleSave() {
    onSave({
      type: relationship.type,
      periods: withAutoDissolvedPeriods(periods, {
        source: sourceDeathYear,
        target: targetDeathYear,
      }),
      active_period: relationship.active_period,
    });
  }

  return (
    <div className="detail-panel__period-editor">
      {periods.map((period, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: periods are edited by index
          key={i}
          className="detail-panel__period-row"
        >
          <label className="detail-panel__field">
            <span>{t("relationship.status")}</span>
            <select
              value={period.status}
              onChange={(e) => updatePeriod(i, "status", e.target.value)}
            >
              {Object.values(PartnerStatus).map((s) => (
                <option key={s} value={s}>
                  {t(`relationship.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
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
          {periods.length > 1 && (
            <button
              type="button"
              className="detail-panel__btn--small detail-panel__btn--danger"
              onClick={() => removePeriod(i)}
            >
              {t("relationship.removePeriod")}
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="detail-panel__btn--small"
        style={{ marginTop: 4 }}
        onClick={addPeriod}
      >
        {t("relationship.addPeriod")}
      </button>
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
      </div>
    </div>
  );
}
