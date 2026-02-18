import React, { useCallback } from "react";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
} from "../../hooks/useTreeData";
import type { LifeEventCategory, TraumaCategory } from "../../types/domain";
import type { TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT, MARKER_RADIUS, ROW_HEIGHT } from "./timelineHelpers";

export type TimelineMode = "explore" | "edit" | "annotate";

export interface MarkerClickInfo {
  personId: string;
  entityType: "trauma_event" | "life_event" | "classification";
  entityId: string;
}

interface PersonLaneProps {
  person: DecryptedPerson;
  y: number;
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
  selectedEntityKeys?: Set<string>;
  onToggleEntitySelect?: (key: string) => void;
}

export const PersonLane = React.memo(function PersonLane({
  person,
  y,
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
  selectedEntityKeys,
  onToggleEntitySelect,
}: PersonLaneProps) {
  const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
  const cy = y + ROW_HEIGHT / 2;
  const hasBirth = person.birth_year != null;
  const birthX = person.birth_year ?? 0;
  const deathX = person.death_year ?? currentYear;
  const canvasStroke = cssVar("--color-bg-canvas");

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
      {hasBirth &&
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
                const px1 = period.start_year;
                const px2 = period.end_year ?? currentYear;
                const stripY = barY + BAR_HEIGHT + 2 + stripIdx * (stripHeight + 1);

                const catLabel = t(`dsm.${cls.dsm_category}`);
                const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
                const statusLabel = t(`classification.status.${cls.status}`);
                const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;

                return (
                  <rect
                    key={`${cls.id}-p${pi}`}
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
                );
              })}

              {/* Diagnosis triangle */}
              {cls.status === "diagnosed" &&
                cls.diagnosis_year != null &&
                (() => {
                  const dx = cls.diagnosis_year!;
                  const triSize = MARKER_RADIUS * 0.85;
                  const triPath = `M${dx},${cy - triSize} L${dx + triSize},${cy + triSize} L${dx - triSize},${cy + triSize} Z`;

                  const catLabel = t(`dsm.${cls.dsm_category}`);
                  const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
                  const isClsSelected = selectedEntityKeys?.has(`classification:${cls.id}`);

                  return (
                    <>
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
                    </>
                  );
                })()}
            </g>
          );
        })}

      {/* Trauma markers (circles) */}
      {events.map((event) => {
        const year = Number.parseInt(event.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const linkedNames = event.person_ids
          .map((pid) => persons.get(pid)?.name)
          .filter(Boolean)
          .join(", ");

        const isMarkerDimmed = dims?.dimmedEventIds.has(event.id);
        if (isMarkerDimmed && filterMode === "hide") return null;

        const isEntitySelected = selectedEntityKeys?.has(`trauma_event:${event.id}`);

        return (
          <React.Fragment key={event.id}>
            <circle
              cx={year}
              cy={cy}
              r={MARKER_RADIUS}
              fill={traumaColors[event.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              opacity={isMarkerDimmed ? 0.15 : undefined}
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
              <circle cx={year} cy={cy} r={MARKER_RADIUS + 3} className="tl-selection-ring" />
            )}
          </React.Fragment>
        );
      })}

      {/* Life event markers (diamonds) */}
      {lifeEvents.map((le) => {
        const year = Number.parseInt(le.approximate_date, 10);
        if (Number.isNaN(year)) return null;

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
          <React.Fragment key={le.id}>
            <rect
              x={year - diamondSize}
              y={cy - diamondSize}
              width={diamondSize * 2}
              height={diamondSize * 2}
              transform={`rotate(45, ${year}, ${cy})`}
              fill={lifeEventColors[le.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              opacity={isMarkerDimmed ? 0.15 : undefined}
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
              <circle cx={year} cy={cy} r={MARKER_RADIUS + 3} className="tl-selection-ring" />
            )}
          </React.Fragment>
        );
      })}
    </g>
  );
});
