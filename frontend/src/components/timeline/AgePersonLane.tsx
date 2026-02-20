import React, { useCallback } from "react";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import type { LifeEventCategory, TraumaCategory } from "../../types/domain";
import type { MarkerClickInfo, TimelineMode } from "./PersonLane";
import type { PatternRingsMap } from "./TimelinePatternLanes";
import type { TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT, MARKER_RADIUS } from "./timelineHelpers";

interface AgePersonLaneProps {
  person: DecryptedPerson;
  x: number;
  laneWidth: number;
  yScale: (age: number) => number;
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

export const AgePersonLane = React.memo(function AgePersonLane({
  person,
  x,
  laneWidth,
  yScale,
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

      {/* Classification strips (vertical) */}
      {showClassifications &&
        hasBirth &&
        classifications.map((cls, stripIdx) => {
          const clsColor = cssVar(
            cls.status === "diagnosed"
              ? "--color-classification-diagnosed"
              : "--color-classification-suspected",
          );
          const stripWidth = 4;
          const isMarkerDimmed = dims?.dimmedClassificationIds.has(cls.id);
          if (isMarkerDimmed && filterMode === "hide") return null;

          return (
            <g key={cls.id} opacity={isMarkerDimmed ? 0.15 : undefined}>
              {cls.periods.map((period, pi) => {
                const startY = scaledAge(period.start_year);
                const endY = period.end_year != null ? scaledAge(period.end_year) : yScale(maxAge);
                const stripX = barX + barWidth + 2 + stripIdx * (stripWidth + 1);

                const catLabel = t(`dsm.${cls.dsm_category}`);
                const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
                const statusLabel = t(`classification.status.${cls.status}`);
                const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
                const clsLabel = subLabel ?? catLabel;

                return (
                  <React.Fragment key={`${cls.id}-p${pi}`}>
                    <rect
                      x={stripX}
                      y={startY}
                      width={stripWidth}
                      height={Math.max(0, endY - startY)}
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
                        x={cx}
                        y={startY - 2}
                        className="tl-marker-label"
                        textAnchor="middle"
                        transform={labelTransform(startY - 2)}
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
                  const diagY = scaledAge(cls.diagnosis_year!);
                  const triSize = MARKER_RADIUS * 0.85;
                  const triPath = `M${cx},${diagY - triSize} L${cx + triSize},${diagY + triSize} L${cx - triSize},${diagY + triSize} Z`;

                  const catLabel = t(`dsm.${cls.dsm_category}`);
                  const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
                  const isClsSelected = selectedEntityKeys?.has(`classification:${cls.id}`);

                  const triLabel = subLabel ?? catLabel;

                  return (
                    <g transform={markerTransform(diagY)}>
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
                          cx={cx}
                          cy={diagY}
                          r={MARKER_RADIUS + 3}
                          className="tl-selection-ring"
                        />
                      )}
                      {patternRings?.get(`classification:${cls.id}`)?.map((ring, ri) => (
                        <circle
                          key={ring.patternId}
                          cx={cx}
                          cy={diagY}
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
                          x={cx}
                          y={diagY - MARKER_RADIUS - 2}
                          className="tl-marker-label"
                          textAnchor="middle"
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

        const py = scaledAge(year);
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
            transform={markerTransform(py)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <circle
              cx={cx}
              cy={py}
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
                    { text: `${t("timeline.ageAxis")}: ${ageOf(year)}` },
                    { text: t("timeline.severity", { value: event.severity }) },
                    { text: linkedNames },
                  ],
                });
              }}
              onMouseLeave={hideTooltip}
            />
            {isEntitySelected && (
              <circle cx={cx} cy={py} r={MARKER_RADIUS + 3} className="tl-selection-ring" />
            )}
            {patternRings?.get(`trauma_event:${event.id}`)?.map((ring, ri) => (
              <circle
                key={ring.patternId}
                cx={cx}
                cy={py}
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
                x={cx}
                y={py - MARKER_RADIUS - 2}
                className="tl-marker-label"
                textAnchor="middle"
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

        const py = scaledAge(year);
        const diamondSize = MARKER_RADIUS * 0.9;
        const linkedNames = le.person_ids
          .map((pid) => persons.get(pid)?.name)
          .filter(Boolean)
          .join(", ");

        const lines: TooltipLine[] = [
          { text: le.title, bold: true },
          { text: t(`lifeEvent.category.${le.category}`) },
          { text: `${t("timeline.ageAxis")}: ${ageOf(year)}` },
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
            transform={markerTransform(py)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <rect
              x={cx - diamondSize}
              y={py - diamondSize}
              width={diamondSize * 2}
              height={diamondSize * 2}
              transform={`rotate(45, ${cx}, ${py})`}
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
              <circle cx={cx} cy={py} r={MARKER_RADIUS + 3} className="tl-selection-ring" />
            )}
            {patternRings?.get(`life_event:${le.id}`)?.map((ring, ri) => (
              <circle
                key={ring.patternId}
                cx={cx}
                cy={py}
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
                x={cx}
                y={py - MARKER_RADIUS - 2}
                className="tl-marker-label"
                textAnchor="middle"
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
