import * as d3 from "d3";
import React, { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import { useTimelineZoom } from "../../hooks/useTimelineZoom";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { getLifeEventColors } from "../../lib/lifeEventColors";
import { getTraumaColors } from "../../lib/traumaColors";
import { capPeriodsAtDeath, type PartnerStatus, RelationshipType } from "../../types/domain";
import { AgePartnerLine } from "./AgePartnerLine";
import { AgePersonLane } from "./AgePersonLane";
import type { MarkerClickInfo, TimelineMode } from "./PersonLane";
import { computePatternRings, TimelinePatternLanes } from "./TimelinePatternLanes";
import type { TooltipState } from "./TimelineTooltip";
import { TimelineZoomControls } from "./TimelineZoomControls";
import {
  AGE_LABEL_WIDTH,
  buildColumnLayout,
  buildPersonDataMaps,
  COL_HEADER_HEIGHT,
  computeAgeDomain,
  computeGenerations,
  filterTimelinePersons,
} from "./timelineHelpers";

interface TimelineAgeContentProps {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  width: number;
  height: number;
  mode: TimelineMode;
  selectedPersonId: string | null;
  dims?: DimSets;
  filterMode?: FilterMode;
  onSelectPerson?: (personId: string | null) => void;
  onClickMarker?: (info: MarkerClickInfo) => void;
  onClickPartnerLine?: (relationshipId: string) => void;
  onTooltip: (state: TooltipState) => void;
  patterns?: Map<string, DecryptedPattern>;
  visiblePatternIds?: Set<string>;
  selectedEntityKeys?: Set<string>;
  hoveredPatternId?: string | null;
  onToggleEntitySelect?: (key: string) => void;
  onPatternHover?: (patternId: string | null) => void;
  onPatternClick?: (patternId: string) => void;
  showPartnerLines?: boolean;
  showPartnerLabels?: boolean;
  showClassifications?: boolean;
  showGridlines?: boolean;
  showMarkerLabels?: boolean;
  scrollMode?: boolean;
  onToggleScrollMode?: () => void;
}

export function TimelineAgeContent({
  persons,
  relationships,
  events,
  lifeEvents,
  classifications,
  width,
  height,
  mode,
  selectedPersonId,
  dims,
  filterMode = "dim",
  onSelectPerson,
  onClickMarker,
  onClickPartnerLine,
  onTooltip,
  patterns,
  visiblePatternIds,
  selectedEntityKeys,
  hoveredPatternId,
  onToggleEntitySelect,
  onPatternHover,
  onPatternClick,
  showPartnerLines = true,
  showPartnerLabels = true,
  showClassifications = true,
  showGridlines = false,
  showMarkerLabels = true,
  scrollMode,
  onToggleScrollMode,
}: TimelineAgeContentProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomGroupRef = useRef<SVGGElement>(null);
  const { t } = useTranslation();

  const timelinePersons = useMemo(
    () => filterTimelinePersons(persons, relationships),
    [persons, relationships],
  );

  const effectivePersons = useMemo(() => {
    if (filterMode !== "hide" || !dims || dims.dimmedPersonIds.size === 0) return timelinePersons;
    const filtered = new Map<string, DecryptedPerson>();
    for (const [id, person] of timelinePersons) {
      if (!dims.dimmedPersonIds.has(id)) filtered.set(id, person);
    }
    return filtered;
  }, [timelinePersons, filterMode, dims]);

  const generations = useMemo(
    () => computeGenerations(timelinePersons, relationships),
    [timelinePersons, relationships],
  );

  const { columns, sortedGens, genStarts, genWidths, totalWidth } = useMemo(
    () => buildColumnLayout(effectivePersons, relationships, width, generations),
    [effectivePersons, relationships, width, generations],
  );

  const { minAge, maxAge } = useMemo(() => computeAgeDomain(timelinePersons), [timelinePersons]);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const ageScale = useMemo(
    () => d3.scaleLinear().domain([minAge, maxAge]).range([COL_HEADER_HEIGHT, height]),
    [minAge, maxAge, height],
  );

  const personDataMaps = useMemo(
    () => buildPersonDataMaps(events, lifeEvents, classifications),
    [events, lifeEvents, classifications],
  );

  const cssVar = useCallback((name: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, []);

  const traumaColors = useMemo(() => getTraumaColors(), []);
  const lifeEventColors = useMemo(() => getLifeEventColors(), []);

  const patternRings = useMemo(
    () =>
      patterns && visiblePatternIds ? computePatternRings(patterns, visiblePatternIds) : undefined,
    [patterns, visiblePatternIds],
  );

  const partnerLines = useMemo(() => {
    const colByPersonId = new Map(columns.map((c) => [c.person.id, c]));
    const result: Array<{
      key: string;
      sourceName: string;
      targetName: string;
      sourceX: number | null;
      targetX: number | null;
      sourceLaneWidth: number;
      targetLaneWidth: number;
      periods: Array<{ start_year: number; end_year: number | null; status: PartnerStatus }>;
      birthYears: { source: number; target: number };
    }> = [];

    for (const rel of relationships.values()) {
      if (rel.type !== RelationshipType.Partner) continue;
      const col1 = colByPersonId.get(rel.source_person_id);
      const col2 = colByPersonId.get(rel.target_person_id);
      if (!col1 && !col2) continue;

      const sourcePerson = persons.get(rel.source_person_id);
      const targetPerson = persons.get(rel.target_person_id);
      if (sourcePerson?.birth_year == null || targetPerson?.birth_year == null) continue;

      result.push({
        key: rel.id,
        sourceName: sourcePerson.name ?? "?",
        targetName: targetPerson.name ?? "?",
        sourceX: col1?.x ?? null,
        targetX: col2?.x ?? null,
        sourceLaneWidth: col1?.laneWidth ?? 0,
        targetLaneWidth: col2?.laneWidth ?? 0,
        periods: capPeriodsAtDeath(rel.periods, {
          source: sourcePerson.death_year,
          target: targetPerson.death_year,
        }),
        birthYears: { source: sourcePerson.birth_year, target: targetPerson.birth_year },
      });
    }

    return result;
  }, [columns, relationships, persons]);

  const {
    rescaled: rescaledAge,
    zoomK,
    zoomActions,
  } = useTimelineZoom({
    svgRef,
    zoomGroupRef,
    scale: ageScale,
    direction: "vertical",
    fixedOffset: COL_HEADER_HEIGHT,
    width: totalWidth,
    height,
    scrollMode,
  });

  // Age axis ticks
  const ageTicks = useMemo(() => {
    if (height <= COL_HEADER_HEIGHT) return [];
    const tickCount = Math.max(2, Math.floor((height - COL_HEADER_HEIGHT) / 40));
    return rescaledAge.ticks(tickCount).map((tick) => ({
      value: tick,
      y: rescaledAge(tick),
    }));
  }, [rescaledAge, height]);

  // Generation bands
  const genBands = useMemo(() => {
    const bands: Array<{
      gen: number;
      x: number;
      width: number;
      isEven: boolean;
    }> = [];
    for (let i = 0; i < sortedGens.length; i++) {
      const gen = sortedGens[i];
      const genX = genStarts.get(gen)!;
      const genW = genWidths.get(gen)!;
      bands.push({ gen, x: genX, width: genW, isEven: i % 2 === 0 });
    }
    return bands;
  }, [sortedGens, genStarts, genWidths]);

  const handleBackgroundClick = useCallback(() => {
    onSelectPerson?.(null);
  }, [onSelectPerson]);

  const handleSelectPerson = useCallback(
    (personId: string) => {
      onSelectPerson?.(personId === selectedPersonId ? null : personId);
    },
    [onSelectPerson, selectedPersonId],
  );

  return (
    <>
      <svg ref={svgRef} width={totalWidth} height={height}>
        <defs>
          <clipPath id="timeline-clip-age">
            <rect
              x={AGE_LABEL_WIDTH}
              y={COL_HEADER_HEIGHT}
              width={totalWidth - AGE_LABEL_WIDTH}
              height={Math.max(0, height - COL_HEADER_HEIGHT)}
            />
          </clipPath>
        </defs>

        {/* Background: column bands + headers */}
        <g className="tl-bg">
          {genBands.map((band) => (
            <React.Fragment key={band.gen}>
              <rect
                x={band.x}
                y={0}
                width={band.width}
                height={height}
                fill={cssVar(band.isEven ? "--color-band-even" : "--color-band-odd")}
              />
              <text x={band.x + band.width / 2} y={16} className="tl-col-header">
                {t("timeline.generation", { number: band.gen + 1 })}
              </text>
            </React.Fragment>
          ))}

          {/* Pattern lane tints */}
          {patterns && visiblePatternIds && onPatternHover && onPatternClick && (
            <TimelinePatternLanes
              patterns={patterns}
              visiblePatternIds={visiblePatternIds}
              hoveredPatternId={hoveredPatternId ?? null}
              onPatternHover={onPatternHover}
              onPatternClick={onPatternClick}
              direction="vertical"
              columns={columns}
              height={height}
            />
          )}

          {/* Person name labels in column headers */}
          {columns.map((col) => {
            const isSelected = selectedPersonId === col.person.id;
            const isDimmed =
              dims?.dimmedPersonIds.has(col.person.id) || (selectedPersonId != null && !isSelected);
            const labelClassName = [
              "tl-col-person-name",
              isSelected && "tl-person-label--selected",
              isDimmed && "tl-person-label--dimmed",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <text
                key={col.person.id}
                x={col.x + col.laneWidth / 2}
                y={36}
                className={labelClassName}
                style={{ cursor: "pointer" }}
                onClick={() => handleSelectPerson(col.person.id)}
                onMouseEnter={(e) =>
                  onTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    lines: [{ text: col.person.name, bold: true }],
                  })
                }
                onMouseLeave={() => onTooltip({ visible: false, x: 0, y: 0, lines: [] })}
              >
                {(() => {
                  const CHAR_W = 7;
                  const maxChars = Math.max(3, Math.floor(col.laneWidth / CHAR_W));
                  return col.person.name.length > maxChars
                    ? `${col.person.name.slice(0, maxChars - 2)}..`
                    : col.person.name;
                })()}
              </text>
            );
          })}

          {/* Age axis labels (left) */}
          {ageTicks.map((tick) => (
            <text
              key={tick.value}
              x={AGE_LABEL_WIDTH - 4}
              y={tick.y + 4}
              className="tl-age-axis-text"
            >
              {tick.value}
            </text>
          ))}

          {/* Horizontal grid lines at age ticks */}
          {showGridlines &&
            ageTicks.map((tick) => (
              <line
                key={`grid-${tick.value}`}
                x1={AGE_LABEL_WIDTH}
                x2={totalWidth}
                y1={tick.y}
                y2={tick.y}
                stroke={cssVar("--color-text-muted")}
                strokeOpacity={0.25}
              />
            ))}
        </g>

        {/* Transparent background rect for deselect on click */}
        <rect
          x={AGE_LABEL_WIDTH}
          y={COL_HEADER_HEIGHT}
          width={Math.max(0, totalWidth - AGE_LABEL_WIDTH)}
          height={Math.max(0, height - COL_HEADER_HEIGHT)}
          fill="transparent"
          onClick={handleBackgroundClick}
        />

        {/* Clipped age content */}
        <g clipPath="url(#timeline-clip-age)">
          <g ref={zoomGroupRef} className="tl-time">
            {columns.map((col) => {
              const isSelected = selectedPersonId === col.person.id;
              const isDimmed =
                dims?.dimmedPersonIds.has(col.person.id) ||
                (selectedPersonId != null && !isSelected);

              return (
                <AgePersonLane
                  key={col.person.id}
                  person={col.person}
                  x={col.x}
                  laneWidth={col.laneWidth}
                  yScale={ageScale}
                  zoomK={zoomK}
                  currentYear={currentYear}
                  events={personDataMaps.eventsByPerson.get(col.person.id) ?? []}
                  lifeEvents={personDataMaps.lifeEventsByPerson.get(col.person.id) ?? []}
                  classifications={personDataMaps.classificationsByPerson.get(col.person.id) ?? []}
                  persons={persons}
                  traumaColors={traumaColors}
                  lifeEventColors={lifeEventColors}
                  cssVar={cssVar}
                  t={t}
                  onTooltip={onTooltip}
                  selected={isSelected}
                  dimmed={isDimmed}
                  mode={mode}
                  dims={dims}
                  filterMode={filterMode}
                  onSelectPerson={handleSelectPerson}
                  onClickMarker={onClickMarker}
                  showClassifications={showClassifications}
                  showMarkerLabels={showMarkerLabels}
                  selectedEntityKeys={selectedEntityKeys}
                  onToggleEntitySelect={onToggleEntitySelect}
                  patternRings={patternRings}
                />
              );
            })}
            {showPartnerLines &&
              partnerLines.map((pl) => (
                <AgePartnerLine
                  key={pl.key}
                  sourceName={pl.sourceName}
                  targetName={pl.targetName}
                  sourceX={pl.sourceX}
                  targetX={pl.targetX}
                  sourceLaneWidth={pl.sourceLaneWidth}
                  targetLaneWidth={pl.targetLaneWidth}
                  periods={pl.periods}
                  ageScale={ageScale}
                  birthYears={pl.birthYears}
                  currentYear={currentYear}
                  cssVar={cssVar}
                  t={t}
                  onTooltip={onTooltip}
                  onClick={onClickPartnerLine ? () => onClickPartnerLine(pl.key) : undefined}
                  showLabels={showPartnerLabels}
                  zoomK={zoomK}
                />
              ))}
          </g>
        </g>
      </svg>
      <TimelineZoomControls
        actions={zoomActions}
        scrollMode={scrollMode}
        onToggleScrollMode={onToggleScrollMode}
      />
    </>
  );
}
