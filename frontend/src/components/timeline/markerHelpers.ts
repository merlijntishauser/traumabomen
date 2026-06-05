import type React from "react";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import type { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../../types/domain";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import type { MarkerClickInfo, TooltipLine } from "./timelineHelpers";

// ---- Orientation strategy ----

interface LabelProps {
  x: number;
  y: number;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  transform?: string;
}

export interface LaneOrientation {
  pointAt: (year: number) => { x: number; y: number };
  primaryPos: (year: number) => number;
  markerTransform: (pos: number) => string | undefined;
  dateText: (year: number) => string;
  markerLabelAt: (year: number, labelKey: string) => LabelProps;
  stripRect: (
    startPos: number,
    endPos: number,
    stripIdx: number,
  ) => { x: number; y: number; width: number; height: number };
  stripLabelAt: (pos: number, labelKey: string) => LabelProps;
  diagLabelAt: (year: number, labelKey: string) => LabelProps;
  fallbackEndPos: number;
}

// ---- Marker context ----

export interface MarkerContext {
  orientation: LaneOrientation;
  persons: Map<string, DecryptedPerson>;
  traumaColors: Record<TraumaCategory, string>;
  lifeEventColors: Record<LifeEventCategory, string>;
  turningPointColors?: Record<TurningPointCategory, string>;
  canvasStroke: string;
  classificationDiagnosedColor: string;
  classificationSuspectedColor: string;
  hideTooltip: () => void;
  onTooltip: (state: { visible: boolean; x: number; y: number; lines: TooltipLine[] }) => void;
  handleMarkerClick: (
    entityType: MarkerClickInfo["entityType"],
    entityId: string,
    e: React.MouseEvent,
  ) => void;
  dims?: DimSets;
  filterMode: FilterMode;
  showMarkerLabels: boolean;
  selectedEntityKeys?: Set<string>;
  patternRings?: PatternRingsMap;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

// ---- Shape path helpers ----

export function starPath(x: number, y: number, r: number): string {
  return `M${x},${y - r} L${x + r * 0.22},${y - r * 0.31} L${x + r * 0.95},${y - r * 0.31} L${x + r * 0.36},${y + r * 0.12} L${x + r * 0.59},${y + r * 0.81} L${x},${y + r * 0.38} L${x - r * 0.59},${y + r * 0.81} L${x - r * 0.36},${y + r * 0.12} L${x - r * 0.95},${y - r * 0.31} L${x - r * 0.22},${y - r * 0.31} Z`;
}

export function trianglePath(x: number, y: number, size: number): string {
  return `M${x},${y - size} L${x + size},${y + size} L${x - size},${y + size} Z`;
}
