import type { TFunction } from "i18next";
import { ChevronDown, PenLine, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLifelineEditing } from "../../hooks/useLifelineEditing";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import type { LifelineEntry } from "../../lib/lifeline";
import { getPatternColor } from "../../lib/patternColors";
import { buildGlanceGroups, type GlanceGroup } from "../../lib/personGlance";
import { personPromptText, pickPersonPromptIndex } from "../../lib/reflectionPrompts";
import type { JournalLinkedRef, Person, RelationshipData } from "../../types/domain";
import {
  InspectorSaveWhisper,
  InspectorStatusProvider,
  useInspectorStatus,
} from "../inspector/InspectorStatus";
import { type LifelineEntityHandlers, PersonLifeline } from "./PersonLifeline";
import { PersonTab } from "./PersonTab";
import { RelationshipsTab } from "./RelationshipsTab";
import "./PersonDetailPanel.css";

export type PersonDetailSection =
  | "person"
  | "relationships"
  | "trauma_event"
  | "life_event"
  | "turning_point"
  | "classification"
  | null;

interface PersonDetailHandlers {
  onSavePerson: (data: Person) => Promise<unknown> | undefined;
  onDeletePerson: (personId: string) => void;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => Promise<unknown>;
  onClose: () => void;
}

interface PersonDetailPanelProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints: DecryptedTurningPoint[];
  classifications: DecryptedClassification[];
  allPersons: Map<string, DecryptedPerson>;
  initialSection?: PersonDetailSection;
  initialEntityId?: string;
  handlers: PersonDetailHandlers;
  entityHandlers: LifelineEntityHandlers;
  showReflectionPrompts?: boolean;
  onOpenJournal?: (prompt: string, linkedRef?: JournalLinkedRef) => void;
  siblingGroup?: DecryptedSiblingGroup | null;
  onCreateSiblingGroup?: () => void;
  onOpenSiblingGroup?: (groupId: string) => void;
  /** Opens another person's page from a name in the glance line. */
  onSelectPerson?: (personId: string) => void;
  /** Patterns this person belongs to, shown as focusable chips. */
  patterns?: DecryptedPattern[];
  focusedPatternId?: string | null;
  onFocusPattern?: (patternId: string | null) => void;
}

type FoldSection = "relationships" | "details";

const EMPTY_PATTERNS: DecryptedPattern[] = [];
const SAFE_ID = /^[\w-]+$/;

function foldFor(section: PersonDetailSection | undefined): FoldSection | null {
  if (section === "relationships") return "relationships";
  if (section === "person") return "details";
  return null;
}

function yearsLine(person: DecryptedPerson, t: TFunction): string {
  const parts: string[] = [];
  const by = person.birth_year;
  const dy = person.death_year;
  if (by != null && dy != null) parts.push(`${by} - ${dy}`);
  else if (by != null) parts.push(t("personPage.born", { year: by }));
  else if (dy != null) parts.push(t("personPage.died", { year: dy }));
  if (person.is_adopted) parts.push(t("person.isAdopted").toLowerCase());
  return parts.join(", ");
}

/**
 * Light up the canvas badge for the hovered lifeline entry, and the nodes of the
 * other people it involves. Rendered as a scoped style rule so the canvas nodes
 * do not re-render on every hover.
 */
function HoverHighlight({ entry, personId }: { entry: LifelineEntry | null; personId: string }) {
  if (!entry || !SAFE_ID.test(entry.id)) return null;
  const others = entry.entity.person_ids.filter((id) => id !== personId && SAFE_ID.test(id));
  const rules = [
    `.person-node__badge-wrap[data-badge-id="${entry.id}"] .person-node__badge{outline:2px solid currentColor;outline-offset:2px;color:var(--color-text-primary)}`,
    ...others.map(
      (id) =>
        `.react-flow__node[data-id="${id}"] .person-node{box-shadow:0 0 0 3px var(--color-action-focus-ring),var(--shadow-md)}`,
    ),
  ];
  return <style>{rules.join("")}</style>;
}

interface GlanceNamesProps {
  ids: string[];
  allPersons: Map<string, DecryptedPerson>;
  listFormat: Intl.ListFormat;
  onSelectPerson?: (personId: string) => void;
}

/** Names joined as a sentence list; the last one carries the full stop so it never wraps alone. */
function GlanceNames({ ids, allPersons, listFormat, onSelectPerson }: GlanceNamesProps) {
  const names = ids.map((id) => allPersons.get(id)?.name ?? "?");
  const parts = listFormat.formatToParts(names);
  let index = 0;
  let previousId = "start";
  return parts.map((part) => {
    if (part.type === "literal") {
      return <span key={`after-${previousId}`}>{part.value}</span>;
    }
    const id = ids[index++];
    previousId = id;
    const isLast = index === ids.length;
    return (
      <span key={id} className={isLast ? "person-page__last-name" : undefined}>
        {onSelectPerson ? (
          <button
            type="button"
            className="person-page__person-link"
            onClick={() => onSelectPerson(id)}
          >
            {part.value}
          </button>
        ) : (
          part.value
        )}
        {isLast && "."}
      </span>
    );
  });
}

interface GlanceProps {
  person: DecryptedPerson;
  groups: GlanceGroup[];
  allPersons: Map<string, DecryptedPerson>;
  onSelectPerson?: (personId: string) => void;
}

/** "Married to Hendrik. Mother of Pieter and Anna." */
function PersonGlance({ person, groups, allPersons, onSelectPerson }: GlanceProps) {
  const { t, i18n } = useTranslation();
  const listFormat = useMemo(
    () => new Intl.ListFormat(i18n.language, { type: "conjunction" }),
    [i18n.language],
  );
  if (groups.length === 0) {
    return <p className="person-page__glance">{t("personPage.glance.none")}</p>;
  }
  return (
    <p className="person-page__glance">
      {groups.map((group, i) => (
        <span key={group.role}>
          {i > 0 && " "}
          {t(`personPage.glance.${group.role}`, { context: person.gender })}{" "}
          <GlanceNames
            ids={group.personIds}
            allPersons={allPersons}
            listFormat={listFormat}
            onSelectPerson={onSelectPerson}
          />
        </span>
      ))}
    </p>
  );
}

interface PatternChipsProps {
  patterns: DecryptedPattern[];
  focusedPatternId: string | null;
  onFocusPattern?: (patternId: string | null) => void;
}

function PatternChips({ patterns, focusedPatternId, onFocusPattern }: PatternChipsProps) {
  if (patterns.length === 0) return null;
  return (
    <div className="person-page__patterns">
      {patterns.map((p) => (
        <button
          key={p.id}
          type="button"
          className="person-page__pattern"
          aria-pressed={focusedPatternId === p.id}
          disabled={!onFocusPattern}
          onClick={() => onFocusPattern?.(focusedPatternId === p.id ? null : p.id)}
        >
          <span
            className="person-page__pattern-swatch"
            style={{ backgroundColor: getPatternColor(p.color) }}
          />
          {p.name}
        </button>
      ))}
    </div>
  );
}

interface FoldProps {
  section: FoldSection;
  label: string;
  openFold: FoldSection | null;
  onOpenFoldChange: (update: (current: FoldSection | null) => FoldSection | null) => void;
  children: ReactNode;
}

function PageFold({ section, label, openFold, onOpenFoldChange, children }: FoldProps) {
  return (
    <details
      className="person-page__fold"
      open={openFold === section}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        onOpenFoldChange((current) => (isOpen ? section : current === section ? null : current));
      }}
    >
      <summary>
        <ChevronDown size={15} aria-hidden="true" />
        {label}
      </summary>
      <div className="person-page__fold-body">{children}</div>
    </details>
  );
}

function ReflectionPrompt({ prompt, onWrite }: { prompt: string; onWrite: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="person-page__reflect" aria-label={t("journal.tab")}>
      <p className="person-page__prompt">{prompt}</p>
      <button type="button" className="btn" onClick={onWrite}>
        <PenLine size={15} aria-hidden="true" />
        {t("personPage.writeJournal")}
      </button>
    </section>
  );
}

/**
 * The person page: a margin page in a family notebook beside the canvas. A
 * handwritten name, a plain sentence about who they are to others, their
 * patterns, then their life read in order, edited in place. Relationships
 * and the person's details fold away at the bottom.
 */
export function PersonDetailPanel({
  person,
  relationships,
  inferredSiblings,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  allPersons,
  initialSection,
  initialEntityId,
  handlers,
  entityHandlers,
  showReflectionPrompts,
  onOpenJournal,
  siblingGroup,
  onCreateSiblingGroup,
  onOpenSiblingGroup,
  onSelectPerson,
  patterns = EMPTY_PATTERNS,
  focusedPatternId = null,
  onFocusPattern,
}: PersonDetailPanelProps) {
  const { onSavePerson, onDeletePerson, onSaveRelationship, onClose } = handlers;
  const { t } = useTranslation();
  const { status, report } = useInspectorStatus();
  const editing = useLifelineEditing(initialSection, initialEntityId, person.id);
  const [hovered, setHovered] = useState<LifelineEntry | null>(null);

  const [openFold, setOpenFold] = useState<FoldSection | null>(() => foldFor(initialSection));
  // Follow a new section request; a different person starts from their own.
  const [foldRequest, setFoldRequest] = useState({ section: initialSection, personId: person.id });
  if (foldRequest.section !== initialSection || foldRequest.personId !== person.id) {
    const personChanged = foldRequest.personId !== person.id;
    setFoldRequest({ section: initialSection, personId: person.id });
    const fold = foldFor(initialSection);
    if (fold || personChanged) setOpenFold(fold);
  }

  // Stable prompt per person: re-roll the random selection during render when a
  // different person is shown, then translate live (also follows name edits).
  const [promptPick, setPromptPick] = useState(() => ({
    id: person.id,
    index: pickPersonPromptIndex(),
  }));
  if (promptPick.id !== person.id) {
    setPromptPick({ id: person.id, index: pickPersonPromptIndex() });
  }
  const personPrompt = personPromptText(t, promptPick.index, person.name);

  const years = yearsLine(person, t);
  const glance = buildGlanceGroups(person.id, relationships, inferredSiblings);
  const personPatterns = patterns.filter((p) => p.person_ids.includes(person.id));

  return (
    <InspectorStatusProvider value={report}>
      <aside className="panel-overlay detail-panel person-page" aria-label={person.name}>
        <HoverHighlight entry={hovered} personId={person.id} />
        <header className="person-page__head">
          <h2 className="person-page__name">{person.name}</h2>
          <div className="person-page__head-actions">
            <InspectorSaveWhisper status={status} />
            <button
              type="button"
              className="person-page__close"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="person-page__scroll">
          {years && <p className="person-page__years">{years}</p>}
          <PersonGlance
            person={person}
            groups={glance}
            allPersons={allPersons}
            onSelectPerson={onSelectPerson}
          />
          <PatternChips
            patterns={personPatterns}
            focusedPatternId={focusedPatternId}
            onFocusPattern={onFocusPattern}
          />

          <PersonLifeline
            person={person}
            allPersons={allPersons}
            handlers={entityHandlers}
            editing={editing}
            onHover={setHovered}
            events={events}
            lifeEvents={lifeEvents}
            turningPoints={turningPoints}
            classifications={classifications}
          />

          {showReflectionPrompts && onOpenJournal && (
            <ReflectionPrompt
              prompt={personPrompt}
              onWrite={() =>
                onOpenJournal(personPrompt, { entity_type: "person", entity_id: person.id })
              }
            />
          )}

          <PageFold
            section="relationships"
            label={t("relationship.tab")}
            openFold={openFold}
            onOpenFoldChange={setOpenFold}
          >
            <RelationshipsTab
              person={person}
              relationships={relationships}
              inferredSiblings={inferredSiblings}
              allPersons={allPersons}
              onSaveRelationship={onSaveRelationship}
              siblingGroup={siblingGroup}
              onCreateSiblingGroup={onCreateSiblingGroup}
              onOpenSiblingGroup={onOpenSiblingGroup}
            />
          </PageFold>

          <PageFold
            section="details"
            label={t("personPage.details")}
            openFold={openFold}
            onOpenFoldChange={setOpenFold}
          >
            <PersonTab
              key={person.id}
              person={person}
              onSavePerson={onSavePerson}
              onDeletePerson={onDeletePerson}
            />
          </PageFold>
        </div>
      </aside>
    </InspectorStatusProvider>
  );
}
