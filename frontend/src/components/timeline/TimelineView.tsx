import * as d3 from "d3";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { RelationshipType } from "../../types/domain";
import { BranchDecoration } from "../BranchDecoration";
import { PartnerLine } from "./PartnerLine";
import { PersonLane } from "./PersonLane";
import { INITIAL_TOOLTIP, TimelineTooltip, type TooltipState } from "./TimelineTooltip";
import {
  buildPersonDataMaps,
  buildRowLayout,
  computeTimeDomain,
  filterTimelinePersons,
  GEN_HEADER_HEIGHT,
  LABEL_WIDTH,
  ROW_HEIGHT,
} from "./timelineHelpers";
import "./TimelineView.css";

interface TimelineViewProps {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
}

export function TimelineView({
  persons,
  relationships,
  events,
  lifeEvents,
  classifications,
}: TimelineViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomGroupRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);

  // ResizeObserver for container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;

  // Compute layout
  const timelinePersons = useMemo(
    () => filterTimelinePersons(persons, relationships),
    [persons, relationships],
  );

  const { rows, sortedGens, personsByGen, totalHeight } = useMemo(
    () => buildRowLayout(timelinePersons, relationships, height),
    [timelinePersons, relationships, height],
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

  // CSS var reader
  const cssVar = useCallback((name: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, []);

  const traumaColors = useMemo(() => getTraumaColors(), []);
  const lifeEventColors = useMemo(() => getLifeEventColors(), []);

  // Zoom
  const { rescaledX } = useTimelineZoom({
    svgRef,
    zoomGroupRef,
    xScale,
    labelWidth: LABEL_WIDTH,
    width,
    height: totalHeight,
  });

  // Axis ticks from rescaled x
  const axisTicks = useMemo(() => {
    if (width <= LABEL_WIDTH) return [];
    const tickCount = Math.max(2, Math.floor((width - LABEL_WIDTH) / 80));
    return rescaledX.ticks(tickCount).map((tick) => ({
      value: tick,
      x: rescaledX(tick),
    }));
  }, [rescaledX, width]);

  // Build partner line data
  const partnerLines = useMemo(() => {
    const rowByPersonId = new Map(rows.map((r) => [r.person.id, r]));
    const result: Array<{
      key: string;
      sourceName: string;
      targetName: string;
      sourceY: number;
      targetY: number;
      periods: DecryptedRelationship["periods"];
    }> = [];

    for (const rel of relationships.values()) {
      if (rel.type !== RelationshipType.Partner) continue;
      const row1 = rowByPersonId.get(rel.source_person_id);
      const row2 = rowByPersonId.get(rel.target_person_id);
      if (!row1 || !row2) continue;

      result.push({
        key: rel.id,
        sourceName: persons.get(rel.source_person_id)?.name ?? "?",
        targetName: persons.get(rel.target_person_id)?.name ?? "?",
        sourceY: row1.y,
        targetY: row2.y,
        periods: rel.periods,
      });
    }

    return result;
  }, [rows, relationships, persons]);

  // Generation bands
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
    return bands;
  }, [sortedGens, personsByGen]);

  const onTooltip = useCallback((state: TooltipState) => {
    setTooltip(state);
  }, []);

  if (persons.size === 0) {
    return (
      <div className="timeline-container bg-gradient" ref={containerRef}>
        <BranchDecoration />
        <div className="timeline-empty">{t("timeline.noData")}</div>
      </div>
    );
  }

  return (
    <div className="timeline-container bg-gradient" ref={containerRef}>
      <BranchDecoration />
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
          {rows.map((row) => (
            <text
              key={row.person.id}
              x={24}
              y={row.y + ROW_HEIGHT / 2 + 4}
              className="tl-person-label"
            >
              {row.person.name}
            </text>
          ))}
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

        {/* Clipped time content */}
        <g clipPath="url(#timeline-clip)">
          <g ref={zoomGroupRef} className="tl-time">
            {rows.map((row) => (
              <PersonLane
                key={row.person.id}
                person={row.person}
                y={row.y}
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
              />
            ))}
            {partnerLines.map((pl) => (
              <PartnerLine
                key={pl.key}
                sourceName={pl.sourceName}
                targetName={pl.targetName}
                sourceY={pl.sourceY}
                targetY={pl.targetY}
                periods={pl.periods}
                currentYear={currentYear}
                cssVar={cssVar}
                t={t}
                onTooltip={onTooltip}
              />
            ))}
          </g>
        </g>
      </svg>
      <TimelineTooltip state={tooltip} />
    </div>
  );
}
