import React, { useMemo } from "react";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import { getPatternColor } from "../../lib/patternColors";
import type { PersonColumn, PersonRow } from "./timelineHelpers";

interface TimelinePatternArcsProps {
  patterns: Map<string, DecryptedPattern>;
  visiblePatternIds: Set<string>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  persons: Map<string, DecryptedPerson>;
  direction: "horizontal" | "vertical";
  rows?: PersonRow[];
  totalHeight?: number;
  columns?: PersonColumn[];
  totalWidth?: number;
  hoveredPatternId: string | null;
  onPatternHover: (patternId: string | null) => void;
  onPatternClick: (patternId: string) => void;
}

interface ArcSpan {
  patternId: string;
  color: string;
  name: string;
  min: number;
  max: number;
}

interface EntityDateInfo {
  year: number;
  personIds: string[];
}

function parseYear(dateStr: string): number | null {
  const year = Number.parseInt(dateStr, 10);
  return Number.isNaN(year) ? null : year;
}

function getClassificationYear(cls: DecryptedClassification): number | null {
  if (cls.diagnosis_year != null) return cls.diagnosis_year;
  return cls.periods.length > 0 ? cls.periods[0].start_year : null;
}

function resolveEntityDateInfo(
  entityType: string,
  entityId: string,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
): EntityDateInfo | null {
  if (entityType === "trauma_event") {
    const ev = events.get(entityId);
    if (!ev) return null;
    const year = parseYear(ev.approximate_date);
    return year !== null ? { year, personIds: ev.person_ids } : null;
  }
  if (entityType === "life_event") {
    const le = lifeEvents.get(entityId);
    if (!le) return null;
    const year = parseYear(le.approximate_date);
    return year !== null ? { year, personIds: le.person_ids } : null;
  }
  if (entityType === "classification") {
    const cls = classifications.get(entityId);
    if (!cls) return null;
    const year = getClassificationYear(cls);
    return year !== null ? { year, personIds: cls.person_ids } : null;
  }
  return null;
}

function resolveEntityDate(
  entityType: string,
  entityId: string,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
): number | null {
  return (
    resolveEntityDateInfo(entityType, entityId, events, lifeEvents, classifications)?.year ?? null
  );
}

function resolveEntityAge(
  entityType: string,
  entityId: string,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  persons: Map<string, DecryptedPerson>,
): number | null {
  const info = resolveEntityDateInfo(entityType, entityId, events, lifeEvents, classifications);
  if (!info || info.personIds.length === 0) return null;
  const person = persons.get(info.personIds[0]);
  if (!person?.birth_year) return null;
  return info.year - person.birth_year;
}

function resolveCoord(
  entityType: string,
  entityId: string,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  direction: "horizontal" | "vertical",
  persons: Map<string, DecryptedPerson>,
): number | null {
  return direction === "horizontal"
    ? resolveEntityDate(entityType, entityId, events, lifeEvents, classifications)
    : resolveEntityAge(entityType, entityId, events, lifeEvents, classifications, persons);
}

function computeSpanForPattern(
  pattern: DecryptedPattern,
  patternId: string,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  direction: "horizontal" | "vertical",
  persons: Map<string, DecryptedPerson>,
): ArcSpan | null {
  if (pattern.linked_entities.length === 0) return null;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const le of pattern.linked_entities) {
    const coord = resolveCoord(
      le.entity_type,
      le.entity_id,
      events,
      lifeEvents,
      classifications,
      direction,
      persons,
    );
    if (coord !== null) {
      if (coord < min) min = coord;
      if (coord > max) max = coord;
    }
  }

  if (min > max) return null;

  // Ensure a minimum visible width for single-point patterns
  if (min === max) {
    min -= 1;
    max += 1;
  }

  return {
    patternId,
    color: getPatternColor(pattern.color),
    name: pattern.name,
    min,
    max,
  };
}

export function computeArcSpans(
  patterns: Map<string, DecryptedPattern>,
  visiblePatternIds: Set<string>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  direction: "horizontal" | "vertical",
  persons: Map<string, DecryptedPerson>,
): ArcSpan[] {
  const spans: ArcSpan[] = [];
  for (const [patternId, pattern] of patterns) {
    if (!visiblePatternIds.has(patternId)) continue;
    const span = computeSpanForPattern(
      pattern,
      patternId,
      events,
      lifeEvents,
      classifications,
      direction,
      persons,
    );
    if (span) spans.push(span);
  }
  return spans;
}

function ArcBand({
  arc,
  isHovered,
  direction,
  bandSize,
  onPatternHover,
  onPatternClick,
}: {
  arc: ArcSpan;
  isHovered: boolean;
  direction: "horizontal" | "vertical";
  bandSize: number;
  onPatternHover: (id: string | null) => void;
  onPatternClick: (id: string) => void;
}) {
  const isHorizontal = direction === "horizontal";
  const rectProps = isHorizontal
    ? { x: arc.min, y: 0, width: arc.max - arc.min, height: bandSize }
    : { x: 0, y: arc.min, width: bandSize, height: arc.max - arc.min };

  const textX = isHorizontal ? arc.min + (arc.max - arc.min) / 2 : 16;
  const textY = isHorizontal ? 16 : arc.min + (arc.max - arc.min) / 2 + 4;

  return (
    <g
      className="tl-pattern-arc"
      onMouseEnter={() => onPatternHover(arc.patternId)}
      onMouseLeave={() => onPatternHover(null)}
      onClick={() => onPatternClick(arc.patternId)}
      data-testid={`pattern-arc-${arc.patternId}`}
    >
      <rect
        {...rectProps}
        fill={arc.color}
        fillOpacity={isHovered ? 0.18 : 0.1}
        stroke={arc.color}
        strokeWidth={1}
        strokeDasharray="6 4"
        strokeOpacity={isHovered ? 0.6 : 0.3}
      />
      <text
        x={textX}
        y={textY}
        textAnchor={isHorizontal ? "middle" : undefined}
        className="tl-pattern-arc-label"
        fill={arc.color}
        opacity={isHovered ? 1 : 0}
        style={{ paintOrder: "stroke fill" }}
        stroke="var(--color-bg-primary)"
        strokeWidth={3}
      >
        {arc.name}
      </text>
    </g>
  );
}

export const TimelinePatternArcs = React.memo(function TimelinePatternArcs({
  patterns,
  visiblePatternIds,
  events,
  lifeEvents,
  classifications,
  persons,
  direction,
  totalHeight,
  totalWidth,
  hoveredPatternId,
  onPatternHover,
  onPatternClick,
}: TimelinePatternArcsProps) {
  const arcSpans = useMemo(
    () =>
      computeArcSpans(
        patterns,
        visiblePatternIds,
        events,
        lifeEvents,
        classifications,
        direction,
        persons,
      ),
    [patterns, visiblePatternIds, events, lifeEvents, classifications, direction, persons],
  );

  if (arcSpans.length === 0) return null;

  const bandSize = direction === "horizontal" ? (totalHeight ?? 0) : (totalWidth ?? 0);

  return (
    <g className="tl-pattern-arcs" data-testid="pattern-arcs">
      {arcSpans.map((arc) => (
        <ArcBand
          key={arc.patternId}
          arc={arc}
          isHovered={hoveredPatternId === arc.patternId}
          direction={direction}
          bandSize={bandSize}
          onPatternHover={onPatternHover}
          onPatternClick={onPatternClick}
        />
      ))}
    </g>
  );
});
