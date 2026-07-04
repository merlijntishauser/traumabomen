import * as d3 from "d3";
import React, { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type { TimelineSettings } from "../../hooks/useTimelineSettings";
import { useTimelineZoom } from "../../hooks/useTimelineZoom";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { getLifeEventColors } from "../../lib/lifeEventColors";
import { getTraumaColors } from "../../lib/traumaColors";
import { getTurningPointColors } from "../../lib/turningPointColors";
import { capPeriodsAtDeath, RelationshipType } from "../../types/domain";
import { PartnerLine } from "./PartnerLine";
import { PersonLane } from "./PersonLane";
import { TimelinePatternLanes } from "./TimelinePatternLanes";
import type { TooltipState } from "./TimelineTooltip";
import { TimelineZoomControls } from "./TimelineZoomControls";
import type { MarkerClickInfo, TimelineMode } from "./timelineHelpers";
import {
  buildPersonDataMaps,
  buildRowLayout,
  computeGenerations,
  computeTimeDomain,
  filterTimelinePersons,
  GEN_HEADER_HEIGHT,
  LABEL_WIDTH,
  ROW_HEIGHT,
} from "./timelineHelpers";
import { computePatternRings } from "./timelinePatternLanes.helpers";

interface YearsPartnerLineData {
  key: string;
  sourceName: string;
  targetName: string;
  sourceY: number | null;
  targetY: number | null;
  periods: DecryptedRelationship["periods"];
}

function computeYearsPartnerLines(
  rows: Array<{ person: DecryptedPerson; y: number }>,
  relationships: Map<string, DecryptedRelationship>,
  persons: Map<string, DecryptedPerson>,
): YearsPartnerLineData[] {
  const rowByPersonId = new Map(rows.map((r) => [r.person.id, r]));
  const result: YearsPartnerLineData[] = [];

  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.Partner) continue;
    const row1 = rowByPersonId.get(rel.source_person_id);
    const row2 = rowByPersonId.get(rel.target_person_id);
    if (!row1 && !row2) continue;

    const sourcePerson = persons.get(rel.source_person_id);
    const targetPerson = persons.get(rel.target_person_id);

    result.push({
      key: rel.id,
      sourceName: sourcePerson?.name ?? "?",
      targetName: targetPerson?.name ?? "?",
      sourceY: row1?.y ?? null,
      targetY: row2?.y ?? null,
      periods: capPeriodsAtDeath(rel.periods, {
        source: sourcePerson?.death_year,
        target: targetPerson?.death_year,
      }),
    });
  }

  return result;
}

interface TimelineYearsContentProps {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints?: Map<string, DecryptedTurningPoint>;
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
  display: TimelineSettings;
  scrollMode?: boolean;
  onToggleScrollMode?: () => void;
}

/* -- Sub-components -------------------------------------------------------- */

interface YearsBackgroundProps {
  genBands: Array<{ gen: number; y: number; height: number; isEven: boolean }>;
  rows: ReturnType<typeof buildRowLayout>["rows"];
  width: number;
  selectedPersonId: string | null;
  dims?: DimSets;
  cssVar: (name: string) => string;
  onSelectPerson: (personId: string) => void;
  onTooltip: (state: TooltipState) => void;
  patterns?: Map<string, DecryptedPattern>;
  visiblePatternIds?: Set<string>;
  hoveredPatternId?: string | null;
  onPatternHover?: (patternId: string | null) => void;
  onPatternClick?: (patternId: string) => void;
}

function YearsBackground({
  genBands,
  rows,
  width,
  selectedPersonId,
  dims,
  cssVar,
  onSelectPerson,
  onTooltip,
  patterns,
  visiblePatternIds,
  hoveredPatternId,
  onPatternHover,
  onPatternClick,
}: YearsBackgroundProps) {
  const { t } = useTranslation();
  return (
    <g className="tl-bg">
      {genBands.map((band) => (
        <React.Fragment key={band.gen}>
          <rect
            x={0}
            y={band.y}
            width={width}
            height={band.height}
            fill={cssVar(band.isEven ? "--color-band-even" : "--color-band-odd")}
          />
          {band.gen > 0 && (
            <rect x={0} y={band.y} width={width} height={1} fill="url(#tl-gen-fade)" />
          )}
          <text x={20} y={band.y + GEN_HEADER_HEIGHT - 5} className="tl-gen-label">
            {t("timeline.generation", { number: band.gen + 1 })}
          </text>
        </React.Fragment>
      ))}

      {patterns && visiblePatternIds && onPatternHover && onPatternClick && (
        <TimelinePatternLanes
          patterns={patterns}
          visiblePatternIds={visiblePatternIds}
          hoveredPatternId={hoveredPatternId ?? null}
          onPatternHover={onPatternHover}
          onPatternClick={onPatternClick}
          direction="horizontal"
          rows={rows}
          rowHeight={ROW_HEIGHT}
          labelX={24}
        />
      )}

      {rows.map((row) => {
        const isSelected = selectedPersonId === row.person.id;
        const isDimmed =
          dims?.dimmedPersonIds.has(row.person.id) || (selectedPersonId != null && !isSelected);
        const labelClassName = [
          "tl-person-label",
          isSelected && "tl-person-label--selected",
          isDimmed && "tl-person-label--dimmed",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <text
            key={row.person.id}
            x={24}
            y={row.y + ROW_HEIGHT / 2 + 4}
            className={labelClassName}
            style={{ cursor: "pointer" }}
            onClick={() => onSelectPerson(row.person.id)}
            onMouseEnter={(e) =>
              onTooltip({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                lines: [{ text: row.person.name, bold: true }],
              })
            }
            onMouseLeave={() => onTooltip({ visible: false, x: 0, y: 0, lines: [] })}
          >
            {row.person.name}
          </text>
        );
      })}
    </g>
  );
}

/* -- Main component -------------------------------------------------------- */

export function TimelineYearsContent({
  persons,
  relationships,
  events,
  lifeEvents,
  turningPoints,
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
  display,
  scrollMode,
  onToggleScrollMode,
}: TimelineYearsContentProps) {
  const {
    showPartnerLines,
    showPartnerLabels,
    showClassifications,
    showGridlines,
    showMarkerLabels,
  } = display;
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

  // Compute generations from the full person set so hidden persons
  // don't cause their visible partners to shift generations
  const generations = useMemo(
    () => computeGenerations(timelinePersons, relationships),
    [timelinePersons, relationships],
  );

  const { rows, sortedGens, personsByGen, totalHeight } = useMemo(
    () => buildRowLayout(effectivePersons, relationships, height, generations),
    [effectivePersons, relationships, height, generations],
  );

  const { minYear, maxYear } = useMemo(
    () => computeTimeDomain(timelinePersons, events, lifeEvents, turningPoints),
    [timelinePersons, events, lifeEvents, turningPoints],
  );

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const xScale = useMemo(
    () => d3.scaleLinear().domain([minYear, maxYear]).range([LABEL_WIDTH, width]),
    [minYear, maxYear, width],
  );

  const personDataMaps = useMemo(
    () => buildPersonDataMaps(events, lifeEvents, classifications, turningPoints),
    [events, lifeEvents, classifications, turningPoints],
  );

  const cssVar = useCallback((name: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, []);

  const traumaColors = useMemo(() => getTraumaColors(), []);
  const lifeEventColors = useMemo(() => getLifeEventColors(), []);
  const turningPointColors = useMemo(() => getTurningPointColors(), []);

  const patternRings = useMemo(
    () =>
      patterns && visiblePatternIds ? computePatternRings(patterns, visiblePatternIds) : undefined,
    [patterns, visiblePatternIds],
  );

  const {
    rescaled: rescaledX,
    zoomK,
    zoomActions,
  } = useTimelineZoom({
    svgRef,
    zoomGroupRef,
    scale: xScale,
    fixedOffset: LABEL_WIDTH,
    width,
    height: totalHeight,
    scrollMode,
  });

  const axisTicks = useMemo(() => {
    if (width <= LABEL_WIDTH) return [];
    const tickCount = Math.max(2, Math.floor((width - LABEL_WIDTH) / 80));
    return rescaledX.ticks(tickCount).map((tick) => ({
      value: tick,
      x: rescaledX(tick),
    }));
  }, [rescaledX, width]);

  const partnerLines = useMemo(() => {
    return computeYearsPartnerLines(rows, relationships, persons);
  }, [rows, relationships, persons]);

  const genBands = useMemo(() => {
    const bands: Array<{ gen: number; y: number; height: number; isEven: boolean }> = [];
    let bandY = 0;
    for (let i = 0; i < sortedGens.length; i++) {
      const gen = sortedGens[i];
      const genPersons = personsByGen.get(gen)!;
      const bandHeight = GEN_HEADER_HEIGHT + genPersons.length * ROW_HEIGHT;
      bands.push({ gen, y: bandY, height: bandHeight, isEven: i % 2 === 0 });
      bandY += bandHeight;
    }
    // Extend last band to fill remaining viewport height
    if (bands.length > 0 && bandY < totalHeight) {
      bands[bands.length - 1].height += totalHeight - bandY;
    }
    return bands;
  }, [sortedGens, personsByGen, totalHeight]);

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
      <svg ref={svgRef} width={width} height={totalHeight}>
        <defs>
          <clipPath id="timeline-clip">
            <rect x={LABEL_WIDTH} y={0} width={width - LABEL_WIDTH} height={totalHeight} />
          </clipPath>
          {/* Year gridlines fade out toward both ends, like light between trees */}
          <linearGradient id="tl-grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cssVar("--color-text-muted")} stopOpacity="0" />
            <stop offset="0.12" stopColor={cssVar("--color-text-muted")} stopOpacity="0.28" />
            <stop offset="0.75" stopColor={cssVar("--color-text-muted")} stopOpacity="0.14" />
            <stop offset="1" stopColor={cssVar("--color-text-muted")} stopOpacity="0" />
          </linearGradient>
          {/* Generation boundaries carry the accent signature, fading right */}
          <linearGradient id="tl-gen-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={cssVar("--color-accent")} stopOpacity="0.45" />
            <stop offset="0.55" stopColor={cssVar("--color-accent")} stopOpacity="0.12" />
            <stop offset="1" stopColor={cssVar("--color-accent")} stopOpacity="0" />
          </linearGradient>
        </defs>

        <YearsBackground
          genBands={genBands}
          rows={rows}
          width={width}
          selectedPersonId={selectedPersonId}
          dims={dims}
          cssVar={cssVar}
          onSelectPerson={handleSelectPerson}
          onTooltip={onTooltip}
          patterns={patterns}
          visiblePatternIds={visiblePatternIds}
          hoveredPatternId={hoveredPatternId}
          onPatternHover={onPatternHover}
          onPatternClick={onPatternClick}
        />

        {/* Axis */}
        <g className="tl-axis" transform={`translate(0, ${GEN_HEADER_HEIGHT - 2})`}>
          {axisTicks.map((tick) => (
            <g key={tick.value} transform={`translate(${tick.x}, 0)`}>
              <line y2={-6} stroke={cssVar("--color-border-secondary")} />
              <text y={-9} textAnchor="middle" className="tl-axis-text">
                {tick.value}
              </text>
            </g>
          ))}
        </g>

        {/* Vertical gridlines at year ticks, fading toward both ends */}
        {showGridlines &&
          axisTicks.map((tick) => (
            <rect
              key={`grid-${tick.value}`}
              x={tick.x - 0.5}
              width={1}
              y={0}
              height={totalHeight}
              fill="url(#tl-grid-fade)"
            />
          ))}

        {/* Transparent background rect for deselect on click */}
        <rect
          x={LABEL_WIDTH}
          y={0}
          width={Math.max(0, width - LABEL_WIDTH)}
          height={totalHeight}
          fill="transparent"
          onClick={handleBackgroundClick}
        />

        {/* Clipped time content */}
        <g clipPath="url(#timeline-clip)">
          <g ref={zoomGroupRef} className="tl-time">
            {rows.map((row) => {
              const isSelected = selectedPersonId === row.person.id;
              const isDimmed =
                dims?.dimmedPersonIds.has(row.person.id) ||
                (selectedPersonId != null && !isSelected);

              return (
                <PersonLane
                  key={row.person.id}
                  person={row.person}
                  y={row.y}
                  xScale={xScale}
                  zoomK={zoomK}
                  currentYear={currentYear}
                  events={personDataMaps.eventsByPerson.get(row.person.id) ?? []}
                  lifeEvents={personDataMaps.lifeEventsByPerson.get(row.person.id) ?? []}
                  turningPoints={personDataMaps.turningPointsByPerson.get(row.person.id) ?? []}
                  classifications={personDataMaps.classificationsByPerson.get(row.person.id) ?? []}
                  persons={persons}
                  traumaColors={traumaColors}
                  lifeEventColors={lifeEventColors}
                  turningPointColors={turningPointColors}
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
                <PartnerLine
                  key={pl.key}
                  sourceName={pl.sourceName}
                  targetName={pl.targetName}
                  sourceY={pl.sourceY}
                  targetY={pl.targetY}
                  periods={pl.periods}
                  xScale={xScale}
                  zoomK={zoomK}
                  currentYear={currentYear}
                  cssVar={cssVar}
                  t={t}
                  onTooltip={onTooltip}
                  onClick={onClickPartnerLine ? () => onClickPartnerLine(pl.key) : undefined}
                  showLabels={showPartnerLabels}
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
