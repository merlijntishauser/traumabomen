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
import { BAR_HEIGHT, ROW_HEIGHT } from "./timelineHelpers";
import type { LaneOrientation, MarkerContext } from "./timelineMarkers";
import {
  renderClassificationStrips,
  renderLifeEventMarkers,
  renderTraumaMarkers,
  renderTurningPointMarkers,
} from "./timelineMarkers";

export interface LabelEntry {
  x: number;
  w: number;
  key: string;
}

function collectClassificationLabelEntries(
  classifications: DecryptedClassification[],
  dims: DimSets | undefined,
  filterMode: FilterMode,
  xScale: (year: number) => number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  charW: number,
): LabelEntry[] {
  const entries: LabelEntry[] = [];
  for (const cls of classifications) {
    if (dims?.dimmedClassificationIds.has(cls.id) && filterMode === "hide") continue;
    if (cls.periods.length === 0) continue;
    const px = xScale(cls.periods[0].start_year);
    const sub = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
    const txt = sub ?? t(`dsm.${cls.dsm_category}`);
    entries.push({ x: px, w: txt.length * charW, key: `cs:${cls.id}` });

    if (
      cls.status === "diagnosed" &&
      cls.diagnosis_year != null &&
      cls.diagnosis_year !== cls.periods[0].start_year
    ) {
      const dx = xScale(cls.diagnosis_year);
      entries.push({ x: dx, w: txt.length * charW, key: `ct:${cls.id}` });
    }
  }
  return entries;
}

export function collectDateLabelEntries(
  items: ReadonlyArray<{ id: string; approximate_date: string; title: string }>,
  dimmedIds: ReadonlySet<string> | undefined,
  filterMode: FilterMode,
  xScale: (year: number) => number,
  charW: number,
  keyPrefix: string,
): LabelEntry[] {
  const entries: LabelEntry[] = [];
  for (const item of items) {
    const yr = Number.parseInt(item.approximate_date, 10);
    if (Number.isNaN(yr)) continue;
    if (dimmedIds?.has(item.id) && filterMode === "hide") continue;
    entries.push({ x: xScale(yr), w: item.title.length * charW, key: `${keyPrefix}:${item.id}` });
  }
  return entries;
}

export function stackLabels(
  entries: LabelEntry[],
  pad: number,
  lineH: number,
): Map<string, number> {
  entries.sort((a, b) => a.x - b.x);
  const offsets = new Map<string, number>();
  const levels: number[] = [-Infinity];

  for (const e of entries) {
    let placed = false;
    for (let i = 0; i < levels.length; i++) {
      if (e.x >= levels[i] + pad) {
        offsets.set(e.key, i * lineH);
        levels[i] = e.x + e.w;
        placed = true;
        break;
      }
    }
    if (!placed) {
      offsets.set(e.key, levels.length * lineH);
      levels.push(e.x + e.w);
    }
  }

  return offsets;
}

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

      {showClassifications && hasBirth && renderClassificationStrips(ctx, classifications)}
      {renderTraumaMarkers(ctx, events)}
      {renderTurningPointMarkers(ctx, turningPoints)}
      {renderLifeEventMarkers(ctx, lifeEvents)}
    </g>
  );
});
