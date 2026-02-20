import React, { useMemo } from "react";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { getPatternColor } from "../../lib/patternColors";
import type { PersonColumn, PersonRow } from "./timelineHelpers";

export interface PatternRing {
  color: string;
  patternId: string;
}

export type PatternRingsMap = Map<string, PatternRing[]>;

interface TimelinePatternLanesProps {
  patterns: Map<string, DecryptedPattern>;
  visiblePatternIds: Set<string>;
  hoveredPatternId: string | null;
  onPatternHover: (patternId: string | null) => void;
  onPatternClick: (patternId: string) => void;
  direction: "horizontal" | "vertical";
  rows?: PersonRow[];
  rowHeight?: number;
  labelX?: number;
  columns?: PersonColumn[];
  height?: number;
}

interface LaneTint {
  patternId: string;
  patternName: string;
  personId: string;
  color: string;
}

export function computePatternRings(
  patterns: Map<string, DecryptedPattern>,
  visiblePatternIds: Set<string>,
): PatternRingsMap {
  const rings: PatternRingsMap = new Map();

  for (const [patternId, pattern] of patterns) {
    if (!visiblePatternIds.has(patternId)) continue;
    const color = getPatternColor(pattern.color);

    for (const le of pattern.linked_entities) {
      const key = `${le.entity_type}:${le.entity_id}`;
      const existing = rings.get(key) ?? [];
      existing.push({ color, patternId });
      rings.set(key, existing);
    }
  }

  return rings;
}

export const TimelinePatternLanes = React.memo(function TimelinePatternLanes({
  patterns,
  visiblePatternIds,
  hoveredPatternId,
  onPatternHover,
  onPatternClick,
  direction,
  rows,
  rowHeight,
  labelX = 4,
  columns,
  height,
}: TimelinePatternLanesProps) {
  const laneTints = useMemo(() => {
    const tints: LaneTint[] = [];
    for (const [patternId, pattern] of patterns) {
      if (!visiblePatternIds.has(patternId)) continue;
      const color = getPatternColor(pattern.color);
      for (const personId of pattern.person_ids) {
        tints.push({ patternId, patternName: pattern.name, personId, color });
      }
    }
    return tints;
  }, [patterns, visiblePatternIds]);

  if (laneTints.length === 0) return null;

  if (direction === "horizontal" && rows && rowHeight != null) {
    const rowByPersonId = new Map(rows.map((r) => [r.person.id, r]));
    return (
      <g className="tl-pattern-lanes" data-testid="pattern-lanes">
        {laneTints.map((tint) => {
          const row = rowByPersonId.get(tint.personId);
          if (!row) return null;
          const isHovered = hoveredPatternId === tint.patternId;
          return (
            <g key={`${tint.patternId}-${tint.personId}`}>
              <rect
                x={0}
                y={row.y}
                width="100%"
                height={rowHeight}
                fill={tint.color}
                fillOpacity={isHovered ? 0.14 : 0.08}
                className="tl-pattern-lane"
                data-testid={`pattern-lane-${tint.patternId}-${tint.personId}`}
                onMouseEnter={() => onPatternHover(tint.patternId)}
                onMouseLeave={() => onPatternHover(null)}
                onClick={() => onPatternClick(tint.patternId)}
              />
              <text
                x={labelX}
                y={row.y + rowHeight - 4}
                fill={tint.color}
                opacity={isHovered ? 0.9 : 0.5}
                className="tl-pattern-lane-label"
                data-testid={`pattern-label-${tint.patternId}-${tint.personId}`}
              >
                {tint.patternName}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  if (direction === "vertical" && columns && height != null) {
    const colByPersonId = new Map(columns.map((c) => [c.person.id, c]));
    return (
      <g className="tl-pattern-lanes" data-testid="pattern-lanes">
        {laneTints.map((tint) => {
          const col = colByPersonId.get(tint.personId);
          if (!col) return null;
          const isHovered = hoveredPatternId === tint.patternId;
          return (
            <g key={`${tint.patternId}-${tint.personId}`}>
              <rect
                x={col.x}
                y={0}
                width={col.laneWidth}
                height={height}
                fill={tint.color}
                fillOpacity={isHovered ? 0.14 : 0.08}
                className="tl-pattern-lane"
                data-testid={`pattern-lane-${tint.patternId}-${tint.personId}`}
                onMouseEnter={() => onPatternHover(tint.patternId)}
                onMouseLeave={() => onPatternHover(null)}
                onClick={() => onPatternClick(tint.patternId)}
              />
              <text
                x={col.x + col.laneWidth - 3}
                y={44}
                fill={tint.color}
                opacity={isHovered ? 0.9 : 0.5}
                className="tl-pattern-lane-label"
                textAnchor="start"
                dominantBaseline="hanging"
                transform={`rotate(90, ${col.x + col.laneWidth - 3}, 44)`}
                data-testid={`pattern-label-${tint.patternId}-${tint.personId}`}
              >
                {tint.patternName}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return null;
});
