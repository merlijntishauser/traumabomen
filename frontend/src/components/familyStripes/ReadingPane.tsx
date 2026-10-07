import type { TFunction } from "i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOverflowBelow } from "../../hooks/useOverflowBelow";
import {
  firstName,
  type Reading,
  type ReadingBlock,
  type StripeEntry,
  type StripeMode,
  type StripeRow,
  sharedSurname,
  spanAt,
  stripeColor,
  type UndatedEntry,
} from "../../lib/familyStripes";
import { conjunctionFormatter } from "../../lib/listFormat";
import { StripeMark } from "./StripeMark";

const YEAR_QUESTIONS = 4;
const AGE_QUESTIONS = 3;

function listFormat(language: string, items: string[]): string {
  return conjunctionFormatter(language).format(items);
}

function categoryLabel(entry: StripeEntry, t: TFunction): string {
  switch (entry.kind) {
    case "trauma_event":
      return t(`trauma.category.${entry.category}`);
    case "life_event":
      return t(`lifeEvent.category.${entry.category}`);
    case "classification":
      return t(`classification.status.${entry.category}`);
    case "turning_point":
      return t(`turningPoint.category.${entry.category}`);
  }
}

/** Ages from here up mean "the rest of their life" ("old age"): say "from age 65". */
const OPEN_ENDED_AGE = 100;

function dateText(entry: StripeEntry, year: number, now: number, t: TFunction): string {
  if (entry.relative?.kind === "ages") {
    const { from, to } = entry.relative;
    if (from === to) return t("timeline.date.age", { age: from });
    if (to >= OPEN_ENDED_AGE) return t("timeline.date.fromAge", { age: from });
    return t("timeline.date.ages", { from, to });
  }
  const span = spanAt(entry, year);
  let text = String(span.from);
  if (span.to !== span.from) {
    text =
      entry.kind === "classification" && span.to === now
        ? t("timeline.date.onwards", { from: span.from })
        : t("timeline.date.range", { from: span.from, to: span.to });
  }
  return entry.approx ? t("timeline.date.about", { date: text }) : text;
}

interface BlockNamesProps {
  people: StripeRow[];
  onOpenPerson: (personId: string) => void;
}

/** Each name opens that person's page; a shared surname is said once. */
function BlockNames({ people, onOpenPerson }: BlockNamesProps) {
  const { i18n } = useTranslation();
  const names = people.map((p) => p.person.name);
  const surname = sharedSurname(names);
  const labels = surname ? names.map(firstName) : names;
  const parts = conjunctionFormatter(i18n.language).formatToParts(labels);
  let index = 0;
  return (
    <span className="fs-block__names">
      {parts.map((part, k) => {
        if (part.type !== "element") return <span key={`l${k}`}>{part.value}</span>;
        const row = people[index++];
        return (
          <button
            key={row.person.id}
            type="button"
            className="fs-pane__name"
            onClick={() => onOpenPerson(row.person.id)}
          >
            {part.value}
          </button>
        );
      })}
      {surname && ` ${surname}`}
    </span>
  );
}

interface BlockProps {
  block: ReadingBlock;
  mode: StripeMode;
  now: number;
  lit: Set<string> | null;
  dim: boolean;
  onOpenPerson: (personId: string) => void;
  onOpenEntry: (entry: Pick<StripeEntry, "id" | "kind">, personId: string) => void;
  onHoverEntry: (entryId: string | null) => void;
  onFocusPerson: (personId: string | null) => void;
}

function Block({ block, mode, now, lit, dim, ...handlers }: BlockProps) {
  const { t, i18n } = useTranslation();
  const ages = block.people.map((p, k) => block.years[k] - p.born);
  let meta: string;
  if (mode === "age") {
    meta = t(block.years[0] === now ? "timeline.inYearNow" : "timeline.inYear", {
      year: block.years[0],
    });
  } else if (ages.length > 1) {
    meta = t("timeline.agesShort", { ages: listFormat(i18n.language, ages.map(String)) });
  } else {
    meta = ages[0] === 0 ? t("timeline.bornThisYear") : t("timeline.ageShort", { age: ages[0] });
  }
  const single = block.people.length === 1 ? block.people[0].person.id : null;
  return (
    <li
      className={dim ? "fs-block is-dim" : "fs-block"}
      onPointerEnter={() => handlers.onFocusPerson(single)}
      onPointerLeave={() => handlers.onFocusPerson(null)}
    >
      <div className="fs-block__line">
        <BlockNames people={block.people} onOpenPerson={handlers.onOpenPerson} />
        <span className="fs-block__age">{meta}</span>
      </div>
      <ul className="fs-block__entries">
        {block.entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={lit && !lit.has(entry.id) ? "fs-entry is-dim" : "fs-entry"}
              onClick={() => handlers.onOpenEntry(entry, block.people[0].person.id)}
              onPointerEnter={() => handlers.onHoverEntry(entry.id)}
              onPointerLeave={() => handlers.onHoverEntry(null)}
              onFocus={() => handlers.onHoverEntry(entry.id)}
              onBlur={() => handlers.onHoverEntry(null)}
            >
              <StripeMark
                className="fs-entry__mark"
                kind={entry.kind}
                color={stripeColor(entry)}
                hollow={entry.kind === "classification" && entry.category === "suspected"}
              />
              <span className="fs-entry__body">
                <span className="fs-entry__title">{entry.title || t("personPage.untitled")}</span>
                <span className="fs-entry__meta">
                  {t("timeline.entryMeta", {
                    category: categoryLabel(entry, t).toLocaleLowerCase(i18n.language),
                    date: dateText(entry, block.years[0], now, t),
                  })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

function absentNotes(
  reading: Reading,
  mode: StripeMode,
  value: number,
  t: TFunction,
  language: string,
  undatedFor: Map<string, UndatedEntry[]>,
): string[] {
  const names = (rows: StripeRow[]) =>
    listFormat(
      language,
      rows.map((r) => firstName(r.person.name)),
    );
  const notes: string[] = [];
  // Only say "nothing recorded" of people with no undated entries: those might belong here.
  const unsure = reading.quiet.filter((r) => undatedFor.has(r.person.id));
  const quiet = reading.quiet.filter((r) => !undatedFor.has(r.person.id));
  if (quiet.length) notes.push(t("timeline.nothingRecorded", { names: names(quiet) }));
  if (unsure.length) {
    notes.push(t("timeline.maybeUndated", { names: names(unsure), count: unsure.length }));
  }
  if (mode === "years") {
    if (reading.notYet.length)
      notes.push(t("timeline.notYetBorn", { names: names(reading.notYet) }));
    if (reading.gone.length) notes.push(t("timeline.hadDied", { names: names(reading.gone) }));
  } else {
    if (reading.notYet.length)
      notes.push(t("timeline.notYetAge", { age: value, names: names(reading.notYet) }));
    if (reading.gone.length)
      notes.push(t("timeline.didNotReach", { age: value, names: names(reading.gone) }));
  }
  return notes;
}

export interface ReadingPaneProps {
  mode: StripeMode;
  value: number;
  reading: Reading;
  now: number;
  coarsePointer: boolean;
  lit: Set<string> | null;
  focusPersonId: string | null;
  onStep: (delta: number) => void;
  onOpenPerson: (personId: string) => void;
  onOpenEntry: (entry: Pick<StripeEntry, "id" | "kind">, personId: string) => void;
  onHoverEntry: (entryId: string | null) => void;
  onFocusPerson: (personId: string | null) => void;
  /** People's entries that have no year, so "nothing recorded" is never said of them. */
  undatedFor: Map<string, UndatedEntry[]>;
}

export function ReadingPane(props: ReadingPaneProps) {
  const { mode, value, reading, now, lit, focusPersonId } = props;
  const { t, i18n } = useTranslation();
  const unit = mode === "years" ? "year" : "age";
  const hint = t(`timeline.hint.${unit}${props.coarsePointer ? "Touch" : ""}`);
  const question =
    mode === "years"
      ? t(`timeline.questionYear.${value % YEAR_QUESTIONS}`)
      : t(`timeline.questionAge.${value % AGE_QUESTIONS}`, { age: value });
  const notes = absentNotes(reading, mode, value, t, i18n.language, props.undatedFor);
  // The foot is pinned; a fade above it says more of the reading is scrolled under it.
  const [paneRef, moreBelow, onPaneScroll] = useOverflowBelow<HTMLElement>();

  return (
    <aside
      ref={paneRef}
      onScroll={onPaneScroll}
      className={moreBelow ? "fs-pane fs-pane--more" : "fs-pane"}
      aria-live="polite"
      aria-label={t(`timeline.reading.${unit}`)}
    >
      <div className="fs-pane__head">
        <p className="fs-pane__value">
          {mode === "age" && <span className="fs-pane__value-unit">{t("timeline.age")}</span>}
          {value}
        </p>
        <div className="fs-pane__steps">
          <button
            type="button"
            className="fs-pane__step"
            aria-label={t(`timeline.previous.${unit}`)}
            onClick={() => props.onStep(-1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="fs-pane__step"
            aria-label={t(`timeline.next.${unit}`)}
            onClick={() => props.onStep(1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="fs-pane__hint">{hint}</p>
      <ul className="fs-pane__blocks">
        {reading.blocks.map((block) => (
          <Block
            key={block.people.map((p) => p.person.id).join(",")}
            block={block}
            mode={mode}
            now={now}
            lit={lit}
            dim={
              focusPersonId != null &&
              !lit &&
              !block.people.some((p) => p.person.id === focusPersonId)
            }
            onOpenPerson={props.onOpenPerson}
            onOpenEntry={props.onOpenEntry}
            onHoverEntry={props.onHoverEntry}
            onFocusPerson={props.onFocusPerson}
          />
        ))}
      </ul>
      {/* Who is absent stays beside the question, pinned to the pane's foot. */}
      <div className="fs-pane__foot">
        {notes.length > 0 && <p className="fs-pane__absent">{notes.join(" ")}</p>}
        <div className="fs-pane__question">
          <h2 className="sr-only">{t(`timeline.questionHeading.${unit}`)}</h2>
          <p>{question}</p>
        </div>
      </div>
    </aside>
  );
}
