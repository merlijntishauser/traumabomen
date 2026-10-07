import type { TFunction } from "i18next";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LifelineEditing } from "../../hooks/useLifelineEditing";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { getClassificationColor } from "../../lib/classificationColors";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import {
  buildLifelineEntries,
  buildLifelineRows,
  LIFELINE_KINDS,
  type LifelineEntry,
  type LifelineKind,
  type LifelineRow,
} from "../../lib/lifeline";
import { classificationLabel } from "../../lib/patternEntities";
import { getTraumaColor } from "../../lib/traumaColors";
import { getTurningPointColor } from "../../lib/turningPointColors";
import type { Classification, LifeEvent, TraumaEvent, TurningPoint } from "../../types/domain";
import { ClassificationForm } from "./ClassificationForm";
import { LifeEventForm } from "./LifeEventForm";
import { TraumaEventForm } from "./TraumaEventForm";
import { TurningPointForm } from "./TurningPointForm";

export interface LifelineEntityHandlers {
  onSaveEvent: (
    eventId: string | null,
    data: TraumaEvent,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDeleteEvent: (eventId: string) => void;
  onSaveLifeEvent: (
    lifeEventId: string | null,
    data: LifeEvent,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  onSaveTurningPoint: (
    turningPointId: string | null,
    data: TurningPoint,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDeleteTurningPoint: (turningPointId: string) => void;
  onSaveClassification: (
    classificationId: string | null,
    data: Classification,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDeleteClassification: (classificationId: string) => void;
}

interface LifelineEditingControls {
  editing: LifelineEditing | null;
  isOpen: (kind: LifelineKind, id: string | null) => boolean;
  toggle: (kind: LifelineKind, id: string) => void;
  startNew: (kind: LifelineKind) => void;
  close: () => void;
}

interface LifelineSources {
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints: DecryptedTurningPoint[];
  classifications: DecryptedClassification[];
}

function entryColor(entry: LifelineEntry): string {
  switch (entry.kind) {
    case "trauma_event":
      return getTraumaColor(entry.entity.category);
    case "life_event":
      return getLifeEventColor(entry.entity.category);
    case "turning_point":
      return getTurningPointColor(entry.entity.category);
    case "classification":
      return getClassificationColor(entry.entity.status);
  }
}

function entryTitle(entry: LifelineEntry, t: TFunction): string {
  return entry.kind === "classification"
    ? classificationLabel(entry.entity, t)
    : entry.entity.title || t("personPage.untitled");
}

function entryDescription(entry: LifelineEntry): string {
  return entry.kind === "classification" ? (entry.entity.notes ?? "") : entry.entity.description;
}

function entryKindParts(entry: LifelineEntry, t: TFunction): string[] {
  switch (entry.kind) {
    case "trauma_event":
      return [
        t("personPage.kind.trauma_event"),
        t(`trauma.category.${entry.entity.category}`).toLowerCase(),
      ];
    case "life_event":
      return [
        t("personPage.kind.life_event"),
        t(`lifeEvent.category.${entry.entity.category}`).toLowerCase(),
      ];
    case "turning_point":
      return [
        t("personPage.kind.turning_point"),
        t(`turningPoint.category.${entry.entity.category}`).toLowerCase(),
      ];
    case "classification": {
      const parts = [t(`classification.status.${entry.entity.status}`)];
      if (entry.year != null) {
        parts.push(
          entry.endYear != null
            ? `${entry.year}-${entry.endYear}`
            : `${entry.year}, ${t("common.ongoing")}`,
        );
      }
      return parts;
    }
  }
}

/** One quiet line under the title: kind, category, and who else it involves. */
function entryMeta(
  entry: LifelineEntry,
  personId: string,
  allPersons: Map<string, DecryptedPerson>,
  listFormat: Intl.ListFormat,
  t: TFunction,
): string {
  const meta = entryKindParts(entry, t).join(", ");
  const others = entry.entity.person_ids.filter((id) => id !== personId);
  if (others.length === 0) return meta;
  const names = listFormat.format(others.map((id) => allPersons.get(id)?.name ?? "?"));
  return `${meta}, ${t("personPage.with", { names })}`;
}

function ageAt(year: number | null, birthYear: number | null): number | null {
  return year != null && birthYear != null && year >= birthYear ? year - birthYear : null;
}

/** The lifeline's mark for a kind, in the canvas badge grammar. */
function LifelineMark({ kind, color }: { kind: LifelineKind; color: string }) {
  return (
    <span
      className={`lifeline__mark lifeline__mark--${kind}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

interface EntryFormProps extends LifelineSources {
  kind: LifelineKind;
  id: string | null;
  personId: string;
  allPersons: Map<string, DecryptedPerson>;
  handlers: LifelineEntityHandlers;
  onDone: () => void;
}

/** The existing autosave form for one entry, or the explicit-Add form for a new one. */
function LifelineEntryForm({
  kind,
  id,
  personId,
  allPersons,
  handlers,
  onDone,
  events,
  lifeEvents,
  turningPoints,
  classifications,
}: EntryFormProps) {
  const fallbackPersonIds = [personId];
  function saveThen<T>(result: T): T {
    if (!id) onDone();
    return result;
  }
  function removeThen(remove: (entityId: string) => void) {
    return id
      ? () => {
          remove(id);
          onDone();
        }
      : undefined;
  }
  switch (kind) {
    case "trauma_event": {
      const event = id ? (events.find((e) => e.id === id) ?? null) : null;
      return (
        <TraumaEventForm
          key={id ?? "new"}
          event={event}
          allPersons={allPersons}
          initialPersonIds={event?.person_ids ?? fallbackPersonIds}
          onSave={(data, ids) => saveThen(handlers.onSaveEvent(id, data, ids))}
          onDelete={removeThen(handlers.onDeleteEvent)}
        />
      );
    }
    case "life_event": {
      const event = id ? (lifeEvents.find((e) => e.id === id) ?? null) : null;
      return (
        <LifeEventForm
          key={id ?? "new"}
          event={event}
          allPersons={allPersons}
          initialPersonIds={event?.person_ids ?? fallbackPersonIds}
          onSave={(data, ids) => saveThen(handlers.onSaveLifeEvent(id, data, ids))}
          onDelete={removeThen(handlers.onDeleteLifeEvent)}
        />
      );
    }
    case "turning_point": {
      const tp = id ? (turningPoints.find((e) => e.id === id) ?? null) : null;
      return (
        <TurningPointForm
          key={id ?? "new"}
          turningPoint={tp}
          allPersons={allPersons}
          initialPersonIds={tp?.person_ids ?? fallbackPersonIds}
          onSave={(data, ids) => saveThen(handlers.onSaveTurningPoint(id, data, ids))}
          onDelete={removeThen(handlers.onDeleteTurningPoint)}
        />
      );
    }
    case "classification": {
      const cls = id ? (classifications.find((e) => e.id === id) ?? null) : null;
      return (
        <ClassificationForm
          key={id ?? "new"}
          classification={cls}
          allPersons={allPersons}
          initialPersonIds={cls?.person_ids ?? fallbackPersonIds}
          onSave={(data, ids) => saveThen(handlers.onSaveClassification(id, data, ids))}
          onDelete={removeThen(handlers.onDeleteClassification)}
        />
      );
    }
  }
}

interface EntryRowProps {
  entry: LifelineEntry;
  open: boolean;
  title: string;
  meta: string;
  birthYear: number | null;
  onToggle: () => void;
  onHover: (entry: LifelineEntry | null) => void;
}

function LifelineEntryRow({
  entry,
  open,
  title,
  meta,
  birthYear,
  onToggle,
  onHover,
}: EntryRowProps) {
  const { t } = useTranslation();
  const description = entryDescription(entry);
  const age = ageAt(entry.year, birthYear);
  return (
    <li
      className={`lifeline__row${open ? " lifeline__row--open" : ""}`}
      onPointerEnter={() => onHover(entry)}
      onPointerLeave={() => onHover(null)}
    >
      <span className="lifeline__year">
        {entry.year}
        {age != null && <small>{t("personPage.age", { age })}</small>}
      </span>
      <span className="lifeline__spine">
        <LifelineMark kind={entry.kind} color={entryColor(entry)} />
      </span>
      <button
        type="button"
        className="lifeline__entry"
        aria-expanded={open}
        onClick={onToggle}
        onFocus={() => onHover(entry)}
        onBlur={() => onHover(null)}
      >
        <span className="lifeline__title">{title}</span>
        <span className="lifeline__meta">{meta}</span>
        {description && !open && <span className="lifeline__desc">{description}</span>}
      </button>
    </li>
  );
}

interface MarkRowProps {
  row: Extract<LifelineRow, { type: "birth" | "death" }>;
  birthYear: number | null;
}

function LifelineMarkRow({ row, birthYear }: MarkRowProps) {
  const { t } = useTranslation();
  const age = row.type === "death" ? ageAt(row.year, birthYear) : null;
  return (
    <li className="lifeline__row lifeline__row--plain">
      <span className="lifeline__year">
        {row.year}
        {age != null && <small>{t("personPage.age", { age })}</small>}
      </span>
      <span className="lifeline__spine">
        <span className="lifeline__tick" />
      </span>
      <span className="lifeline__plain">
        {t(row.type === "birth" ? "personPage.birth" : "personPage.death")}
      </span>
    </li>
  );
}

function LifelineGapRow({ years, onAdd }: { years: number; onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="lifeline__row lifeline__row--gap">
      <span className="lifeline__year" />
      <span className="lifeline__spine" />
      <span className="lifeline__plain">
        {t("personPage.gap", { count: years })}{" "}
        <button type="button" className="person-page__person-link" onClick={onAdd}>
          {t("personPage.addSomething")}
        </button>
      </span>
    </li>
  );
}

function AddToLifeMenu({
  firstName,
  open,
  onOpenChange,
  onPick,
}: {
  firstName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (kind: LifelineKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="person-page__add">
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <Plus size={15} aria-hidden="true" />
        {t("personPage.addTo", { name: firstName })}
      </button>
      {open && (
        <div className="person-page__add-menu">
          {LIFELINE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="person-page__add-item"
              onClick={() => {
                onPick(kind);
                onOpenChange(false);
              }}
            >
              <LifelineMark kind={kind} color="var(--color-text-muted)" />
              {t(`personPage.kind.${kind}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PersonLifelineProps extends LifelineSources {
  person: DecryptedPerson;
  allPersons: Map<string, DecryptedPerson>;
  handlers: LifelineEntityHandlers;
  editing: LifelineEditingControls;
  onHover: (entry: LifelineEntry | null) => void;
}

/**
 * The person's life read in order: birth, every entry on one line with long
 * silences named, then death. Each entry opens its form in place; new
 * entries start from the add menu.
 */
export function PersonLifeline({
  person,
  allPersons,
  handlers,
  editing,
  onHover,
  ...sources
}: PersonLifelineProps) {
  const { t, i18n } = useTranslation();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const listFormat = useMemo(
    () => new Intl.ListFormat(i18n.language, { type: "conjunction" }),
    [i18n.language],
  );

  const entries = buildLifelineEntries(sources, person.birth_year);
  const { rows, undated } = buildLifelineRows(entries, person.birth_year, person.death_year);
  const newKind = editing.editing?.id === null ? editing.editing.kind : null;
  const firstName = person.name.split(" ")[0] || person.name;

  const formProps = {
    personId: person.id,
    allPersons,
    handlers,
    onDone: editing.close,
    ...sources,
  };

  function entryItems(entry: LifelineEntry) {
    const open = editing.isOpen(entry.kind, entry.id);
    const row = (
      <LifelineEntryRow
        key={entry.id}
        entry={entry}
        open={open}
        title={entryTitle(entry, t)}
        meta={entryMeta(entry, person.id, allPersons, listFormat, t)}
        birthYear={person.birth_year}
        onToggle={() => editing.toggle(entry.kind, entry.id)}
        onHover={onHover}
      />
    );
    if (!open) return [row];
    return [
      row,
      <li key={`${entry.id}-editor`} className="lifeline__editor">
        <LifelineEntryForm kind={entry.kind} id={entry.id} {...formProps} />
      </li>,
    ];
  }

  return (
    <section className="person-page__section" aria-labelledby="person-page-life">
      <div className="person-page__section-head">
        <h3 id="person-page-life">{t("personPage.life")}</h3>
        <span>
          {entries.length > 0
            ? t("personPage.entries", { count: entries.length })
            : t("personPage.nothingYet")}
        </span>
      </div>

      {rows.length > 0 && (
        <ol className="lifeline">
          {rows.flatMap((row) => {
            if (row.type === "entry") return entryItems(row.entry);
            if (row.type === "gap") {
              return [
                <LifelineGapRow
                  key={`gap-${row.fromYear}`}
                  years={row.years}
                  onAdd={() => setAddMenuOpen(true)}
                />,
              ];
            }
            return [<LifelineMarkRow key={row.type} row={row} birthYear={person.birth_year} />];
          })}
          {person.death_year == null && (
            <li className="lifeline__row lifeline__row--living" aria-hidden="true">
              <span className="lifeline__year" />
              <span className="lifeline__spine" />
              <span />
            </li>
          )}
        </ol>
      )}

      {undated.length > 0 && (
        <>
          <h4 className="person-page__undated">{t("personPage.undated")}</h4>
          <ol className="lifeline lifeline--undated">{undated.flatMap(entryItems)}</ol>
        </>
      )}

      {newKind && (
        <div className="lifeline__editor lifeline__editor--new">
          <div className="lifeline__new-head">
            <span>{t(`personPage.new.${newKind}`)}</span>
            <button type="button" className="person-page__person-link" onClick={editing.close}>
              {t("common.cancel")}
            </button>
          </div>
          <LifelineEntryForm kind={newKind} id={null} {...formProps} />
        </div>
      )}

      <AddToLifeMenu
        firstName={firstName}
        open={addMenuOpen}
        onOpenChange={setAddMenuOpen}
        onPick={editing.startNew}
      />
    </section>
  );
}
