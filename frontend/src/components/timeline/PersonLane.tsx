import React, { useCallback } from "react";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import type { LifeEventCategory, TraumaCategory } from "../../types/domain";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import type { TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT, MARKER_RADIUS, ROW_HEIGHT } from "./timelineHelpers";

export type TimelineMode = "explore" | "edit" | "annotate";

export interface LabelEntry {
  x: number;
  w: number;
  key: string;
}

export function collectClassificationLabelEntries(
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

export interface MarkerClickInfo {
  personId: string;
  entityType: "trauma_event" | "life_event" | "classification";
  entityId: string;
}

interface PersonLaneProps {
  person: DecryptedPerson;
  y: number;
  xScale: (year: number) => number;
  zoomK?: number;
  currentYear: number;
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  classifications: DecryptedClassification[];
  persons: Map<string, DecryptedPerson>;
  traumaColors: Record<TraumaCategory, string>;
  lifeEventColors: Record<LifeEventCategory, string>;
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
  classifications,
  persons,
  traumaColors,
  lifeEventColors,
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
    return stackLabels(entries, 4 * inv, 12);
  })();

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

      {/* Classification strips */}
      {showClassifications &&
        hasBirth &&
        classifications.map((cls, stripIdx) => {
          const clsColor = cssVar(
            cls.status === "diagnosed"
              ? "--color-classification-diagnosed"
              : "--color-classification-suspected",
          );
          const stripHeight = 4;
          const isMarkerDimmed = dims?.dimmedClassificationIds.has(cls.id);
          if (isMarkerDimmed && filterMode === "hide") return null;

          return (
            <g key={cls.id} opacity={isMarkerDimmed ? 0.15 : undefined}>
              {/* Period strips */}
              {cls.periods.map((period, pi) => {
                const px1 = xScale(period.start_year);
                const px2 = xScale(period.end_year ?? currentYear);
                const stripY = barY + BAR_HEIGHT + 2 + stripIdx * (stripHeight + 1);

                const catLabel = t(`dsm.${cls.dsm_category}`);
                const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
                const statusLabel = t(`classification.status.${cls.status}`);
                const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
                const clsLabel = subLabel ?? catLabel;

                return (
                  <React.Fragment key={`${cls.id}-p${pi}`}>
                    <rect
                      x={px1}
                      y={stripY}
                      width={Math.max(0, px2 - px1)}
                      height={stripHeight}
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
                      <text
                        x={px1}
                        y={barY - 2 - (labelOffsets.get(`cs:${cls.id}`) ?? 0)}
                        className="tl-marker-label"
                        transform={labelTransform(px1)}
                      >
                        {clsLabel}
                      </text>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Diagnosis triangle */}
              {cls.status === "diagnosed" &&
                cls.diagnosis_year != null &&
                (() => {
                  const dx = xScale(cls.diagnosis_year!);
                  const triSize = MARKER_RADIUS * 0.85;
                  const triPath = `M${dx},${cy - triSize} L${dx + triSize},${cy + triSize} L${dx - triSize},${cy + triSize} Z`;

                  const catLabel = t(`dsm.${cls.dsm_category}`);
                  const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
                  const isClsSelected = selectedEntityKeys?.has(`classification:${cls.id}`);

                  const triLabel = subLabel ?? catLabel;

                  return (
                    <g transform={markerTransform(dx)}>
                      <path
                        d={triPath}
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
                      {isClsSelected && (
                        <circle
                          cx={dx}
                          cy={cy}
                          r={MARKER_RADIUS + 3}
                          className="tl-selection-ring"
                        />
                      )}
                      {patternRings?.get(`classification:${cls.id}`)?.map((ring, ri) => (
                        <circle
                          key={ring.patternId}
                          cx={dx}
                          cy={cy}
                          r={MARKER_RADIUS + 2 + ri * 2}
                          fill="none"
                          stroke={ring.color}
                          strokeWidth={1.5}
                          strokeOpacity={0.7}
                          className="tl-pattern-ring"
                        />
                      ))}
                      {showMarkerLabels && cls.diagnosis_year !== cls.periods[0]?.start_year && (
                        <text
                          x={dx}
                          y={barY - 2 - (labelOffsets.get(`ct:${cls.id}`) ?? 0)}
                          className="tl-marker-label"
                        >
                          {triLabel}
                        </text>
                      )}
                    </g>
                  );
                })()}
            </g>
          );
        })}

      {/* Trauma markers (circles) */}
      {events.map((event) => {
        const year = Number.parseInt(event.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const px = xScale(year);
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
            transform={markerTransform(px)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <circle
              cx={px}
              cy={cy}
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
                    { text: event.approximate_date },
                    { text: t("timeline.severity", { value: event.severity }) },
                    { text: linkedNames },
                  ],
                });
              }}
              onMouseLeave={hideTooltip}
            />
            {isEntitySelected && (
              <circle cx={px} cy={cy} r={MARKER_RADIUS + 3} className="tl-selection-ring" />
            )}
            {patternRings?.get(`trauma_event:${event.id}`)?.map((ring, ri) => (
              <circle
                key={ring.patternId}
                cx={px}
                cy={cy}
                r={MARKER_RADIUS + 2 + ri * 2}
                fill="none"
                stroke={ring.color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                className="tl-pattern-ring"
              />
            ))}
            {showMarkerLabels && (
              <text
                x={px}
                y={barY - 2 - (labelOffsets.get(`t:${event.id}`) ?? 0)}
                className="tl-marker-label"
              >
                {event.title}
              </text>
            )}
          </g>
        );
      })}

      {/* Life event markers (diamonds) */}
      {lifeEvents.map((le) => {
        const year = Number.parseInt(le.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const px = xScale(year);
        const diamondSize = MARKER_RADIUS * 0.9;
        const linkedNames = le.person_ids
          .map((pid) => persons.get(pid)?.name)
          .filter(Boolean)
          .join(", ");

        const lines: TooltipLine[] = [
          { text: le.title, bold: true },
          { text: t(`lifeEvent.category.${le.category}`) },
          { text: le.approximate_date },
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
            transform={markerTransform(px)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <rect
              x={px - diamondSize}
              y={cy - diamondSize}
              width={diamondSize * 2}
              height={diamondSize * 2}
              transform={`rotate(45, ${px}, ${cy})`}
              fill={lifeEventColors[le.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              onClick={(e) => handleMarkerClick("life_event", le.id, e)}
              onMouseEnter={(e) => {
                onTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  lines,
                });
              }}
              onMouseLeave={hideTooltip}
            />
            {isEntitySelected && (
              <circle cx={px} cy={cy} r={MARKER_RADIUS + 3} className="tl-selection-ring" />
            )}
            {patternRings?.get(`life_event:${le.id}`)?.map((ring, ri) => (
              <circle
                key={ring.patternId}
                cx={px}
                cy={cy}
                r={MARKER_RADIUS + 2 + ri * 2}
                fill="none"
                stroke={ring.color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                className="tl-pattern-ring"
              />
            ))}
            {showMarkerLabels && (
              <text
                x={px}
                y={barY - 2 - (labelOffsets.get(`l:${le.id}`) ?? 0)}
                className="tl-marker-label"
              >
                {le.title}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});
