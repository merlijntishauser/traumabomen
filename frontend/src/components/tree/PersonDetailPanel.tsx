import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import { getTraumaColor } from "../../lib/traumaColors";
import type {
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
} from "../../types/domain";
import "./PersonDetailPanel.css";

interface PersonDetailPanelProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  allPersons: Map<string, DecryptedPerson>;
  onSavePerson: (data: Person) => void;
  onDeletePerson: (personId: string) => void;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => void;
  onSaveEvent: (eventId: string | null, data: TraumaEvent, personIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
  onSaveLifeEvent: (lifeEventId: string | null, data: LifeEvent, personIds: string[]) => void;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  onClose: () => void;
}

export function PersonDetailPanel({
  person,
  relationships,
  inferredSiblings,
  events,
  lifeEvents,
  allPersons,
  onSavePerson,
  onDeletePerson,
  onSaveRelationship,
  onSaveEvent,
  onDeleteEvent,
  onSaveLifeEvent,
  onDeleteLifeEvent,
  onClose,
}: PersonDetailPanelProps) {
  const { t } = useTranslation();

  const [personOpen, setPersonOpen] = useState(true);
  const [relsOpen, setRelsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [lifeEventsOpen, setLifeEventsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Person form state
  const [name, setName] = useState(person.name);
  const [birthYear, setBirthYear] = useState(String(person.birth_year));
  const [deathYear, setDeathYear] = useState(
    person.death_year != null ? String(person.death_year) : "",
  );
  const [gender, setGender] = useState(person.gender);
  const [isAdopted, setIsAdopted] = useState(person.is_adopted);
  const [notes, setNotes] = useState(person.notes ?? "");

  // Reset form when person changes
  useEffect(() => {
    setName(person.name);
    setBirthYear(String(person.birth_year));
    setDeathYear(person.death_year != null ? String(person.death_year) : "");
    setGender(person.gender);
    setIsAdopted(person.is_adopted);
    setNotes(person.notes ?? "");
    setConfirmDelete(false);
    setEditingRelId(null);
    setEditingEventId(null);
    setShowNewEvent(false);
    setEditingLifeEventId(null);
    setShowNewLifeEvent(false);
  }, [
    person.birth_year,
    person.death_year,
    person.gender,
    person.is_adopted,
    person.name,
    person.notes,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSavePerson() {
    onSavePerson({
      name,
      birth_year: parseInt(birthYear, 10) || 0,
      death_year: deathYear ? parseInt(deathYear, 10) : null,
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
                  onChange={(e) => setBirthYear(e.target.value)}
                />
              </label>
              <label className="detail-panel__field">
                <span>{t("person.deathYear")}</span>
                <input
                  type="number"
                  value={deathYear}
                  onChange={(e) => setDeathYear(e.target.value)}
                  placeholder="---"
                />
              </label>
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
                                {t("common.edit")}
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
                        {t("common.edit")}
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
                        {t("common.edit")}
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

  function togglePerson(personId: string) {
    setSelectedPersonIds((prev) => {
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
          {t("common.save")}
        </button>
        <button type="button" className="detail-panel__btn" onClick={onCancel}>
          {t("common.cancel")}
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
            {confirmDelete ? t("lifeEvent.confirmDelete") : t("common.delete")}
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

  function togglePerson(personId: string) {
    setSelectedPersonIds((prev) => {
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
          {t("common.save")}
        </button>
        <button type="button" className="detail-panel__btn" onClick={onCancel}>
          {t("common.cancel")}
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
            {confirmDelete ? t("trauma.confirmDelete") : t("common.delete")}
          </button>
        )}
      </div>
    </div>
  );
}

interface PartnerPeriodEditorProps {
  relationship: DecryptedRelationship;
  onSave: (data: RelationshipData) => void;
  onCancel: () => void;
}

function PartnerPeriodEditor({ relationship, onSave, onCancel }: PartnerPeriodEditorProps) {
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
      periods,
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
          {t("common.save")}
        </button>
        <button type="button" className="detail-panel__btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
