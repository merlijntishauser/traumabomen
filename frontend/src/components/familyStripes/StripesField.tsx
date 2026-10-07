import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  clipSpan,
  entriesByPerson,
  type StripeEntry,
  type StripeLayout,
  type StripeMode,
  type StripeRow,
  stripeColor,
  traumaRuns,
} from "../../lib/familyStripes";
import {
  BAND,
  BAND_TOP,
  fieldGeometry,
  RULER_HEIGHT,
  revealScrollLeft,
  rulerLabelPlacement,
  starPoints,
} from "./geometry";

const SLIDE_MS = 600;
/** A press that travels further than this is a scroll, not a pick. */
const PICK_SLOP = 6;

type Hatch = (entry: StripeEntry) => string;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Switching Years and Age slides and rescales every row from its old place to
 * its new one, then redraws it crisply at the new cell size.
 */
function useModeSlide(mode: StripeMode, cell: number) {
  const [shown, setShown] = useState({ mode, cell });
  const [fromCell, setFromCell] = useState<number | null>(null);
  if (shown.mode !== mode || shown.cell !== cell) {
    if (shown.mode !== mode && !prefersReducedMotion()) setFromCell(shown.cell);
    setShown({ mode, cell });
  }
  useEffect(() => {
    if (fromCell == null) return;
    const timer = setTimeout(() => setFromCell(null), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [fromCell]);
  return fromCell;
}

function markClass(entry: StripeEntry, lit: Set<string> | null): string {
  return lit?.has(entry.id) ? "fs-mark fs-mark--lit" : "fs-mark";
}

interface PersonMarks {
  all: StripeEntry[];
  classifications: StripeEntry[];
  lifeEvents: StripeEntry[];
  turningPoints: StripeEntry[];
}

/** One pass over a person's entries: what to draw, by kind. */
function marksFor(mine: StripeEntry[], row: StripeRow): PersonMarks {
  const out: PersonMarks = { all: [], classifications: [], lifeEvents: [], turningPoints: [] };
  for (const e of mine) {
    out.all.push(e);
    const inLife = clipSpan(e.spans[0], row.born, row.last) != null;
    if (e.kind === "classification") out.classifications.push(e);
    else if (e.kind === "life_event" && inLife) out.lifeEvents.push(e);
    else if (e.kind === "turning_point" && inLife) out.turningPoints.push(e);
  }
  return out;
}

interface LayerProps {
  row: StripeRow;
  top: number;
  cell: number;
  list: StripeEntry[];
  lit: Set<string> | null;
  hatch: Hatch;
}

/** Trauma fills its years; several in one year share the band as stacked slices. */
function TraumaCells({ row, top, cell, list, lit, hatch }: LayerProps) {
  const cells: ReactNode[] = [];
  for (const run of traumaRuns(list, row.born, row.last)) {
    const slice = BAND / run.entries.length;
    const x = (run.start - row.born) * cell;
    const w = (run.end - run.start + 1) * cell;
    run.entries.forEach((e, k) => {
      cells.push(
        <rect
          key={`${run.start}-${e.id}`}
          className={markClass(e, lit)}
          data-entry={e.id}
          x={x}
          y={top + k * slice}
          width={w}
          height={slice}
          fill={e.approx ? hatch(e) : stripeColor(e)}
        />,
      );
      if (k > 0) {
        cells.push(
          <rect
            key={`${run.start}-${e.id}-gap`}
            x={x}
            y={top + k * slice - 1.5}
            width={w}
            height={3}
            fill="var(--color-bg-primary)"
          />,
        );
      }
    });
  }
  return <>{cells}</>;
}

/** Classifications run as a rule along the foot of the band, hatched when suspected. */
function ClassificationRules({ row, top, cell, list, lit, hatch }: LayerProps) {
  const rules: ReactNode[] = [];
  for (const e of list) {
    for (const span of e.spans) {
      const clipped = clipSpan(span, row.born, row.last);
      if (!clipped) continue;
      rules.push(
        <rect
          key={`${e.id}-${span.from}`}
          className={markClass(e, lit)}
          data-entry={e.id}
          x={(clipped.from - row.born) * cell}
          y={top + BAND + 7}
          width={(clipped.to - clipped.from + 1) * cell}
          height={4}
          rx={1}
          fill={e.category === "suspected" ? hatch(e) : stripeColor(e)}
        />,
      );
    }
  }
  return <>{rules}</>;
}

interface RowMarksProps {
  row: StripeRow;
  y: number;
  cell: number;
  entries: StripeEntry[];
  lit: Set<string> | null;
  hatch: Hatch;
}

function RowMarks({ row, y, cell, entries, lit, hatch }: RowMarksProps) {
  const top = y + BAND_TOP;
  const marks = marksFor(entries, row);
  const xOf = (year: number) => (year - row.born) * cell;
  const layer = { row, top, cell, lit, hatch };
  return (
    <>
      <rect
        x={0}
        y={top}
        width={(row.last - row.born + 1) * cell}
        height={BAND}
        rx={3}
        fill="var(--color-stripe-lived)"
      />
      <TraumaCells {...layer} list={marks.all} />
      <ClassificationRules {...layer} list={marks.classifications} />
      {marks.lifeEvents.map((e) => (
        <rect
          key={e.id}
          className={markClass(e, lit)}
          data-entry={e.id}
          x={xOf(e.spans[0].from) + cell / 2 - 4.5}
          y={top + BAND - 4.5}
          width={9}
          height={9}
          rx={1.5}
          fill={stripeColor(e)}
          stroke="var(--color-bg-primary)"
          strokeWidth={1.5}
        />
      ))}
      {marks.turningPoints.map((e) => (
        <polygon
          key={e.id}
          className={markClass(e, lit)}
          data-entry={e.id}
          points={starPoints(xOf(e.spans[0].from) + cell / 2, top - 6, 5.5)}
          fill={stripeColor(e)}
        />
      ))}
    </>
  );
}

function HatchPatterns({ id, entries }: { id: string; entries: StripeEntry[] }) {
  const seen = new Map<string, StripeEntry>();
  for (const e of entries) {
    if (e.approx || (e.kind === "classification" && e.category === "suspected")) {
      seen.set(`${e.kind}-${e.category}`, e);
    }
  }
  const patterns: ReactNode[] = [];
  for (const [key, e] of seen) {
    const common = {
      id: `${id}-${key}`,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)",
    } as const;
    patterns.push(
      e.kind === "classification" ? (
        <pattern key={key} {...common} width={4} height={4}>
          <rect width={2} height={4} fill={stripeColor(e)} />
        </pattern>
      ) : (
        <pattern key={key} {...common} width={5} height={5}>
          <rect width={5} height={5} fill="var(--color-stripe-lived)" />
          <rect width={2.6} height={5} fill={stripeColor(e)} />
        </pattern>
      ),
    );
  }
  return <defs>{patterns}</defs>;
}

interface RulerProps {
  mode: StripeMode;
  start: number;
  span: number;
  cell: number;
  height: number;
  now: number;
  flag: { left: number; right: number };
  visibleFrom: number;
}

function Ruler({ mode, start, span, cell, height, now, flag, visibleFrom }: RulerProps) {
  const ticks: ReactNode[] = [];
  for (let i = 0; i <= span - 3; i += 10) {
    const x = i * cell;
    const label = mode === "years" ? start + i : i;
    const place = rulerLabelPlacement(x, 10 * cell, flag, visibleFrom);
    ticks.push(
      <g key={label}>
        <line x1={x} x2={x} y1={RULER_HEIGHT - 8} y2={height} stroke="var(--color-stripe-grid)" />
        {place && (
          <text x={place.x} y={RULER_HEIGHT - 14} textAnchor={place.anchor}>
            {label}
          </text>
        )}
      </g>,
    );
  }
  const todayX = (now - start + 1) * cell;
  return (
    <g className="fs-ruler">
      {ticks}
      {mode === "years" && (
        <line
          x1={todayX}
          x2={todayX}
          y1={RULER_HEIGHT - 8}
          y2={height}
          stroke="var(--color-text-muted)"
          strokeDasharray="2 4"
        />
      )}
    </g>
  );
}

export interface StripesFieldProps {
  layout: StripeLayout;
  entries: StripeEntry[];
  mode: StripeMode;
  /** First year (years mode); ages always start at 0. */
  start: number;
  /** Number of cells in the current mode. */
  span: number;
  cell: number;
  now: number;
  /** The year (or age) being read, and its bounds. */
  value: number;
  min: number;
  max: number;
  flagText: string;
  label: string;
  valueText: string;
  lit: Set<string> | null;
  focusPersonId: string | null;
  /** Field x where the visible part starts, past the sticky names column. */
  visibleFrom: number;
  onSetValue: (value: number) => void;
  onHoverEntry: (entryId: string | null) => void;
}

export function StripesField(props: StripesFieldProps) {
  const { layout, entries, mode, start, span, cell, now, value, min, max, lit, focusPersonId } =
    props;
  const patternId = useId().replace(/:/g, "");
  const fromCell = useModeSlide(mode, cell);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const geo = fieldGeometry(layout);
  const byPerson = entriesByPerson(layout.rows, entries);
  const width = Math.ceil(cell * span);
  const geometryCell = fromCell ?? cell;
  const scale = fromCell ? cell / fromCell : 1;
  const readX = (value - min) * cell;
  const flagW = mode === "years" ? 46 : 64;
  const flagX = Math.min(Math.max(readX + cell / 2 - flagW / 2, 0), width - flagW);
  const hatch: Hatch = (e) => `url(#${patternId}-${e.kind}-${e.category})`;

  // Keep the column being read in view when the field scrolls sideways. The
  // callback changes only when the column moves, so React calls it only then.
  const revealColumn = useCallback(
    (node: SVGRectElement | null) => {
      const scroller = node?.closest<HTMLElement>(".fs__scroller");
      const names = scroller?.querySelector<HTMLElement>(".fs__names");
      if (!scroller || !names) return;
      const view = scroller.clientWidth - names.offsetWidth;
      const next = revealScrollLeft(readX, scroller.scrollLeft, view);
      if (next != null) scroller.scrollLeft = next;
    },
    [readX],
  );

  const indexAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.floor((event.clientX - box.left) / cell);
    return i >= 0 && i < span ? i : null;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const down = press.current;
    press.current = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > PICK_SLOP) return;
    const i = indexAt(event);
    if (i != null) props.onSetValue(min + i);
  };

  // The native range input already steps by one; Shift moves ten.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.shiftKey) return;
    const delta = ({ ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 } as const)[
      event.key as "ArrowRight"
    ];
    if (delta == null) return;
    event.preventDefault();
    props.onSetValue(value + delta);
  };

  return (
    <div
      className={lit ? "fs-field fs-field--lit" : "fs-field"}
      style={{ width }}
      data-testid="stripes-field"
      onPointerDown={(event) => {
        press.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={onPointerUp}
      onPointerMove={(event) => setHoverIndex(indexAt(event))}
      onPointerLeave={() => {
        setHoverIndex(null);
        props.onHoverEntry(null);
      }}
      onPointerOver={(event) => {
        const mark = (event.target as Element).closest?.("[data-entry]");
        props.onHoverEntry(mark ? mark.getAttribute("data-entry") : null);
      }}
    >
      <input
        type="range"
        className="fs-field__range sr-only"
        aria-label={props.label}
        aria-valuetext={props.valueText}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => props.onSetValue(Number(event.target.value))}
        onKeyDown={onKeyDown}
      />
      <svg width={width} height={geo.height} aria-hidden="true" focusable="false">
        <HatchPatterns id={patternId} entries={entries} />
        <Ruler
          mode={mode}
          start={start}
          span={span}
          cell={cell}
          height={geo.height}
          now={now}
          flag={{ left: flagX, right: flagX + flagW }}
          visibleFrom={props.visibleFrom}
        />
        {geo.gens.slice(1).map((gy) => (
          <rect
            key={gy}
            x={0}
            y={gy + 6}
            width={width}
            height={1}
            fill="var(--color-border-primary)"
          />
        ))}
        {hoverIndex != null && (
          <rect
            x={hoverIndex * cell}
            y={RULER_HEIGHT - 6}
            width={cell}
            height={geo.height - RULER_HEIGHT + 6}
            fill="var(--color-stripe-grid)"
          />
        )}
        {geo.rows.map(({ row, y }) => {
          const offset = mode === "years" ? (row.born - start) * cell : 0;
          const dim = focusPersonId != null && focusPersonId !== row.person.id;
          return (
            <g
              key={row.person.id}
              className={`fs-row${fromCell ? " fs-row--sliding" : ""}${dim ? " is-dim" : ""}`}
              style={{ transform: `translateX(${offset}px) scaleX(${scale})` }}
            >
              <RowMarks
                row={row}
                y={y}
                cell={geometryCell}
                entries={byPerson.get(row.person.id) ?? []}
                lit={lit}
                hatch={hatch}
              />
            </g>
          );
        })}
        <g className="fs-read">
          <rect
            ref={revealColumn}
            x={readX}
            y={RULER_HEIGHT - 8}
            width={cell}
            height={geo.height - RULER_HEIGHT + 8}
            fill="var(--color-stripe-read-wash)"
            stroke="var(--color-stripe-read)"
            strokeWidth={1.5}
          />
          <g className="fs-flag">
            <rect
              x={flagX}
              y={RULER_HEIGHT - 32}
              width={flagW}
              height={22}
              rx={4}
              fill="var(--color-stripe-read)"
            />
            <text x={flagX + flagW / 2} y={RULER_HEIGHT - 16.5} textAnchor="middle">
              {props.flagText}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
