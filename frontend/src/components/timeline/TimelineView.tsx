import * as d3 from "d3";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { getLifeEventColors } from "../../lib/lifeEventColors";
import { getTraumaColors } from "../../lib/traumaColors";
import { BranchDecoration } from "../BranchDecoration";
import {
  buildRowLayout,
  computeTimeDomain,
  filterTimelinePersons,
  GEN_HEADER_HEIGHT,
  LABEL_WIDTH,
  ROW_HEIGHT,
  renderClassificationStrips,
  renderLifeBars,
  renderLifeEventMarkers,
  renderPartnerLines,
  renderTraumaMarkers,
  type TimelineRenderContext,
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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const tRef = useRef(t);
  tRef.current = t;

  const render = useCallback(() => {
    const svg = svgRef.current;
    const tooltip = tooltipRef.current!;
    if (!svg || !tooltip || persons.size === 0) return;

    const container = svg.parentElement!;
    const width = container.clientWidth;
    const totalAvailableHeight = container.clientHeight;

    const timelinePersons = filterTimelinePersons(persons, relationships);

    const rootStyle = getComputedStyle(document.documentElement);
    const cssVar = (name: string) => rootStyle.getPropertyValue(name).trim();
    const traumaColors = getTraumaColors();
    const lifeEventColors = getLifeEventColors();

    const { rows, sortedGens, personsByGen, totalHeight } = buildRowLayout(
      timelinePersons,
      relationships,
      totalAvailableHeight,
    );

    const { minYear, maxYear } = computeTimeDomain(timelinePersons, events, lifeEvents);
    const currentYear = new Date().getFullYear();
    const xScale = d3.scaleLinear().domain([minYear, maxYear]).range([LABEL_WIDTH, width]);

    // Clear and set up SVG
    const svgSel = d3.select(svg);
    svgSel.selectAll("*").remove();
    svgSel.attr("width", width).attr("height", totalHeight);

    svgSel
      .append("defs")
      .append("clipPath")
      .attr("id", "timeline-clip")
      .append("rect")
      .attr("x", LABEL_WIDTH)
      .attr("y", 0)
      .attr("width", width - LABEL_WIDTH)
      .attr("height", totalHeight);

    const bgGroup = svgSel.append("g").attr("class", "tl-bg");

    // Generation bands
    let bandY = 0;
    for (let i = 0; i < sortedGens.length; i++) {
      const gen = sortedGens[i];
      const genPersons = personsByGen.get(gen)!;
      const bandHeight = GEN_HEADER_HEIGHT + genPersons.length * ROW_HEIGHT;

      bgGroup
        .append("rect")
        .attr("x", 0)
        .attr("y", bandY)
        .attr("width", width)
        .attr("height", bandHeight)
        .attr("fill", cssVar(i % 2 === 0 ? "--color-band-even" : "--color-band-odd"));

      bgGroup
        .append("text")
        .attr("x", 20)
        .attr("y", bandY + GEN_HEADER_HEIGHT - 5)
        .attr("class", "tl-gen-label")
        .text(tRef.current("timeline.generation", { number: gen + 1 }));

      bandY += bandHeight;
    }

    // Person name labels
    for (const row of rows) {
      bgGroup
        .append("text")
        .attr("x", 24)
        .attr("y", row.y + ROW_HEIGHT / 2 + 4)
        .attr("class", "tl-person-label")
        .text(row.person.name);
    }

    const contentGroup = svgSel.append("g").attr("clip-path", "url(#timeline-clip)");
    const timeGroup = contentGroup.append("g").attr("class", "tl-time");

    const axisGroup = svgSel
      .append("g")
      .attr("class", "tl-axis")
      .attr("transform", `translate(0, ${GEN_HEADER_HEIGHT - 2})`);

    function renderAxis(scale: d3.ScaleLinear<number, number>) {
      const axis = d3
        .axisTop(scale)
        .tickFormat((d) => String(d))
        .ticks(Math.max(2, Math.floor((width - LABEL_WIDTH) / 80)));
      axisGroup.call(axis);
      axisGroup.selectAll(".tick text").attr("class", "tl-axis-text");
      axisGroup.selectAll(".tick line").attr("stroke", cssVar("--color-border-secondary"));
      axisGroup.select(".domain").remove();
    }

    function renderTimeContent(scale: d3.ScaleLinear<number, number>) {
      timeGroup.selectAll("*").remove();

      const ctx: TimelineRenderContext = {
        timeGroup,
        scale,
        rows,
        tooltip,
        cssVar,
        tRef,
        currentYear,
      };

      renderLifeBars(ctx);
      renderPartnerLines(ctx, relationships, persons);
      renderTraumaMarkers(ctx, events, persons, traumaColors);
      renderLifeEventMarkers(ctx, lifeEvents, persons, lifeEventColors);
      renderClassificationStrips(ctx, classifications);
    }

    renderAxis(xScale);
    renderTimeContent(xScale);

    // Zoom (horizontal only)
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .translateExtent([
        [LABEL_WIDTH, 0],
        [width, totalHeight],
      ])
      .extent([
        [LABEL_WIDTH, 0],
        [width, totalHeight],
      ])
      .on("zoom", (zoomEvent: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const newXScale = zoomEvent.transform.rescaleX(xScale);
        renderAxis(newXScale);
        renderTimeContent(newXScale);
      });

    svgSel.call(zoom);
  }, [persons, relationships, events, lifeEvents, classifications]);

  useEffect(() => {
    render();

    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  return (
    <div className="timeline-container bg-gradient">
      <BranchDecoration />
      {persons.size === 0 ? (
        <div className="timeline-empty">{t("timeline.noData")}</div>
      ) : (
        <>
          <svg ref={svgRef} />
          <div ref={tooltipRef} className="timeline-tooltip" />
        </>
      )}
    </div>
  );
}
