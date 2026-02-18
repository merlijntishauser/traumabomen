import * as d3 from "d3";
import React, { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DimSets } from "../../hooks/useTimelineFilters";
import { useTimelineZoom } from "../../hooks/useTimelineZoom";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { getLifeEventColors } from "../../lib/lifeEventColors";
import { getTraumaColors } from "../../lib/traumaColors";
import { AgePersonLane } from "./AgePersonLane";
import type { MarkerClickInfo, TimelineMode } from "./PersonLane";
import type { TooltipState } from "./TimelineTooltip";
import {
  AGE_LABEL_WIDTH,
  buildColumnLayout,
  buildPersonDataMaps,
  COL_HEADER_HEIGHT,
  computeAgeDomain,
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
  onSelectPerson?: (personId: string | null) => void;
  onClickMarker?: (info: MarkerClickInfo) => void;
  onTooltip: (state: TooltipState) => void;
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
  onSelectPerson,
  onClickMarker,
  onTooltip,
}: TimelineAgeContentProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomGroupRef = useRef<SVGGElement>(null);
  const { t } = useTranslation();

  const timelinePersons = useMemo(
    () => filterTimelinePersons(persons, relationships),
    [persons, relationships],
  );

  const { columns, sortedGens, genStarts, genWidths, totalWidth } = useMemo(
    () => buildColumnLayout(timelinePersons, relationships, width),
    [timelinePersons, relationships, width],
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

  const { rescaled: rescaledAge } = useTimelineZoom({
    svgRef,
    zoomGroupRef,
    scale: ageScale,
    direction: "vertical",
    fixedOffset: COL_HEADER_HEIGHT,
    width: totalWidth,
    height,
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
      onSelectPerson?.(personId);
    },
    [onSelectPerson],
  );

  return (
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
            >
              {col.person.name.length > 5 ? `${col.person.name.slice(0, 4)}..` : col.person.name}
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
        {ageTicks.map((tick) => (
          <line
            key={`grid-${tick.value}`}
            x1={AGE_LABEL_WIDTH}
            x2={totalWidth}
            y1={tick.y}
            y2={tick.y}
            stroke={cssVar("--color-border-secondary")}
            strokeOpacity={0.3}
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
              dims?.dimmedPersonIds.has(col.person.id) || (selectedPersonId != null && !isSelected);

            return (
              <AgePersonLane
                key={col.person.id}
                person={col.person}
                x={col.x}
                laneWidth={col.laneWidth}
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
                onSelectPerson={handleSelectPerson}
                onClickMarker={onClickMarker}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
