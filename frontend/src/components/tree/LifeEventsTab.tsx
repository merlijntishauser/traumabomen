import { useTranslation } from "react-i18next";
import { useEditingState } from "../../hooks/useEditingState";
import type { DecryptedLifeEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import type { LifeEvent } from "../../types/domain";
import { LifeEventCategory } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { blurOnEnter } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { useSaveReporter } from "../inspector/InspectorStatus";
import { useEntityAutosave } from "../inspector/useEntityAutosave";
import { EditSubPanel } from "./EditSubPanel";
import { EventCard } from "./EventCard";
import { PersonLinkField } from "./PersonLinkField";

interface LifeEventsTabProps {
  person: DecryptedPerson;
  lifeEvents: DecryptedLifeEvent[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveLifeEvent: (
    lifeEventId: string | null,
    data: LifeEvent,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  initialEditId?: string;
}

interface LifeEventFormProps {
  event: DecryptedLifeEvent | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: LifeEvent, personIds: string[]) => Promise<unknown> | undefined;
  onDelete?: () => void;
}

interface LifeEventDraft {
  title: string;
  description: string;
  category: LifeEventCategory;
  approximateDate: string;
  impact: string;
  tags: string;
  personIds: string[];
}

function buildLifeEventData(
  draft: LifeEventDraft,
): { data: LifeEvent; personIds: string[] } | null {
  if (!draft.title.trim() || draft.personIds.length === 0) return null;
  return {
    data: {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      approximate_date: draft.approximateDate,
      impact: draft.impact ? parseInt(draft.impact, 10) || null : null,
      tags: draft.tags.split(",").flatMap((s) => {
        const trimmed = s.trim();
        return trimmed ? [trimmed] : [];
      }),
    },
    personIds: draft.personIds,
  };
}

function LifeEventForm({
  event,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: LifeEventFormProps) {
  const { t } = useTranslation();
  const report = useSaveReporter();

  const { isNew, draft, update, commit, changeAndCommit, scheduleCommit, buildData } =
    useEntityAutosave({
      entity: event,
      toDraft: (e) => ({
        title: e?.title ?? "",
        description: e?.description ?? "",
        category: e?.category ?? LifeEventCategory.Family,
        approximateDate: e?.approximate_date ?? "",
        impact: e?.impact != null ? String(e.impact) : "",
        tags: e?.tags?.join(", ") ?? "",
        personIds: e?.person_ids ?? initialPersonIds,
      }),
      toData: buildLifeEventData,
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
      <InspectorField label={t("lifeEvent.title")}>
        <input
          type="text"
          aria-label={t("lifeEvent.title")}
          value={draft.title}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
      </InspectorField>
      <InspectorField label={t("lifeEvent.description")}>
        <textarea
          aria-label={t("lifeEvent.description")}
          value={draft.description}
          onChange={(e) => {
            update((d) => ({ ...d, description: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
          rows={2}
        />
      </InspectorField>
      <InspectorField label={t("lifeEvent.category")}>
        <select
          value={draft.category}
          onChange={(e) =>
            changeAndCommit((d) => ({ ...d, category: e.target.value as LifeEventCategory }))
          }
        >
          {Object.values(LifeEventCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`lifeEvent.category.${cat}`)}
            </option>
          ))}
        </select>
      </InspectorField>
      <InspectorField label={t("lifeEvent.approximateDate")}>
        <input
          type="text"
          aria-label={t("lifeEvent.approximateDate")}
          value={draft.approximateDate}
          onChange={(e) => update((d) => ({ ...d, approximateDate: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          placeholder={t("lifeEvent.datePlaceholder")}
        />
      </InspectorField>
      <InspectorField label={`${t("lifeEvent.impact")} (${draft.impact || "-"})`}>
        <input
          type="range"
          aria-label={t("lifeEvent.impact")}
          min="1"
          max="10"
          value={draft.impact || "5"}
          onChange={(e) => {
            update((d) => ({ ...d, impact: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
        />
      </InspectorField>
      <InspectorField label={t("lifeEvent.tags")}>
        <input
          type="text"
          aria-label={t("lifeEvent.tags")}
          value={draft.tags}
          onChange={(e) => update((d) => ({ ...d, tags: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          placeholder={t("lifeEvent.tagsPlaceholder")}
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
              confirmLabel={t("lifeEvent.confirmDelete")}
            />
          </div>
        )
      )}
    </>
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
  const { editingId, setEditingId, isEditing, setShowNew, clearEditing } =
    useEditingState(initialEditId);

  if (isEditing) {
    const event = editingId ? (lifeEvents.find((e) => e.id === editingId) ?? null) : null;
    return (
      <EditSubPanel
        title={editingId ? (event?.title ?? t("lifeEvent.editEvent")) : t("lifeEvent.newEvent")}
        onBack={clearEditing}
        closeLabel={editingId ? t("common.close") : undefined}
      >
        <LifeEventForm
          key={editingId ?? "new"}
          event={event}
          allPersons={allPersons}
          initialPersonIds={event?.person_ids ?? [person.id]}
          onSave={(data, personIds) => {
            const result = onSaveLifeEvent(editingId, data, personIds);
            if (!editingId) clearEditing();
            return result;
          }}
          onDelete={
            editingId
              ? () => {
                  onDeleteLifeEvent(editingId);
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
      {lifeEvents.map((event) => (
        <EventCard
          key={event.id}
          title={event.title}
          approximateDate={event.approximate_date}
          categoryLabel={t(`lifeEvent.category.${event.category}`)}
          color={getLifeEventColor(event.category)}
          barValue={event.impact}
          dotStyle={{ borderRadius: 2 }}
          onClick={() => setEditingId(event.id)}
        />
      ))}
      <button
        type="button"
        className="btn detail-panel__btn--secondary"
        onClick={() => setShowNew(true)}
      >
        {t("lifeEvent.newEvent")}
      </button>
    </>
  );
}
