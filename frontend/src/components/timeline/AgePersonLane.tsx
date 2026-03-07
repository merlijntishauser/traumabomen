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
import type { PatternRingsMap } from "./TimelinePatternLanes";
import type { MarkerClickInfo, TimelineMode, TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT, MARKER_RADIUS } from "./timelineHelpers";
import type { LaneOrientation, MarkerContext } from "./timelineMarkers";
import {
  renderClassificationStrips,
  renderLifeEventMarkers,
  renderTraumaMarkers,
  renderTurningPointMarkers,
} from "./timelineMarkers";

interface AgePersonLaneProps {
  person: DecryptedPerson;
  x: number;
  laneWidth: number;
  yScale: (age: number) => number;
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

export const AgePersonLane = React.memo(function AgePersonLane({
  person,
  x,
  laneWidth,
  yScale,
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
}: AgePersonLaneProps) {
  const hasBirth = person.birth_year != null;
  const birthYear = person.birth_year ?? 0;
  const deathAge = person.death_year != null ? person.death_year - birthYear : null;
  const currentAge = currentYear - birthYear;
  const maxAge = deathAge ?? currentAge;
  const cx = x + laneWidth / 2;
  const barWidth = Math.max(BAR_HEIGHT, laneWidth - 8);
  const barX = x + (laneWidth - barWidth) / 2;
  const canvasStroke = cssVar("--color-bg-canvas");

  const ageOf = (year: number) => year - birthYear;
  const ageLabel = (year: number) => `${t("timeline.ageAxis")}: ${ageOf(year)}`;
  const scaledAge = (year: number) => yScale(ageOf(year));
  // Counter-scale: neutralize the parent zoom group's vertical scale on point markers
  const inv = 1 / zoomK;
  const markerTransform = (py: number) =>
    zoomK === 1 ? undefined : `translate(0,${py}) scale(1,${inv}) translate(0,${-py})`;
  const labelTransform = (py: number) =>
    zoomK === 1 ? undefined : `translate(0,${py}) scale(1,${inv}) translate(0,${-py})`;

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

  const orientation: LaneOrientation = {
    pointAt: (year) => ({ x: cx, y: scaledAge(year) }),
    primaryPos: (year) => scaledAge(year),
    markerTransform,
    dateText: (year) => ageLabel(year),
    markerLabelAt: (year) => ({
      x: cx,
      y: scaledAge(year) - MARKER_RADIUS - 2,
      textAnchor: "middle",
    }),
    stripRect: (startPos, endPos, stripIdx) => ({
      x: barX + barWidth + 2 + stripIdx * 5,
      y: startPos,
      width: 4,
      height: endPos - startPos,
    }),
    stripLabelAt: (pos) => ({
      x: cx,
      y: pos - 2,
      textAnchor: "middle",
      transform: labelTransform(pos - 2),
    }),
    diagLabelAt: (year) => ({
      x: cx,
      y: scaledAge(year) - MARKER_RADIUS - 2,
      textAnchor: "middle",
    }),
    fallbackEndPos: yScale(maxAge),
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
      {/* Hit area */}
      <rect
        x={x}
        y={yScale(0) - 5}
        width={laneWidth}
        height={Math.max(10, yScale(maxAge) - yScale(0) + 10)}
        className={`tl-lane-hitarea${mode === "edit" ? " tl-lane-hitarea--edit" : ""}${mode === "annotate" ? " tl-lane-hitarea--annotate" : ""}`}
        onClick={handleLaneClick}
      />

      {/* Vertical life bar */}
      {hasBirth && (
        <rect
          x={barX}
          y={yScale(0)}
          width={barWidth}
          height={Math.max(0, yScale(maxAge) - yScale(0))}
          rx={3}
          fill={cssVar("--color-lifebar-fill")}
          stroke={cssVar("--color-lifebar-stroke")}
          strokeWidth={1}
          className="tl-lifebar tl-lifebar-v"
        />
      )}

      {showClassifications && hasBirth && renderClassificationStrips(ctx, classifications)}
      {renderTraumaMarkers(ctx, events)}
      {renderTurningPointMarkers(ctx, turningPoints)}
      {renderLifeEventMarkers(ctx, lifeEvents)}
    </g>
  );
});
