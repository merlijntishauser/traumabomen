import React, { useCallback } from "react";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import type { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../../types/domain";
import type { LabelEntry } from "./personLane.helpers";
import {
  collectClassificationLabelEntries,
  collectDateLabelEntries,
  stackLabels,
} from "./personLane.helpers";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import type { MarkerClickInfo, TimelineMode, TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT, ROW_HEIGHT } from "./timelineHelpers";
import type { LaneOrientation, MarkerContext } from "./timelineMarkers";
import {
  ClassificationStrips,
  LifeEventMarkers,
  TraumaMarkers,
  TurningPointMarkers,
} from "./timelineMarkers";

interface PersonLaneProps {
  person: DecryptedPerson;
  y: number;
  xScale: (year: number) => number;
  zoomK?: number;
  currentYear: number;
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints?: DecryptedTurningPoint[];
  classifications: DecryptedClassification[];
  persons: Map<string, DecryptedPerson>;
  traumaColors: Record<TraumaCategory, string>;
  lifeEventColors: Record<LifeEventCategory, string>;
  turningPointColors?: Record<TurningPointCategory, string>;
  cssVar: (name: string) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onTooltip: (state: { visible: boolean; x: number; y: number; lines: TooltipLine[] }) => void;
  selected?: boolean;
  dimmed?: boolean;
  mode?: TimelineMode;
  dims?: DimSets;
  filterMode?: FilterMode;
  onSelectPerson?: (personId: string) => void;
  onClickMarker?: (info: MarkerClickInfo) => void;
  showClassifications?: boolean;
  showMarkerLabels?: boolean;
  selectedEntityKeys?: Set<string>;
  onToggleEntitySelect?: (key: string) => void;
  patternRings?: PatternRingsMap;
}

export const PersonLane = React.memo(function PersonLane({
  person,
  y,
  xScale,
  zoomK = 1,
  currentYear,
  events,
  lifeEvents,
  turningPoints = [],
  classifications,
  persons,
  traumaColors,
  lifeEventColors,
  turningPointColors,
  cssVar,
  t,
  onTooltip,
  selected,
  dimmed,
  mode = "explore",
  dims,
  filterMode = "dim",
  onSelectPerson,
  onClickMarker,
  showClassifications = true,
  showMarkerLabels = true,
  selectedEntityKeys,
  onToggleEntitySelect,
  patternRings,
}: PersonLaneProps) {
  const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
  const cy = y + ROW_HEIGHT / 2;
  const hasBirth = person.birth_year != null;
  const birthX = xScale(person.birth_year ?? 0);
  const deathX = xScale(person.death_year ?? currentYear);
  const canvasStroke = cssVar("--color-bg-canvas");
  // Counter-scale: neutralize the parent zoom group's horizontal scale on point markers
  const inv = 1 / zoomK;
  const markerTransform = (px: number) =>
    zoomK === 1 ? undefined : `translate(${px},0) scale(${inv},1) translate(${-px},0)`;

  const labelTransform = (px: number) =>
    zoomK === 1 ? undefined : `translate(${px},0) scale(${inv},1) translate(${-px},0)`;

  const hideTooltip = useCallback(() => {
    onTooltip({ visible: false, x: 0, y: 0, lines: [] });
  }, [onTooltip]);

  const handleLaneClick = useCallback(() => {
    onSelectPerson?.(person.id);
  }, [onSelectPerson, person.id]);

  const handleMarkerClick = useCallback(
    (entityType: MarkerClickInfo["entityType"], entityId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (mode === "annotate") {
        onToggleEntitySelect?.(`${entityType}:${entityId}`);
      } else {
        onClickMarker?.({ personId: person.id, entityType, entityId });
      }
    },
    [mode, onClickMarker, onToggleEntitySelect, person.id],
  );

  // Compute label y-offsets to prevent horizontal overlap (stacking up)
  const labelOffsets = (() => {
    if (!showMarkerLabels) return new Map<string, number>();
    const CHAR_W = 6;
    const charW = CHAR_W * inv;
    const entries: LabelEntry[] = [];
    if (showClassifications && hasBirth) {
      entries.push(
        ...collectClassificationLabelEntries(classifications, dims, filterMode, xScale, t, charW),
      );
    }
    entries.push(
      ...collectDateLabelEntries(events, dims?.dimmedEventIds, filterMode, xScale, charW, "t"),
    );
    entries.push(
      ...collectDateLabelEntries(
        lifeEvents,
        dims?.dimmedLifeEventIds,
        filterMode,
        xScale,
        charW,
        "l",
      ),
    );
    entries.push(
      ...collectDateLabelEntries(
        turningPoints,
        dims?.dimmedTurningPointIds,
        filterMode,
        xScale,
        charW,
        "tp",
      ),
    );
    return stackLabels(entries, 4 * inv, 12);
  })();

  const orientation: LaneOrientation = {
    pointAt: (year) => ({ x: xScale(year), y: cy }),
    primaryPos: (year) => xScale(year),
    markerTransform,
    dateText: (year) => String(year),
    markerLabelAt: (year, labelKey) => ({
      x: xScale(year),
      y: barY - 2 - (labelOffsets.get(labelKey) ?? 0),
    }),
    stripRect: (startPos, endPos, stripIdx) => ({
      x: startPos,
      y: barY + BAR_HEIGHT + 2 + stripIdx * 5,
      width: endPos - startPos,
      height: 4,
    }),
    stripLabelAt: (pos, labelKey) => ({
      x: pos,
      y: barY - 2 - (labelOffsets.get(labelKey) ?? 0),
      transform: labelTransform(pos),
    }),
    diagLabelAt: (year, labelKey) => ({
      x: xScale(year),
      y: barY - 2 - (labelOffsets.get(labelKey) ?? 0),
    }),
    fallbackEndPos: xScale(currentYear),
  };

  const ctx: MarkerContext = {
    orientation,
    persons,
    traumaColors,
    lifeEventColors,
    turningPointColors,
    canvasStroke,
    classificationDiagnosedColor: cssVar("--color-classification-diagnosed"),
    classificationSuspectedColor: cssVar("--color-classification-suspected"),
    hideTooltip,
    onTooltip,
    handleMarkerClick,
    dims,
    filterMode,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  };

  const className = ["tl-lane", selected && "tl-lane--selected", dimmed && "tl-lane--dimmed"]
    .filter(Boolean)
    .join(" ");

  return (
    <g className={className}>
      {/* Invisible hit area for click handling */}
      <rect
        x={birthX - 50}
        y={y}
        width={Math.max(100, deathX - birthX + 100)}
        height={ROW_HEIGHT}
        className={`tl-lane-hitarea${mode === "edit" ? " tl-lane-hitarea--edit" : ""}${mode === "annotate" ? " tl-lane-hitarea--annotate" : ""}`}
        onClick={handleLaneClick}
      />

      {/* Life bar */}
      {hasBirth && (
        <rect
          x={birthX}
          y={barY}
          width={Math.max(0, deathX - birthX)}
          height={BAR_HEIGHT}
          rx={3}
          fill={cssVar("--color-lifebar-fill")}
          stroke={cssVar("--color-lifebar-stroke")}
          strokeWidth={1}
          className="tl-lifebar"
        />
      )}

      {showClassifications && hasBirth && (
        <ClassificationStrips ctx={ctx} classifications={classifications} />
      )}
      <TraumaMarkers ctx={ctx} events={events} />
      <TurningPointMarkers ctx={ctx} turningPoints={turningPoints} />
      <LifeEventMarkers ctx={ctx} lifeEvents={lifeEvents} />
    </g>
  );
});
