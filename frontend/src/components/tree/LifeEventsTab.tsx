import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedLifeEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import type { LifeEvent } from "../../types/domain";
import { LifeEventCategory } from "../../types/domain";
import { EditSubPanel } from "./EditSubPanel";
import { PersonLinkField } from "./PersonLinkField";
import { SeverityBar } from "./TraumaEventsTab";

const T_SAVE = "common.save";
const T_CANCEL = "common.cancel";
const T_DELETE = "common.delete";

interface LifeEventsTabProps {
  person: DecryptedPerson;
  lifeEvents: DecryptedLifeEvent[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveLifeEvent: (lifeEventId: string | null, data: LifeEvent, personIds: string[]) => void;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  initialEditId?: string;
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
          placeholder={t("lifeEvent.datePlaceholder")}
        />
      </label>
      <label className="detail-panel__field">
        <span>
          {t("lifeEvent.impact")} ({impact})
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.tags")}</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("lifeEvent.tagsPlaceholder")}
        />
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
            {confirmDelete ? t("lifeEvent.confirmDelete") : t(T_DELETE)}
          </button>
        )}
      </div>
    </div>
  );
}

export function LifeEventsTab({
  person,
  lifeEvents,
  allPersons,
  onSaveLifeEvent,
  onDeleteLifeEvent,
  initialEditId,
}: LifeEventsTabProps) {
  const { t } = useTranslation();
  const [editingLifeEventId, setEditingLifeEventId] = useState<string | null>(
    initialEditId ?? null,
  );
  const [showNewLifeEvent, setShowNewLifeEvent] = useState(false);

  useEffect(() => {
    if (initialEditId) {
      setEditingLifeEventId(initialEditId);
      setShowNewLifeEvent(false);
    }
  }, [initialEditId]);

  if (editingLifeEventId || showNewLifeEvent) {
    return (
      <EditSubPanel
        title={
          editingLifeEventId
            ? (lifeEvents.find((e) => e.id === editingLifeEventId)?.title ??
              t("lifeEvent.editEvent"))
            : t("lifeEvent.newEvent")
        }
        onBack={() => {
          setEditingLifeEventId(null);
          setShowNewLifeEvent(false);
        }}
      >
        <LifeEventForm
          event={
            editingLifeEventId
              ? (lifeEvents.find((e) => e.id === editingLifeEventId) ?? null)
              : null
          }
          allPersons={allPersons}
          initialPersonIds={
            editingLifeEventId
              ? (lifeEvents.find((e) => e.id === editingLifeEventId)?.person_ids ?? [person.id])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveLifeEvent(editingLifeEventId, data, personIds);
            setEditingLifeEventId(null);
            setShowNewLifeEvent(false);
          }}
          onCancel={() => {
            setEditingLifeEventId(null);
            setShowNewLifeEvent(false);
          }}
          onDelete={
            editingLifeEventId
              ? () => {
                  onDeleteLifeEvent(editingLifeEventId);
                  setEditingLifeEventId(null);
                }
              : undefined
          }
        />
      </EditSubPanel>
    );
  }

  return (
    <>
      {lifeEvents.map((event) => (
        <button
          key={event.id}
          type="button"
          className="detail-panel__event-card"
          onClick={() => setEditingLifeEventId(event.id)}
        >
          <div className="detail-panel__event-card-row">
            <span
              className="detail-panel__event-card-dot"
              style={{
                backgroundColor: getLifeEventColor(event.category),
                borderRadius: 2,
              }}
            />
            <span className="detail-panel__event-card-title">{event.title}</span>
            {event.approximate_date && (
              <span className="detail-panel__event-card-date">{event.approximate_date}</span>
            )}
          </div>
          <div className="detail-panel__event-card-meta">
            <span
              className="detail-panel__category-pill"
              style={{
                backgroundColor: `${getLifeEventColor(event.category)}26`,
                color: getLifeEventColor(event.category),
              }}
            >
              {t(`lifeEvent.category.${event.category}`)}
            </span>
            {event.impact != null && event.impact > 0 && (
              <SeverityBar value={event.impact} color={getLifeEventColor(event.category)} />
            )}
          </div>
        </button>
      ))}
      <button
        type="button"
        className="detail-panel__btn detail-panel__btn--secondary"
        onClick={() => setShowNewLifeEvent(true)}
      >
        {t("lifeEvent.newEvent")}
      </button>
    </>
  );
}
