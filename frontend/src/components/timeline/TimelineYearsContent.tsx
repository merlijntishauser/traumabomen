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
import { RelationshipType } from "../../types/domain";
import { PartnerLine } from "./PartnerLine";
import { type MarkerClickInfo, PersonLane, type TimelineMode } from "./PersonLane";
import { TimelinePatternArcs } from "./TimelinePatternArcs";
import type { TooltipState } from "./TimelineTooltip";
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

interface TimelineYearsContentProps {
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
  onTooltip: (state: TooltipState) => void;
  patterns?: Map<string, DecryptedPattern>;
  visiblePatternIds?: Set<string>;
  selectedEntityKeys?: Set<string>;
  hoveredPatternId?: string | null;
  onToggleEntitySelect?: (key: string) => void;
  onPatternHover?: (patternId: string | null) => void;
  onPatternClick?: (patternId: string) => void;
  showPartnerLines?: boolean;
  showClassifications?: boolean;
  showGridlines?: boolean;
}

export function TimelineYearsContent({
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
  onTooltip,
  patterns,
  visiblePatternIds,
  selectedEntityKeys,
  hoveredPatternId,
  onToggleEntitySelect,
  onPatternHover,
  onPatternClick,
  showPartnerLines = true,
  showClassifications = true,
  showGridlines = false,
}: TimelineYearsContentProps) {
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
    () => computeTimeDomain(timelinePersons, events, lifeEvents),
    [timelinePersons, events, lifeEvents],
  );

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const xScale = useMemo(
    () => d3.scaleLinear().domain([minYear, maxYear]).range([LABEL_WIDTH, width]),
    [minYear, maxYear, width],
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

  const { rescaled: rescaledX, zoomK } = useTimelineZoom({
    svgRef,
    zoomGroupRef,
    scale: xScale,
    fixedOffset: LABEL_WIDTH,
    width,
    height: totalHeight,
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
    const rowByPersonId = new Map(rows.map((r) => [r.person.id, r]));
    const result: Array<{
      key: string;
      sourceName: string;
      targetName: string;
      sourceY: number | null;
      targetY: number | null;
      periods: DecryptedRelationship["periods"];
    }> = [];

    for (const rel of relationships.values()) {
      if (rel.type !== RelationshipType.Partner) continue;
      const row1 = rowByPersonId.get(rel.source_person_id);
      const row2 = rowByPersonId.get(rel.target_person_id);
      if (!row1 && !row2) continue;

      result.push({
        key: rel.id,
        sourceName: persons.get(rel.source_person_id)?.name ?? "?",
        targetName: persons.get(rel.target_person_id)?.name ?? "?",
        sourceY: row1?.y ?? null,
        targetY: row2?.y ?? null,
        periods: rel.periods,
      });
    }

    return result;
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
      onSelectPerson?.(personId);
    },
    [onSelectPerson],
  );

  return (
    <svg ref={svgRef} width={width} height={totalHeight}>
      <defs>
        <clipPath id="timeline-clip">
          <rect x={LABEL_WIDTH} y={0} width={width - LABEL_WIDTH} height={totalHeight} />
        </clipPath>
      </defs>

      {/* Background: generation bands + labels */}
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
            <text x={20} y={band.y + GEN_HEADER_HEIGHT - 5} className="tl-gen-label">
              {t("timeline.generation", { number: band.gen + 1 })}
            </text>
          </React.Fragment>
        ))}

        {/* Person name labels */}
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
              onClick={() => handleSelectPerson(row.person.id)}
            >
              {row.person.name}
            </text>
          );
        })}
      </g>

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

      {/* Vertical gridlines at year ticks */}
      {showGridlines &&
        axisTicks.map((tick) => (
          <line
            key={`grid-${tick.value}`}
            x1={tick.x}
            x2={tick.x}
            y1={0}
            y2={totalHeight}
            stroke={cssVar("--color-text-muted")}
            strokeOpacity={0.25}
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
          {patterns && visiblePatternIds && onPatternHover && onPatternClick && (
            <TimelinePatternArcs
              patterns={patterns}
              visiblePatternIds={visiblePatternIds}
              events={events}
              lifeEvents={lifeEvents}
              classifications={classifications}
              persons={persons}
              direction="horizontal"
              coordScale={xScale}
              rows={rows}
              totalHeight={totalHeight}
              hoveredPatternId={hoveredPatternId ?? null}
              onPatternHover={onPatternHover}
              onPatternClick={onPatternClick}
            />
          )}
          {rows.map((row) => {
            const isSelected = selectedPersonId === row.person.id;
            const isDimmed =
              dims?.dimmedPersonIds.has(row.person.id) || (selectedPersonId != null && !isSelected);

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
                classifications={personDataMaps.classificationsByPerson.get(row.person.id) ?? []}
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
                selectedEntityKeys={selectedEntityKeys}
                onToggleEntitySelect={onToggleEntitySelect}
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
              />
            ))}
        </g>
      </g>
    </svg>
  );
}
