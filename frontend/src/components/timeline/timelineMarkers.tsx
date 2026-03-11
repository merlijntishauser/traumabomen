import React from "react";
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
import type { MarkerClickInfo, TooltipLine } from "./timelineHelpers";
import { MARKER_RADIUS } from "./timelineHelpers";

// ---- Orientation strategy ----

export interface LabelProps {
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

function starPath(x: number, y: number, r: number): string {
  return `M${x},${y - r} L${x + r * 0.22},${y - r * 0.31} L${x + r * 0.95},${y - r * 0.31} L${x + r * 0.36},${y + r * 0.12} L${x + r * 0.59},${y + r * 0.81} L${x},${y + r * 0.38} L${x - r * 0.59},${y + r * 0.81} L${x - r * 0.36},${y + r * 0.12} L${x - r * 0.95},${y - r * 0.31} L${x - r * 0.22},${y - r * 0.31} Z`;
}

function trianglePath(x: number, y: number, size: number): string {
  return `M${x},${y - size} L${x + size},${y + size} L${x - size},${y + size} Z`;
}

// ---- Shared marker sub-elements ----

function SelectionRing({
  mx,
  my,
  isSelected,
}: {
  mx: number;
  my: number;
  isSelected: boolean | undefined;
}) {
  if (!isSelected) return null;
  return <circle cx={mx} cy={my} r={MARKER_RADIUS + 3} className="tl-selection-ring" />;
}

function PatternRings({
  mx,
  my,
  entityKey,
  patternRings,
}: {
  mx: number;
  my: number;
  entityKey: string;
  patternRings?: PatternRingsMap;
}) {
  const rings = patternRings?.get(entityKey);
  if (!rings) return null;
  return (
    <>
      {rings.map((ring, ri) => (
        <circle
          key={ring.patternId}
          cx={mx}
          cy={my}
          r={MARKER_RADIUS + 2 + ri * 2}
          fill="none"
          stroke={ring.color}
          strokeWidth={1.5}
          strokeOpacity={0.7}
          className="tl-pattern-ring"
        />
      ))}
    </>
  );
}

// ---- Extracted label sub-components ----

function MarkerLabel({
  orientation,
  year,
  labelKey,
  title,
}: {
  orientation: LaneOrientation;
  year: number;
  labelKey: string;
  title: string;
}) {
  const lbl = orientation.markerLabelAt(year, labelKey);
  return (
    <text x={lbl.x} y={lbl.y} className="tl-marker-label" textAnchor={lbl.textAnchor}>
      {title}
    </text>
  );
}

function StripLabel({
  orientation,
  startPos,
  labelKey,
  label,
}: {
  orientation: LaneOrientation;
  startPos: number;
  labelKey: string;
  label: string;
}) {
  const lbl = orientation.stripLabelAt(startPos, labelKey);
  return (
    <text
      x={lbl.x}
      y={lbl.y}
      className="tl-marker-label"
      textAnchor={lbl.textAnchor}
      transform={lbl.transform}
    >
      {label}
    </text>
  );
}

function DiagnosisLabel({
  orientation,
  diagnosisYear,
  labelKey,
  label,
}: {
  orientation: LaneOrientation;
  diagnosisYear: number;
  labelKey: string;
  label: string;
}) {
  const lbl = orientation.diagLabelAt(diagnosisYear, labelKey);
  return (
    <text x={lbl.x} y={lbl.y} className="tl-marker-label" textAnchor={lbl.textAnchor}>
      {label}
    </text>
  );
}

// ---- Diagnosis triangle sub-component ----

function DiagnosisTriangle({
  cls,
  clsColor,
  ctx,
}: {
  cls: DecryptedClassification;
  clsColor: string;
  ctx: MarkerContext;
}) {
  const {
    orientation,
    canvasStroke,
    handleMarkerClick,
    onTooltip,
    hideTooltip,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  } = ctx;

  if (cls.diagnosis_year == null) return null;

  const { x: mx, y: my } = orientation.pointAt(cls.diagnosis_year);
  const triSize = MARKER_RADIUS * 0.85;
  const triP = trianglePath(mx, my, triSize);
  const primaryPos = orientation.primaryPos(cls.diagnosis_year);

  const catLabel = t(`dsm.${cls.dsm_category}`);
  const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
  const isClsSelected = selectedEntityKeys?.has(`classification:${cls.id}`);
  const triLabel = subLabel ?? catLabel;

  return (
    <g transform={orientation.markerTransform(primaryPos)}>
      <path
        d={triP}
        fill={clsColor}
        stroke={canvasStroke}
        strokeWidth={1.5}
        className="tl-marker"
        onClick={(e) => handleMarkerClick("classification", cls.id, e)}
        onMouseEnter={(e) => {
          onTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            lines: [
              {
                text: subLabel ? `${catLabel} - ${subLabel}` : catLabel,
                bold: true,
              },
              {
                text: `${t("classification.status.diagnosed")} (${cls.diagnosis_year})`,
              },
            ],
          });
        }}
        onMouseLeave={hideTooltip}
      />
      <SelectionRing mx={mx} my={my} isSelected={isClsSelected} />
      <PatternRings
        mx={mx}
        my={my}
        entityKey={`classification:${cls.id}`}
        patternRings={patternRings}
      />
      {showMarkerLabels && cls.diagnosis_year !== cls.periods[0]?.start_year && (
        <DiagnosisLabel
          orientation={orientation}
          diagnosisYear={cls.diagnosis_year}
          labelKey={`ct:${cls.id}`}
          label={triLabel}
        />
      )}
    </g>
  );
}

// ---- Component versions ----

interface ClassificationStripsProps {
  ctx: MarkerContext;
  classifications: DecryptedClassification[];
}

function ClassificationStripsInner({ ctx, classifications }: ClassificationStripsProps) {
  const {
    orientation,
    dims,
    filterMode,
    handleMarkerClick,
    onTooltip,
    hideTooltip,
    showMarkerLabels,
    classificationDiagnosedColor,
    classificationSuspectedColor,
    t,
  } = ctx;

  return (
    <>
      {classifications.map((cls, stripIdx) => {
        const clsColor =
          cls.status === "diagnosed" ? classificationDiagnosedColor : classificationSuspectedColor;
        const isMarkerDimmed = dims?.dimmedClassificationIds.has(cls.id);
        if (isMarkerDimmed && filterMode === "hide") return null;

        return (
          <g key={cls.id} opacity={isMarkerDimmed ? 0.15 : undefined}>
            {cls.periods.map((period, pi) => {
              const startPos = orientation.primaryPos(period.start_year);
              const endPos =
                period.end_year != null
                  ? orientation.primaryPos(period.end_year)
                  : orientation.fallbackEndPos;
              const rect = orientation.stripRect(startPos, endPos, stripIdx);

              const catLabel = t(`dsm.${cls.dsm_category}`);
              const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
              const statusLabel = t(`classification.status.${cls.status}`);
              const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
              const clsLabel = subLabel ?? catLabel;

              return (
                <React.Fragment key={`${cls.id}-p${pi}`}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={Math.max(0, rect.width)}
                    height={Math.max(0, rect.height)}
                    rx={1}
                    fill={clsColor}
                    opacity={0.8}
                    className="tl-marker"
                    onClick={(e) => handleMarkerClick("classification", cls.id, e)}
                    onMouseEnter={(e) => {
                      onTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        lines: [
                          { text: subLabel ? `${catLabel} - ${subLabel}` : catLabel, bold: true },
                          { text: `${statusLabel} ${yearRange}` },
                        ],
                      });
                    }}
                    onMouseLeave={hideTooltip}
                  />
                  {showMarkerLabels && pi === 0 && (
                    <StripLabel
                      orientation={orientation}
                      startPos={startPos}
                      labelKey={`cs:${cls.id}`}
                      label={clsLabel}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {cls.status === "diagnosed" && (
              <DiagnosisTriangle cls={cls} clsColor={clsColor} ctx={ctx} />
            )}
          </g>
        );
      })}
    </>
  );
}

interface TraumaMarkersProps {
  ctx: MarkerContext;
  events: DecryptedEvent[];
}

function TraumaMarkersInner({ ctx, events }: TraumaMarkersProps) {
  const {
    orientation,
    persons,
    traumaColors,
    canvasStroke,
    hideTooltip,
    onTooltip,
    handleMarkerClick,
    dims,
    filterMode,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  } = ctx;

  return (
    <>
      {events.map((event) => {
        const year = Number.parseInt(event.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const { x: mx, y: my } = orientation.pointAt(year);
        const primaryPos = orientation.primaryPos(year);
        const linkedNames = event.person_ids
          .map((pid) => persons.get(pid)?.name)
          .filter(Boolean)
          .join(", ");

        const isMarkerDimmed = dims?.dimmedEventIds.has(event.id);
        if (isMarkerDimmed && filterMode === "hide") return null;
        const isEntitySelected = selectedEntityKeys?.has(`trauma_event:${event.id}`);

        return (
          <g
            key={event.id}
            transform={orientation.markerTransform(primaryPos)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <circle
              cx={mx}
              cy={my}
              r={MARKER_RADIUS}
              fill={traumaColors[event.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              onClick={(e) => handleMarkerClick("trauma_event", event.id, e)}
              onMouseEnter={(e) => {
                onTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  lines: [
                    { text: event.title, bold: true },
                    { text: t(`trauma.category.${event.category}`) },
                    { text: orientation.dateText(year) },
                    { text: t("timeline.severity", { value: event.severity }) },
                    { text: linkedNames },
                  ],
                });
              }}
              onMouseLeave={hideTooltip}
            />
            <SelectionRing mx={mx} my={my} isSelected={isEntitySelected} />
            <PatternRings
              mx={mx}
              my={my}
              entityKey={`trauma_event:${event.id}`}
              patternRings={patternRings}
            />
            {showMarkerLabels && (
              <MarkerLabel
                orientation={orientation}
                year={year}
                labelKey={`t:${event.id}`}
                title={event.title}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

interface TurningPointMarkersProps {
  ctx: MarkerContext;
  turningPoints: DecryptedTurningPoint[];
}

function TurningPointMarkersInner({ ctx, turningPoints }: TurningPointMarkersProps) {
  const { turningPointColors } = ctx;
  if (!turningPointColors) return null;

  const {
    orientation,
    persons,
    canvasStroke,
    hideTooltip,
    onTooltip,
    handleMarkerClick,
    dims,
    filterMode,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  } = ctx;

  return (
    <>
      {turningPoints.map((tp) => {
        const year = Number.parseInt(tp.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const { x: mx, y: my } = orientation.pointAt(year);
        const primaryPos = orientation.primaryPos(year);
        const r = MARKER_RADIUS;
        const path = starPath(mx, my, r);

        const linkedNames = tp.person_ids
          .map((pid) => persons.get(pid)?.name)
          .filter(Boolean)
          .join(", ");

        const lines: TooltipLine[] = [
          { text: tp.title, bold: true },
          { text: t(`turningPoint.category.${tp.category}`) },
          { text: orientation.dateText(year) },
        ];
        if (tp.significance != null) {
          lines.push({ text: t("timeline.significance", { value: tp.significance }) });
        }
        lines.push({ text: linkedNames });

        const isMarkerDimmed = dims?.dimmedTurningPointIds.has(tp.id);
        if (isMarkerDimmed && filterMode === "hide") return null;
        const isEntitySelected = selectedEntityKeys?.has(`turning_point:${tp.id}`);

        return (
          <g
            key={tp.id}
            transform={orientation.markerTransform(primaryPos)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <path
              d={path}
              fill={turningPointColors[tp.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker tl-marker--star"
              onClick={(e) => handleMarkerClick("turning_point", tp.id, e)}
              onMouseEnter={(e) => {
                onTooltip({ visible: true, x: e.clientX, y: e.clientY, lines });
              }}
              onMouseLeave={hideTooltip}
            />
            <SelectionRing mx={mx} my={my} isSelected={isEntitySelected} />
            <PatternRings
              mx={mx}
              my={my}
              entityKey={`turning_point:${tp.id}`}
              patternRings={patternRings}
            />
            {showMarkerLabels && (
              <MarkerLabel
                orientation={orientation}
                year={year}
                labelKey={`tp:${tp.id}`}
                title={tp.title}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

interface LifeEventMarkersProps {
  ctx: MarkerContext;
  lifeEvents: DecryptedLifeEvent[];
}

function LifeEventMarkersInner({ ctx, lifeEvents }: LifeEventMarkersProps) {
  const {
    orientation,
    persons,
    lifeEventColors,
    canvasStroke,
    hideTooltip,
    onTooltip,
    handleMarkerClick,
    dims,
    filterMode,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  } = ctx;

  return (
    <>
      {lifeEvents.map((le) => {
        const year = Number.parseInt(le.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const { x: mx, y: my } = orientation.pointAt(year);
        const primaryPos = orientation.primaryPos(year);
        const diamondSize = MARKER_RADIUS * 0.9;
        const linkedNames = le.person_ids
          .map((pid) => persons.get(pid)?.name)
          .filter(Boolean)
          .join(", ");

        const lines: TooltipLine[] = [
          { text: le.title, bold: true },
          { text: t(`lifeEvent.category.${le.category}`) },
          { text: orientation.dateText(year) },
        ];
        if (le.impact != null) {
          lines.push({ text: t("timeline.impact", { value: le.impact }) });
        }
        lines.push({ text: linkedNames });

        const isMarkerDimmed = dims?.dimmedLifeEventIds.has(le.id);
        if (isMarkerDimmed && filterMode === "hide") return null;
        const isEntitySelected = selectedEntityKeys?.has(`life_event:${le.id}`);

        return (
          <g
            key={le.id}
            transform={orientation.markerTransform(primaryPos)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <rect
              x={mx - diamondSize}
              y={my - diamondSize}
              width={diamondSize * 2}
              height={diamondSize * 2}
              transform={`rotate(45, ${mx}, ${my})`}
              fill={lifeEventColors[le.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              onClick={(e) => handleMarkerClick("life_event", le.id, e)}
              onMouseEnter={(e) => {
                onTooltip({ visible: true, x: e.clientX, y: e.clientY, lines });
              }}
              onMouseLeave={hideTooltip}
            />
            <SelectionRing mx={mx} my={my} isSelected={isEntitySelected} />
            <PatternRings
              mx={mx}
              my={my}
              entityKey={`life_event:${le.id}`}
              patternRings={patternRings}
            />
            {showMarkerLabels && (
              <MarkerLabel
                orientation={orientation}
                year={year}
                labelKey={`l:${le.id}`}
                title={le.title}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

// ---- Exported components ----

export const ClassificationStrips = React.memo(ClassificationStripsInner);
export const TraumaMarkers = React.memo(TraumaMarkersInner);
export const TurningPointMarkers = React.memo(TurningPointMarkersInner);
export const LifeEventMarkers = React.memo(LifeEventMarkersInner);

// ---- Backward-compatible render functions ----
// These thin wrappers maintain the existing API for call sites and tests.
// They delegate to the component versions via React.createElement.

export function renderClassificationStrips(
  ctx: MarkerContext,
  classifications: DecryptedClassification[],
): React.ReactNode {
  return <ClassificationStrips ctx={ctx} classifications={classifications} />;
}

export function renderTraumaMarkers(ctx: MarkerContext, events: DecryptedEvent[]): React.ReactNode {
  return <TraumaMarkers ctx={ctx} events={events} />;
}

export function renderTurningPointMarkers(
  ctx: MarkerContext,
  turningPoints: DecryptedTurningPoint[],
): React.ReactNode {
  if (!ctx.turningPointColors) return null;
  return <TurningPointMarkers ctx={ctx} turningPoints={turningPoints} />;
}

export function renderLifeEventMarkers(
  ctx: MarkerContext,
  lifeEvents: DecryptedLifeEvent[],
): React.ReactNode {
  return <LifeEventMarkers ctx={ctx} lifeEvents={lifeEvents} />;
}
