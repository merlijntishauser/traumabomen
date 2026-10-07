import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { readDate, yearsFor } from "./dateReading";

/**
 * The lifeline is the person's page read in order: every trauma event, life
 * event, turning point, and classification placed on one line from birth to
 * death. These helpers are pure so the ordering and gap rules are testable
 * without rendering.
 */

export type LifelineEntry =
  | { kind: "trauma_event"; id: string; year: number | null; entity: DecryptedEvent }
  | { kind: "life_event"; id: string; year: number | null; entity: DecryptedLifeEvent }
  | { kind: "turning_point"; id: string; year: number | null; entity: DecryptedTurningPoint }
  | {
      kind: "classification";
      id: string;
      year: number | null;
      endYear: number | null;
      entity: DecryptedClassification;
    };

export type LifelineKind = LifelineEntry["kind"];

/** Kinds in the order they are offered and the order they sort within a year. */
export const LIFELINE_KINDS: readonly LifelineKind[] = [
  "trauma_event",
  "life_event",
  "classification",
  "turning_point",
];

export type LifelineRow =
  | { type: "birth"; year: number }
  | { type: "entry"; entry: LifelineEntry }
  | { type: "gap"; years: number; fromYear: number }
  | { type: "death"; year: number };

/** Years without a recorded entry before the lifeline names the silence. */
const LIFELINE_GAP_YEARS = 15;

interface LifelineSources {
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints: DecryptedTurningPoint[];
  classifications: DecryptedClassification[];
}

/** First year a classification applies: its earliest period, else its diagnosis year. */
export function classificationStartYear(cls: DecryptedClassification): number | null {
  if (cls.periods.length > 0) return Math.min(...cls.periods.map((p) => p.start_year));
  return cls.diagnosis_year;
}

/** Last end year across periods; null when any period is ongoing or none exist. */
export function classificationEndYear(cls: DecryptedClassification): number | null {
  if (cls.periods.length === 0 || cls.periods.some((p) => p.end_year == null)) return null;
  return Math.max(...cls.periods.map((p) => p.end_year as number));
}

/**
 * The year an entry sits at on this person's line: read the way the timeline
 * reads it, so "as a child" or "at 12" lands from the birth year.
 */
function yearOf(
  approximateDate: string | undefined | null,
  birthYear: number | null,
): number | null {
  const reading = readDate(approximateDate);
  return reading ? (yearsFor(reading, birthYear)?.from ?? null) : null;
}

function compareEntries(a: LifelineEntry, b: LifelineEntry): number {
  if (a.year !== b.year) {
    if (a.year == null) return 1;
    if (b.year == null) return -1;
    return a.year - b.year;
  }
  return LIFELINE_KINDS.indexOf(a.kind) - LIFELINE_KINDS.indexOf(b.kind);
}

/** All of a person's entries, dated ones in year order and undated ones last. */
export function buildLifelineEntries(
  sources: LifelineSources,
  birthYear: number | null = null,
): LifelineEntry[] {
  const entries: LifelineEntry[] = [
    ...sources.events.map(
      (entity): LifelineEntry => ({
        kind: "trauma_event",
        id: entity.id,
        year: yearOf(entity.approximate_date, birthYear),
        entity,
      }),
    ),
    ...sources.lifeEvents.map(
      (entity): LifelineEntry => ({
        kind: "life_event",
        id: entity.id,
        year: yearOf(entity.approximate_date, birthYear),
        entity,
      }),
    ),
    ...sources.turningPoints.map(
      (entity): LifelineEntry => ({
        kind: "turning_point",
        id: entity.id,
        year: yearOf(entity.approximate_date, birthYear),
        entity,
      }),
    ),
    ...sources.classifications.map(
      (entity): LifelineEntry => ({
        kind: "classification",
        id: entity.id,
        year: classificationStartYear(entity),
        endYear: classificationEndYear(entity),
        entity,
      }),
    ),
  ];
  return entries.sort(compareEntries);
}

/**
 * Rows to draw: birth, the dated entries with a gap row wherever
 * LIFELINE_GAP_YEARS or more pass without one, then death. Undated entries are
 * returned separately because they have no place on the line.
 */
export function buildLifelineRows(
  entries: LifelineEntry[],
  birthYear: number | null,
  deathYear: number | null,
): { rows: LifelineRow[]; undated: LifelineEntry[] } {
  const rows: LifelineRow[] = [];
  const undated: LifelineEntry[] = [];
  if (birthYear != null) rows.push({ type: "birth", year: birthYear });
  let previous: number | null = null;
  for (const entry of entries) {
    if (entry.year == null) {
      undated.push(entry);
      continue;
    }
    if (previous != null && entry.year - previous >= LIFELINE_GAP_YEARS) {
      rows.push({ type: "gap", years: entry.year - previous, fromYear: previous });
    }
    rows.push({ type: "entry", entry });
    previous = entry.year;
  }
  if (deathYear != null) rows.push({ type: "death", year: deathYear });
  return { rows, undated };
}
