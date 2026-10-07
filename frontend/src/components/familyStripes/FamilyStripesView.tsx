import { CalendarOff } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { useElementWidth } from "../../hooks/useElementWidth";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import {
  ageDomainSpan,
  buildStripeEntries,
  buildStripeLayout,
  busiestValue,
  firstName,
  keyOf,
  matchEntry,
  matchKey,
  readAt,
  type StripeEntry,
  type StripeMode,
  type StripeRow,
  type UndatedEntry,
  undatedByPerson,
  undatedEntries,
  yearDomainStart,
} from "../../lib/familyStripes";
import { computeGenerations, filterTimelinePersons } from "../../lib/generations";
import { conjunctionFormatter } from "../../lib/listFormat";
import { classificationLabel } from "../../lib/patternEntities";
import { ReadingPane } from "./ReadingPane";
import { StripesField } from "./StripesField";
import { StripesKey } from "./StripesKey";
import "./FamilyStripes.css";

const MIN_CELL = 6;

export interface FamilyStripesViewProps {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  onOpenPerson: (personId: string) => void;
  /** Opens the person page at one entry's form (dated or not). */
  onOpenEntry: (entry: Pick<StripeEntry, "id" | "kind">, personId: string) => void;
}

function useStripeData(props: FamilyStripesViewProps, now: number) {
  const { t } = useTranslation();
  const { persons, relationships, events, lifeEvents, classifications, turningPoints } = props;
  return useMemo(() => {
    const people = filterTimelinePersons(persons, relationships);
    const layout = buildStripeLayout(people, computeGenerations(people, relationships), now);
    const entries = buildStripeEntries(
      { events, lifeEvents, classifications, turningPoints },
      (c) => classificationLabel(c, t),
      now,
    );
    const undated = undatedEntries({ events, lifeEvents, classifications, turningPoints });
    return {
      layout,
      entries,
      undated,
      undatedFor: undatedByPerson(undated),
      start: yearDomainStart(layout.rows, now),
      ageSpan: ageDomainSpan(layout.rows),
    };
  }, [persons, relationships, events, lifeEvents, classifications, turningPoints, now, t]);
}

/** Hovered entries or key item win; otherwise a pinned key item stays lit. */
function useHighlight(entries: StripeEntry[]) {
  const [hovered, setHovered] = useState<Set<string> | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const lit = hovered ?? (pinnedKey ? matchKey(entries, pinnedKey) : null);
  const litKeys = useMemo(() => {
    if (!lit) return null;
    const keys = new Set<string>();
    for (const e of entries) {
      if (!lit.has(e.id)) continue;
      keys.add(keyOf(e));
      if (e.approx) keys.add("approx");
    }
    return keys;
  }, [entries, lit]);
  return {
    lit,
    litKeys,
    pinnedKey,
    hoverEntry: (id: string | null) => setHovered(id ? matchEntry(entries, id) : null),
    hoverKey: (key: string | null) => setHovered(key ? matchKey(entries, key) : null),
    togglePin: (key: string) => setPinnedKey((current) => (current === key ? null : key)),
  };
}

function yearsText(row: StripeRow, t: ReturnType<typeof useTranslation>["t"]): string {
  if (row.person.death_year != null)
    return t("timeline.lifespan", { born: row.born, died: row.person.death_year });
  if (row.endUnknown) return t("timeline.endUnknown", { born: row.born });
  return t("timeline.living", { born: row.born });
}

interface ViewState {
  mode: StripeMode;
  /** The year and age chosen by the reader; null opens on the busiest one. */
  year: number | null;
  age: number | null;
  /** The person being pointed at, whose stripes stay bright. */
  focus: string | null;
  /** How far the field is scrolled sideways under the names column. */
  scrollLeft: number;
}

type ViewAction =
  | { type: "mode"; mode: StripeMode }
  | { type: "value"; value: number }
  | { type: "focus"; personId: string | null }
  | { type: "scroll"; left: number };

function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode };
    case "value":
      return state.mode === "years"
        ? { ...state, year: action.value }
        : { ...state, age: action.value };
    case "focus":
      return state.focus === action.personId ? state : { ...state, focus: action.personId };
    case "scroll":
      return state.scrollLeft === action.left ? state : { ...state, scrollLeft: action.left };
  }
}

const INITIAL_VIEW: ViewState = {
  mode: "years",
  year: null,
  age: null,
  focus: null,
  scrollLeft: 0,
};

interface UndatedYearsProps {
  row: StripeRow;
  undated: UndatedEntry[] | undefined;
  onOpenEntry: FamilyStripesViewProps["onOpenEntry"];
}

/** The years under a name, and a way to the entries the stripes cannot place. */
function UndatedYears({ row, undated, onOpenEntry }: UndatedYearsProps) {
  const { t } = useTranslation();
  return (
    <span className="fs__years">
      {yearsText(row, t)}
      {undated && undated.length > 0 && (
        <>
          <button
            type="button"
            className="fs__undated"
            aria-label={t("timeline.undatedCount", { count: undated.length })}
            title={t("timeline.undatedCount", { count: undated.length })}
            onClick={() => onOpenEntry(undated[0], row.person.id)}
          >
            <CalendarOff size={12} aria-hidden="true" />
            {undated.length}
          </button>
        </>
      )}
    </span>
  );
}

export function FamilyStripesView(props: FamilyStripesViewProps) {
  const { t, i18n } = useTranslation();
  const [now] = useState(() => new Date().getFullYear());
  const [coarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(pointer: coarse), (max-width: 560px)").matches,
  );
  const { layout, entries, undated, undatedFor, start, ageSpan } = useStripeData(props, now);
  const [view, dispatch] = useReducer(viewReducer, INITIAL_VIEW);
  const { mode, focus } = view;
  const highlight = useHighlight(entries);
  const setFocus = (personId: string | null) => dispatch({ type: "focus", personId });

  const [scrollerRef, , scrollerWidth] = useElementWidth<HTMLDivElement>();
  const [namesRef, , namesWidth] = useElementWidth<HTMLDivElement>();
  const busiest = useMemo(
    () => ({
      year: busiestValue(layout.rows, entries, "years", start, now, now),
      age: busiestValue(layout.rows, entries, "age", 0, ageSpan - 1, now),
    }),
    [layout, entries, start, ageSpan, now],
  );

  const yearSpan = now - start + 1;
  const span = mode === "years" ? yearSpan : ageSpan;
  const min = mode === "years" ? start : 0;
  const max = mode === "years" ? now : ageSpan - 1;
  const year = view.year ?? busiest.year;
  const age = view.age ?? busiest.age;
  const value = mode === "years" ? year : age;
  const cell = Math.max(MIN_CELL, Math.floor(((scrollerWidth - namesWidth - 8) / span) * 10) / 10);

  const setValue = (next: number) =>
    dispatch({ type: "value", value: Math.min(max, Math.max(min, next)) });

  const reading = useMemo(
    () => readAt(layout.rows, entries, mode, value, now),
    [layout, entries, mode, value, now],
  );

  if (layout.rows.length === 0) {
    return (
      <div className="fs fs--empty">
        <p className="fs-empty">{t("timeline.empty")}</p>
      </div>
    );
  }

  const lit = highlight.lit;
  const activeFocus = lit ? null : focus;
  const involved = (id: string) => entries.some((e) => lit?.has(e.id) && e.personIds.includes(id));
  const nameDim = (id: string) => (lit ? !involved(id) : activeFocus != null && activeFocus !== id);
  const valueText = mode === "years" ? String(year) : t("timeline.ageValue", { age });

  return (
    <div className="fs">
      <section className="fs__chart" aria-label={t("timeline.chartLabel")}>
        <div
          className="fs__scroller"
          ref={scrollerRef}
          onScroll={(event) => dispatch({ type: "scroll", left: event.currentTarget.scrollLeft })}
        >
          <div className="fs__grid">
            <div className="fs__names" ref={namesRef}>
              <div className="fs__corner">
                <fieldset className="fs-switch">
                  <legend className="sr-only">{t("timeline.lineUpBy")}</legend>
                  {(["years", "age"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="fs-switch__btn"
                      aria-pressed={mode === m}
                      onClick={() => dispatch({ type: "mode", mode: m })}
                    >
                      {t(m === "years" ? "timeline.years" : "timeline.age")}
                    </button>
                  ))}
                </fieldset>
              </div>
              {layout.generations.map((group, g) => (
                <div key={group.generation}>
                  <div className="fs__gen">{t("timeline.generation", { number: g + 1 })}</div>
                  {group.rows.map((row) => (
                    <div
                      key={row.person.id}
                      className={nameDim(row.person.id) ? "fs__person is-dim" : "fs__person"}
                      onPointerEnter={() => setFocus(row.person.id)}
                      onPointerLeave={() => setFocus(null)}
                    >
                      <button
                        type="button"
                        className="fs__name"
                        onClick={() => props.onOpenPerson(row.person.id)}
                      >
                        <span className="fs__name-full">{row.person.name}</span>
                        <span className="fs__name-short" aria-hidden="true">
                          {firstName(row.person.name)}
                        </span>
                      </button>
                      <UndatedYears
                        row={row}
                        undated={undatedFor.get(row.person.id)}
                        onOpenEntry={props.onOpenEntry}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <StripesField
              layout={layout}
              entries={entries}
              mode={mode}
              start={start}
              span={span}
              cell={cell}
              now={now}
              value={value}
              min={min}
              max={max}
              flagText={valueText}
              label={t(mode === "years" ? "timeline.reading.year" : "timeline.reading.age")}
              valueText={valueText}
              lit={lit}
              focusPersonId={activeFocus}
              visibleFrom={view.scrollLeft}
              onSetValue={setValue}
              onHoverEntry={highlight.hoverEntry}
            />
          </div>
        </div>
        <div className="fs__foot">
          <StripesKey
            entries={entries}
            litKeys={highlight.litKeys}
            pinnedKey={highlight.pinnedKey}
            onHoverKey={highlight.hoverKey}
            onTogglePin={highlight.togglePin}
          />
          {undated.length > 0 && (
            <p className="fs__unplaced">{t("timeline.undatedTotal", { count: undated.length })}</p>
          )}
          {layout.unplaced.length > 0 && (
            <p className="fs__unplaced">
              {t("timeline.unplaced", {
                names: conjunctionFormatter(i18n.language).format(
                  layout.unplaced.map((p) => p.name),
                ),
              })}
            </p>
          )}
        </div>
      </section>
      <ReadingPane
        mode={mode}
        value={value}
        reading={reading}
        now={now}
        coarsePointer={coarsePointer}
        lit={lit}
        focusPersonId={activeFocus}
        onStep={(delta) => setValue(value + delta)}
        onOpenPerson={props.onOpenPerson}
        onOpenEntry={props.onOpenEntry}
        onHoverEntry={highlight.hoverEntry}
        onFocusPerson={setFocus}
        undatedFor={undatedFor}
      />
    </div>
  );
}
