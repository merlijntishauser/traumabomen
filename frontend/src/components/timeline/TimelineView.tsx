import * as d3 from "d3";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { getLifeEventColors } from "../../lib/lifeEventColors";
import { getTraumaColors } from "../../lib/traumaColors";
import { PartnerStatus, RelationshipType } from "../../types/domain";
import { BranchDecoration } from "../BranchDecoration";
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

interface TooltipLine {
  text: string;
  bold?: boolean;
}

/** Build tooltip content using textContent (safe from XSS) instead of innerHTML. */
function setTooltipLines(tooltip: HTMLDivElement, lines: TooltipLine[]): void {
  tooltip.textContent = "";
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tooltip.appendChild(document.createElement("br"));
    const span = document.createElement("span");
    span.textContent = lines[i].text;
    if (lines[i].bold) span.style.fontWeight = "600";
    tooltip.appendChild(span);
  }
}

const LABEL_WIDTH = 180;
const ROW_HEIGHT = 36;
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
      ...parents.filter((pid) => persons.has(pid)).map((pid) => getGeneration(pid, visited)),
    );
    const gen = maxParentGen + 1;
    generations.set(personId, gen);
    return gen;
  }

  for (const personId of persons.keys()) {
    getGeneration(personId, new Set());
  }

  // Partner equalization: partners belong to the same generation.
  // Fixed-point iteration: equalize partners, then propagate to children.
  let changed = true;
  while (changed) {
    changed = false;
    for (const rel of relationships.values()) {
      if (rel.type !== RelationshipType.Partner) continue;
      const genA = generations.get(rel.source_person_id);
      const genB = generations.get(rel.target_person_id);
      if (genA == null || genB == null) continue;
      if (genA !== genB) {
        const maxGen = Math.max(genA, genB);
        generations.set(rel.source_person_id, maxGen);
        generations.set(rel.target_person_id, maxGen);
        changed = true;
      }
    }
    for (const [childId, parentIds] of childToParents) {
      const parentGens = parentIds
        .filter((pid) => generations.has(pid))
        .map((pid) => generations.get(pid)!);
      if (parentGens.length === 0) continue;
      const expectedGen = Math.max(...parentGens) + 1;
      const currentGen = generations.get(childId) ?? 0;
      if (expectedGen > currentGen) {
        generations.set(childId, expectedGen);
        changed = true;
      }
    }
  }

  return generations;
}

export function TimelineView({ persons, relationships, events, lifeEvents }: TimelineViewProps) {
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

    // Filter out friend-only persons (those with no family edges)
    const familyConnected = new Set<string>();
    for (const rel of relationships.values()) {
      if (rel.type !== RelationshipType.Friend) {
        familyConnected.add(rel.source_person_id);
        familyConnected.add(rel.target_person_id);
      }
    }
    const timelinePersons = new Map<string, DecryptedPerson>();
    for (const [id, person] of persons) {
      if (familyConnected.has(id) || !relationships.size) {
        timelinePersons.set(id, person);
      } else {
        // Include persons with no relationships at all (unconnected family)
        const hasAnyRel = [...relationships.values()].some(
          (r) => r.source_person_id === id || r.target_person_id === id,
        );
        if (!hasAnyRel) timelinePersons.set(id, person);
      }
    }

    // Read theme colors from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVar = (name: string) => rootStyle.getPropertyValue(name).trim();
    const traumaColors = getTraumaColors();
    const lifeEventColors = getLifeEventColors();

    // Compute generations and build row layout
    const generations = computeGenerations(timelinePersons, relationships);
    const personsByGen = new Map<number, DecryptedPerson[]>();
    for (const person of timelinePersons.values()) {
      const gen = generations.get(person.id) ?? 0;
      const list = personsByGen.get(gen) ?? [];
      list.push(person);
      personsByGen.set(gen, list);
    }

    const sortedGens = Array.from(personsByGen.keys()).sort((a, b) => a - b);

    // Sort persons within each generation by birth year (unknown last)
    for (const list of personsByGen.values()) {
      list.sort((a, b) => (a.birth_year ?? Infinity) - (b.birth_year ?? Infinity));
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
    for (const person of timelinePersons.values()) {
      if (person.birth_year != null) {
        minYear = Math.min(minYear, person.birth_year);
      }
      maxYear = Math.max(maxYear, person.death_year ?? currentYear);
    }
    for (const event of events.values()) {
      const year = parseInt(event.approximate_date, 10);
      if (!Number.isNaN(year)) {
        minYear = Math.min(minYear, year);
        maxYear = Math.max(maxYear, year);
      }
    }
    for (const le of lifeEvents.values()) {
      const year = parseInt(le.approximate_date, 10);
      if (!Number.isNaN(year)) {
        minYear = Math.min(minYear, year);
        maxYear = Math.max(maxYear, year);
      }
    }
    minYear -= 5;
    maxYear += 5;

    const xScale = d3.scaleLinear().domain([minYear, maxYear]).range([LABEL_WIDTH, width]);

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

    // Clipped content group (time-dependent elements)
    const contentGroup = svgSel.append("g").attr("clip-path", "url(#timeline-clip)");

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
      axisGroup.selectAll(".tick text").attr("class", "tl-axis-text");
      axisGroup.selectAll(".tick line").attr("stroke", cssVar("--color-border-secondary"));
      axisGroup.select(".domain").remove();
    }

    function renderTimeContent(scale: d3.ScaleLinear<number, number>) {
      timeGroup.selectAll("*").remove();

      // Life bars (skip persons with unknown birth year)
      for (const row of rows) {
        if (row.person.birth_year == null) continue;
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

        const sourceName = persons.get(rel.source_person_id)?.name ?? "?";
        const targetName = persons.get(rel.target_person_id)?.name ?? "?";
        const midY = (row1.y + ROW_HEIGHT / 2 + row2.y + ROW_HEIGHT / 2) / 2;

        for (const period of rel.periods) {
          const px1 = scale(period.start_year);
          const px2 = scale(period.end_year ?? currentYear);
          const isDashed =
            period.status === PartnerStatus.Separated || period.status === PartnerStatus.Divorced;

          timeGroup
            .append("line")
            .attr("x1", px1)
            .attr("x2", px2)
            .attr("y1", midY)
            .attr("y2", midY)
            .attr("stroke", cssVar("--color-edge-partner"))
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", isDashed ? "6 3" : null);

          // Invisible wider hit area for hover
          const statusLabel = tRef.current(`relationship.status.${period.status}`);
          const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
          timeGroup
            .append("line")
            .attr("x1", px1)
            .attr("x2", px2)
            .attr("y1", midY)
            .attr("y2", midY)
            .attr("stroke", "transparent")
            .attr("stroke-width", 12)
            .style("cursor", "pointer")
            .on("mouseenter", (mouseEvent: MouseEvent) => {
              setTooltipLines(tooltip, [
                { text: `${sourceName} \u2014 ${targetName}`, bold: true },
                { text: `${statusLabel} ${yearRange}` },
              ]);
              tooltip.style.display = "block";
              tooltip.style.left = `${mouseEvent.clientX + 12}px`;
              tooltip.style.top = `${mouseEvent.clientY - 10}px`;
            })
            .on("mouseleave", () => {
              tooltip.style.display = "none";
            });
        }
      }

      // Event markers
      for (const event of events.values()) {
        const year = parseInt(event.approximate_date, 10);
        if (Number.isNaN(year)) continue;

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

              setTooltipLines(tooltip, [
                { text: event.title, bold: true },
                { text: tRef.current(`trauma.category.${event.category}`) },
                { text: event.approximate_date },
                { text: tRef.current("timeline.severity", { value: event.severity }) },
                { text: linkedNames },
              ]);

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
        if (Number.isNaN(year)) continue;

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

              const lines: TooltipLine[] = [
                { text: le.title, bold: true },
                { text: tRef.current(`lifeEvent.category.${le.category}`) },
                { text: le.approximate_date },
              ];
              if (le.impact != null) {
                lines.push({ text: tRef.current("timeline.impact", { value: le.impact }) });
              }
              lines.push({ text: linkedNames });

              setTooltipLines(tooltip, lines);
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
