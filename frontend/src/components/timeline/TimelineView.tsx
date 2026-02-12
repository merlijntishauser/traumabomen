import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { useTranslation } from "react-i18next";
import { RelationshipType, PartnerStatus } from "../../types/domain";
import { getTraumaColors } from "../../lib/traumaColors";
import { getLifeEventColors } from "../../lib/lifeEventColors";
import type {
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedEvent,
  DecryptedLifeEvent,
} from "../../hooks/useTreeData";
import "./TimelineView.css";

interface TimelineViewProps {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
}

interface PersonRow {
  person: DecryptedPerson;
  generation: number;
  y: number;
}

const LABEL_WIDTH = 160;
const ROW_HEIGHT = 36;
const ROW_PADDING = 4;
const BAR_HEIGHT = 12;
const GEN_HEADER_HEIGHT = 20;
const MARKER_RADIUS = 7;

function computeGenerations(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, number> {
  const generations = new Map<string, number>();
  const childToParents = new Map<string, string[]>();

  for (const rel of relationships.values()) {
    if (
      rel.type === RelationshipType.BiologicalParent ||
      rel.type === RelationshipType.StepParent ||
      rel.type === RelationshipType.AdoptiveParent
    ) {
      // source is parent, target is child
      const parents = childToParents.get(rel.target_person_id) ?? [];
      parents.push(rel.source_person_id);
      childToParents.set(rel.target_person_id, parents);
    }
  }

  function getGeneration(personId: string, visited: Set<string>): number {
    if (generations.has(personId)) return generations.get(personId)!;
    if (visited.has(personId)) return 0; // cycle guard
    visited.add(personId);

    const parents = childToParents.get(personId);
    if (!parents || parents.length === 0) {
      generations.set(personId, 0);
      return 0;
    }

    const maxParentGen = Math.max(
      ...parents
        .filter((pid) => persons.has(pid))
        .map((pid) => getGeneration(pid, visited)),
    );
    const gen = maxParentGen + 1;
    generations.set(personId, gen);
    return gen;
  }

  for (const personId of persons.keys()) {
    getGeneration(personId, new Set());
  }

  return generations;
}

export function TimelineView({
  persons,
  relationships,
  events,
  lifeEvents,
}: TimelineViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const tRef = useRef(t);
  tRef.current = t;

  const render = useCallback(() => {
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!svg || !tooltip || persons.size === 0) return;

    const container = svg.parentElement!;
    const width = container.clientWidth;
    const totalAvailableHeight = container.clientHeight;

    // Read theme colors from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVar = (name: string) => rootStyle.getPropertyValue(name).trim();
    const traumaColors = getTraumaColors();
    const lifeEventColors = getLifeEventColors();

    // Compute generations and build row layout
    const generations = computeGenerations(persons, relationships);
    const personsByGen = new Map<number, DecryptedPerson[]>();
    for (const person of persons.values()) {
      const gen = generations.get(person.id) ?? 0;
      const list = personsByGen.get(gen) ?? [];
      list.push(person);
      personsByGen.set(gen, list);
    }

    const sortedGens = Array.from(personsByGen.keys()).sort((a, b) => a - b);

    // Sort persons within each generation by birth year
    for (const list of personsByGen.values()) {
      list.sort((a, b) => a.birth_year - b.birth_year);
    }

    // Compute row positions
    const rows: PersonRow[] = [];
    let currentY = 0;

    for (const gen of sortedGens) {
      currentY += GEN_HEADER_HEIGHT;
      const genPersons = personsByGen.get(gen)!;
      for (const person of genPersons) {
        rows.push({ person, generation: gen, y: currentY });
        currentY += ROW_HEIGHT;
      }
    }

    const totalHeight = Math.max(currentY + 20, totalAvailableHeight);

    // Compute time domain
    const currentYear = new Date().getFullYear();
    let minYear = currentYear;
    let maxYear = 0;
    for (const person of persons.values()) {
      minYear = Math.min(minYear, person.birth_year);
      maxYear = Math.max(maxYear, person.death_year ?? currentYear);
    }
    for (const event of events.values()) {
      const year = parseInt(event.approximate_date, 10);
      if (!isNaN(year)) {
        minYear = Math.min(minYear, year);
        maxYear = Math.max(maxYear, year);
      }
    }
    for (const le of lifeEvents.values()) {
      const year = parseInt(le.approximate_date, 10);
      if (!isNaN(year)) {
        minYear = Math.min(minYear, year);
        maxYear = Math.max(maxYear, year);
      }
    }
    minYear -= 5;
    maxYear += 5;

    const xScale = d3
      .scaleLinear()
      .domain([minYear, maxYear])
      .range([LABEL_WIDTH, width]);

    // Clear and set up SVG
    const svgSel = d3.select(svg);
    svgSel.selectAll("*").remove();
    svgSel.attr("width", width).attr("height", totalHeight);

    // Defs for clip path
    svgSel
      .append("defs")
      .append("clipPath")
      .attr("id", "timeline-clip")
      .append("rect")
      .attr("x", LABEL_WIDTH)
      .attr("y", 0)
      .attr("width", width - LABEL_WIDTH)
      .attr("height", totalHeight);

    // Background group (no clip -- includes labels)
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
        .attr("x", 12)
        .attr("y", bandY + GEN_HEADER_HEIGHT - 5)
        .attr("class", "tl-gen-label")
        .text(tRef.current("timeline.generation", { number: gen + 1 }));

      bandY += bandHeight;
    }

    // Person name labels
    for (const row of rows) {
      bgGroup
        .append("text")
        .attr("x", 16)
        .attr("y", row.y + ROW_HEIGHT / 2 + 4)
        .attr("class", "tl-person-label")
        .text(row.person.name);
    }

    // Clipped content group (time-dependent elements)
    const contentGroup = svgSel
      .append("g")
      .attr("clip-path", "url(#timeline-clip)");

    const timeGroup = contentGroup.append("g").attr("class", "tl-time");

    // Axis
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
      axisGroup
        .selectAll(".tick text")
        .attr("class", "tl-axis-text");
      axisGroup
        .selectAll(".tick line")
        .attr("stroke", cssVar("--color-border-secondary"));
      axisGroup.select(".domain").remove();
    }

    function renderTimeContent(scale: d3.ScaleLinear<number, number>) {
      timeGroup.selectAll("*").remove();

      // Life bars
      for (const row of rows) {
        const x1 = scale(row.person.birth_year);
        const x2 = scale(row.person.death_year ?? currentYear);
        const barY = row.y + (ROW_HEIGHT - BAR_HEIGHT) / 2;

        timeGroup
          .append("rect")
          .attr("x", x1)
          .attr("y", barY)
          .attr("width", Math.max(0, x2 - x1))
          .attr("height", BAR_HEIGHT)
          .attr("rx", 3)
          .attr("fill", cssVar("--color-lifebar-fill"))
          .attr("stroke", cssVar("--color-lifebar-stroke"))
          .attr("stroke-width", 1);
      }

      // Partner period lines
      const rowByPersonId = new Map<string, PersonRow>();
      for (const row of rows) {
        rowByPersonId.set(row.person.id, row);
      }

      for (const rel of relationships.values()) {
        if (rel.type !== RelationshipType.Partner) continue;
        const row1 = rowByPersonId.get(rel.source_person_id);
        const row2 = rowByPersonId.get(rel.target_person_id);
        if (!row1 || !row2) continue;

        const midY =
          (row1.y + ROW_HEIGHT / 2 + row2.y + ROW_HEIGHT / 2) / 2;

        for (const period of rel.periods) {
          const px1 = scale(period.start_year);
          const px2 = scale(period.end_year ?? currentYear);
          const isDashed =
            period.status === PartnerStatus.Separated ||
            period.status === PartnerStatus.Divorced;

          timeGroup
            .append("line")
            .attr("x1", px1)
            .attr("x2", px2)
            .attr("y1", midY)
            .attr("y2", midY)
            .attr("stroke", cssVar("--color-edge-partner"))
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", isDashed ? "6 3" : null);
        }
      }

      // Event markers
      for (const event of events.values()) {
        const year = parseInt(event.approximate_date, 10);
        if (isNaN(year)) continue;

        for (const personId of event.person_ids) {
          const row = rowByPersonId.get(personId);
          if (!row) continue;

          const cx = scale(year);
          const cy = row.y + ROW_HEIGHT / 2;

          timeGroup
            .append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", MARKER_RADIUS)
            .attr("fill", traumaColors[event.category])
            .attr("stroke", cssVar("--color-bg-canvas"))
            .attr("stroke-width", 1.5)
            .attr("class", "tl-marker")
            .on("mouseenter", (mouseEvent: MouseEvent) => {
              const linkedNames = event.person_ids
                .map((pid) => persons.get(pid)?.name)
                .filter(Boolean)
                .join(", ");

              tooltip.innerHTML = [
                `<strong>${event.title}</strong>`,
                tRef.current(`trauma.category.${event.category}`),
                event.approximate_date,
                tRef.current("timeline.severity", { value: event.severity }),
                linkedNames,
              ].join("<br>");

              tooltip.style.display = "block";
              tooltip.style.left = `${mouseEvent.clientX + 12}px`;
              tooltip.style.top = `${mouseEvent.clientY - 10}px`;
            })
            .on("mouseleave", () => {
              tooltip.style.display = "none";
            });
        }
      }

      // Life event markers (diamonds)
      const diamondSize = MARKER_RADIUS * 0.9;
      for (const le of lifeEvents.values()) {
        const year = parseInt(le.approximate_date, 10);
        if (isNaN(year)) continue;

        for (const personId of le.person_ids) {
          const row = rowByPersonId.get(personId);
          if (!row) continue;

          const cx = scale(year);
          const cy = row.y + ROW_HEIGHT / 2;

          timeGroup
            .append("rect")
            .attr("x", cx - diamondSize)
            .attr("y", cy - diamondSize)
            .attr("width", diamondSize * 2)
            .attr("height", diamondSize * 2)
            .attr("transform", `rotate(45, ${cx}, ${cy})`)
            .attr("fill", lifeEventColors[le.category])
            .attr("stroke", cssVar("--color-bg-canvas"))
            .attr("stroke-width", 1.5)
            .attr("class", "tl-marker")
            .on("mouseenter", (mouseEvent: MouseEvent) => {
              const linkedNames = le.person_ids
                .map((pid) => persons.get(pid)?.name)
                .filter(Boolean)
                .join(", ");

              const lines = [
                `<strong>${le.title}</strong>`,
                tRef.current(`lifeEvent.category.${le.category}`),
                le.approximate_date,
              ];
              if (le.impact != null) {
                lines.push(tRef.current("timeline.impact", { value: le.impact }));
              }
              lines.push(linkedNames);

              tooltip.innerHTML = lines.join("<br>");
              tooltip.style.display = "block";
              tooltip.style.left = `${mouseEvent.clientX + 12}px`;
              tooltip.style.top = `${mouseEvent.clientY - 10}px`;
            })
            .on("mouseleave", () => {
              tooltip.style.display = "none";
            });
        }
      }
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
  }, [persons, relationships, events, lifeEvents]);

  // Render on data change and resize
  useEffect(() => {
    render();

    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  return (
    <div className="timeline-container">
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
