import type * as d3 from "d3";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import type { LifeEventCategory, TraumaCategory } from "../../types/domain";
import { PartnerStatus, RelationshipType } from "../../types/domain";

// ---- Constants ----

export const LABEL_WIDTH = 180;
export const ROW_HEIGHT = 36;
export const BAR_HEIGHT = 12;
export const GEN_HEADER_HEIGHT = 20;
export const MARKER_RADIUS = 7;

// ---- Types ----

export interface PersonRow {
  person: DecryptedPerson;
  generation: number;
  y: number;
}

export interface TooltipLine {
  text: string;
  bold?: boolean;
}

export interface RowLayout {
  rows: PersonRow[];
  sortedGens: number[];
  personsByGen: Map<number, DecryptedPerson[]>;
  totalHeight: number;
}

export interface TimelineRenderContext {
  timeGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  scale: d3.ScaleLinear<number, number>;
  rows: PersonRow[];
  tooltip: HTMLDivElement;
  cssVar: (name: string) => string;
  tRef: { current: (key: string, opts?: Record<string, unknown>) => string };
  currentYear: number;
}

// ---- Tooltip helper ----

export function setTooltipLines(tooltip: HTMLDivElement, lines: TooltipLine[]): void {
  tooltip.textContent = "";
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tooltip.appendChild(document.createElement("br"));
    const span = document.createElement("span");
    span.textContent = lines[i].text;
    if (lines[i].bold) span.style.fontWeight = "600";
    tooltip.appendChild(span);
  }
}

// ---- Generation computation ----

export function buildChildToParentsMap(
  relationships: Map<string, DecryptedRelationship>,
): Map<string, string[]> {
  const childToParents = new Map<string, string[]>();
  for (const rel of relationships.values()) {
    if (
      rel.type === RelationshipType.BiologicalParent ||
      rel.type === RelationshipType.StepParent ||
      rel.type === RelationshipType.AdoptiveParent
    ) {
      const parents = childToParents.get(rel.target_person_id) ?? [];
      parents.push(rel.source_person_id);
      childToParents.set(rel.target_person_id, parents);
    }
  }
  return childToParents;
}

export function assignBaseGenerations(
  persons: Map<string, DecryptedPerson>,
  childToParents: Map<string, string[]>,
): Map<string, number> {
  const generations = new Map<string, number>();

  function getGeneration(personId: string, visited: Set<string>): number {
    if (generations.has(personId)) return generations.get(personId)!;
    if (visited.has(personId)) return 0;
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

  return generations;
}

function equalizePartners(
  generations: Map<string, number>,
  relationships: Map<string, DecryptedRelationship>,
): boolean {
  let changed = false;
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
  return changed;
}

function propagateToChildren(
  generations: Map<string, number>,
  childToParents: Map<string, string[]>,
): boolean {
  let changed = false;
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
  return changed;
}

export function equalizePartnerGenerations(
  generations: Map<string, number>,
  relationships: Map<string, DecryptedRelationship>,
  childToParents: Map<string, string[]>,
): void {
  let changed = true;
  while (changed) {
    const partnersChanged = equalizePartners(generations, relationships);
    const childrenChanged = propagateToChildren(generations, childToParents);
    changed = partnersChanged || childrenChanged;
  }
}

export function computeGenerations(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, number> {
  const childToParents = buildChildToParentsMap(relationships);
  const generations = assignBaseGenerations(persons, childToParents);
  equalizePartnerGenerations(generations, relationships, childToParents);
  return generations;
}

// ---- Person filtering ----

export function filterTimelinePersons(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, DecryptedPerson> {
  const familyConnected = new Set<string>();
  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.Friend) {
      familyConnected.add(rel.source_person_id);
      familyConnected.add(rel.target_person_id);
    }
  }

  const result = new Map<string, DecryptedPerson>();
  for (const [id, person] of persons) {
    if (familyConnected.has(id) || !relationships.size) {
      result.set(id, person);
    } else {
      const hasAnyRel = [...relationships.values()].some(
        (r) => r.source_person_id === id || r.target_person_id === id,
      );
      if (!hasAnyRel) result.set(id, person);
    }
  }
  return result;
}

// ---- Row layout ----

export function buildRowLayout(
  timelinePersons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  availableHeight: number,
): RowLayout {
  const generations = computeGenerations(timelinePersons, relationships);
  const personsByGen = new Map<number, DecryptedPerson[]>();

  for (const person of timelinePersons.values()) {
    const gen = generations.get(person.id) ?? 0;
    const list = personsByGen.get(gen) ?? [];
    list.push(person);
    personsByGen.set(gen, list);
  }

  const sortedGens = Array.from(personsByGen.keys()).sort((a, b) => a - b);

  for (const list of personsByGen.values()) {
    list.sort(
      (a, b) =>
        (a.birth_year ?? Number.POSITIVE_INFINITY) - (b.birth_year ?? Number.POSITIVE_INFINITY),
    );
  }

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

  const totalHeight = Math.max(currentY + 20, availableHeight);
  return { rows, sortedGens, personsByGen, totalHeight };
}

// ---- Time domain ----

export function computeTimeDomain(
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
): { minYear: number; maxYear: number } {
  const currentYear = new Date().getFullYear();
  let minYear = currentYear;
  let maxYear = 0;

  for (const person of persons.values()) {
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

  return { minYear: minYear - 5, maxYear: maxYear + 5 };
}

// ---- D3 rendering helpers ----

export function renderLifeBars(ctx: TimelineRenderContext): void {
  for (const row of ctx.rows) {
    if (row.person.birth_year == null) continue;
    const x1 = ctx.scale(row.person.birth_year);
    const x2 = ctx.scale(row.person.death_year ?? ctx.currentYear);
    const barY = row.y + (ROW_HEIGHT - BAR_HEIGHT) / 2;

    ctx.timeGroup
      .append("rect")
      .attr("x", x1)
      .attr("y", barY)
      .attr("width", Math.max(0, x2 - x1))
      .attr("height", BAR_HEIGHT)
      .attr("rx", 3)
      .attr("fill", ctx.cssVar("--color-lifebar-fill"))
      .attr("stroke", ctx.cssVar("--color-lifebar-stroke"))
      .attr("stroke-width", 1);
  }
}

export function renderPartnerLines(
  ctx: TimelineRenderContext,
  relationships: Map<string, DecryptedRelationship>,
  persons: Map<string, DecryptedPerson>,
): void {
  const rowByPersonId = new Map<string, PersonRow>();
  for (const row of ctx.rows) {
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
      const px1 = ctx.scale(period.start_year);
      const px2 = ctx.scale(period.end_year ?? ctx.currentYear);
      const isDashed =
        period.status === PartnerStatus.Separated || period.status === PartnerStatus.Divorced;

      ctx.timeGroup
        .append("line")
        .attr("x1", px1)
        .attr("x2", px2)
        .attr("y1", midY)
        .attr("y2", midY)
        .attr("stroke", ctx.cssVar("--color-edge-partner"))
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", isDashed ? "6 3" : null);

      const statusLabel = ctx.tRef.current(`relationship.status.${period.status}`);
      const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
      ctx.timeGroup
        .append("line")
        .attr("x1", px1)
        .attr("x2", px2)
        .attr("y1", midY)
        .attr("y2", midY)
        .attr("stroke", "transparent")
        .attr("stroke-width", 12)
        .style("cursor", "pointer")
        .on("mouseenter", (mouseEvent: MouseEvent) => {
          setTooltipLines(ctx.tooltip, [
            { text: `${sourceName} \u2014 ${targetName}`, bold: true },
            { text: `${statusLabel} ${yearRange}` },
          ]);
          ctx.tooltip.style.display = "block";
          ctx.tooltip.style.left = `${mouseEvent.clientX + 12}px`;
          ctx.tooltip.style.top = `${mouseEvent.clientY - 10}px`;
        })
        .on("mouseleave", () => {
          ctx.tooltip.style.display = "none";
        });
    }
  }
}

export function renderTraumaMarkers(
  ctx: TimelineRenderContext,
  events: Map<string, DecryptedEvent>,
  persons: Map<string, DecryptedPerson>,
  traumaColors: Record<TraumaCategory, string>,
): void {
  const rowByPersonId = new Map<string, PersonRow>();
  for (const row of ctx.rows) {
    rowByPersonId.set(row.person.id, row);
  }

  for (const event of events.values()) {
    const year = parseInt(event.approximate_date, 10);
    if (Number.isNaN(year)) continue;

    for (const personId of event.person_ids) {
      const row = rowByPersonId.get(personId);
      if (!row) continue;

      const cx = ctx.scale(year);
      const cy = row.y + ROW_HEIGHT / 2;

      ctx.timeGroup
        .append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", MARKER_RADIUS)
        .attr("fill", traumaColors[event.category])
        .attr("stroke", ctx.cssVar("--color-bg-canvas"))
        .attr("stroke-width", 1.5)
        .attr("class", "tl-marker")
        .on("mouseenter", (mouseEvent: MouseEvent) => {
          const linkedNames = event.person_ids
            .map((pid) => persons.get(pid)?.name)
            .filter(Boolean)
            .join(", ");

          setTooltipLines(ctx.tooltip, [
            { text: event.title, bold: true },
            { text: ctx.tRef.current(`trauma.category.${event.category}`) },
            { text: event.approximate_date },
            { text: ctx.tRef.current("timeline.severity", { value: event.severity }) },
            { text: linkedNames },
          ]);

          ctx.tooltip.style.display = "block";
          ctx.tooltip.style.left = `${mouseEvent.clientX + 12}px`;
          ctx.tooltip.style.top = `${mouseEvent.clientY - 10}px`;
        })
        .on("mouseleave", () => {
          ctx.tooltip.style.display = "none";
        });
    }
  }
}

export function renderLifeEventMarkers(
  ctx: TimelineRenderContext,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  persons: Map<string, DecryptedPerson>,
  lifeEventColors: Record<LifeEventCategory, string>,
): void {
  const rowByPersonId = new Map<string, PersonRow>();
  for (const row of ctx.rows) {
    rowByPersonId.set(row.person.id, row);
  }

  const diamondSize = MARKER_RADIUS * 0.9;

  for (const le of lifeEvents.values()) {
    const year = parseInt(le.approximate_date, 10);
    if (Number.isNaN(year)) continue;

    for (const personId of le.person_ids) {
      const row = rowByPersonId.get(personId);
      if (!row) continue;

      const cx = ctx.scale(year);
      const cy = row.y + ROW_HEIGHT / 2;

      ctx.timeGroup
        .append("rect")
        .attr("x", cx - diamondSize)
        .attr("y", cy - diamondSize)
        .attr("width", diamondSize * 2)
        .attr("height", diamondSize * 2)
        .attr("transform", `rotate(45, ${cx}, ${cy})`)
        .attr("fill", lifeEventColors[le.category])
        .attr("stroke", ctx.cssVar("--color-bg-canvas"))
        .attr("stroke-width", 1.5)
        .attr("class", "tl-marker")
        .on("mouseenter", (mouseEvent: MouseEvent) => {
          const linkedNames = le.person_ids
            .map((pid) => persons.get(pid)?.name)
            .filter(Boolean)
            .join(", ");

          const lines: TooltipLine[] = [
            { text: le.title, bold: true },
            { text: ctx.tRef.current(`lifeEvent.category.${le.category}`) },
            { text: le.approximate_date },
          ];
          if (le.impact != null) {
            lines.push({ text: ctx.tRef.current("timeline.impact", { value: le.impact }) });
          }
          lines.push({ text: linkedNames });

          setTooltipLines(ctx.tooltip, lines);
          ctx.tooltip.style.display = "block";
          ctx.tooltip.style.left = `${mouseEvent.clientX + 12}px`;
          ctx.tooltip.style.top = `${mouseEvent.clientY - 10}px`;
        })
        .on("mouseleave", () => {
          ctx.tooltip.style.display = "none";
        });
    }
  }
}

export function renderClassificationStrips(
  ctx: TimelineRenderContext,
  classifications: Map<string, DecryptedClassification>,
): void {
  const classificationStripHeight = 4;
  const classificationsByPerson = new Map<string, DecryptedClassification[]>();
  for (const cls of classifications.values()) {
    for (const pid of cls.person_ids) {
      const existing = classificationsByPerson.get(pid) ?? [];
      existing.push(cls);
      classificationsByPerson.set(pid, existing);
    }
  }

  for (const row of ctx.rows) {
    if (row.person.birth_year == null) continue;
    const personCls = classificationsByPerson.get(row.person.id);
    if (!personCls) continue;

    const barY = row.y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
    let stripIdx = 0;

    for (const cls of personCls) {
      const clsColor = ctx.cssVar(
        cls.status === "diagnosed"
          ? "--color-classification-diagnosed"
          : "--color-classification-suspected",
      );

      renderClassificationPeriods(ctx, cls, barY, stripIdx, clsColor, classificationStripHeight);
      renderDiagnosisTriangle(ctx, cls, row, clsColor);
      stripIdx++;
    }
  }
}

function renderClassificationPeriods(
  ctx: TimelineRenderContext,
  cls: DecryptedClassification,
  barY: number,
  stripIdx: number,
  clsColor: string,
  stripHeight: number,
): void {
  for (const period of cls.periods) {
    const px1 = ctx.scale(period.start_year);
    const px2 = ctx.scale(period.end_year ?? ctx.currentYear);
    const stripY = barY + BAR_HEIGHT + 2 + stripIdx * (stripHeight + 1);

    ctx.timeGroup
      .append("rect")
      .attr("x", px1)
      .attr("y", stripY)
      .attr("width", Math.max(0, px2 - px1))
      .attr("height", stripHeight)
      .attr("rx", 1)
      .attr("fill", clsColor)
      .attr("opacity", 0.8)
      .on("mouseenter", (mouseEvent: MouseEvent) => {
        const catLabel = ctx.tRef.current(`dsm.${cls.dsm_category}`);
        const subLabel = cls.dsm_subcategory
          ? ctx.tRef.current(`dsm.sub.${cls.dsm_subcategory}`)
          : null;
        const statusLabel = ctx.tRef.current(`classification.status.${cls.status}`);
        const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;

        setTooltipLines(ctx.tooltip, [
          { text: subLabel ? `${catLabel} - ${subLabel}` : catLabel, bold: true },
          { text: `${statusLabel} ${yearRange}` },
        ]);
        ctx.tooltip.style.display = "block";
        ctx.tooltip.style.left = `${mouseEvent.clientX + 12}px`;
        ctx.tooltip.style.top = `${mouseEvent.clientY - 10}px`;
      })
      .on("mouseleave", () => {
        ctx.tooltip.style.display = "none";
      });
  }
}

function renderDiagnosisTriangle(
  ctx: TimelineRenderContext,
  cls: DecryptedClassification,
  row: PersonRow,
  clsColor: string,
): void {
  if (cls.status !== "diagnosed" || cls.diagnosis_year == null) return;

  const dx = ctx.scale(cls.diagnosis_year);
  const dy = row.y + ROW_HEIGHT / 2;
  const triSize = MARKER_RADIUS * 0.85;
  const triPath = `M${dx},${dy - triSize} L${dx + triSize},${dy + triSize} L${dx - triSize},${dy + triSize} Z`;

  ctx.timeGroup
    .append("path")
    .attr("d", triPath)
    .attr("fill", clsColor)
    .attr("stroke", ctx.cssVar("--color-bg-canvas"))
    .attr("stroke-width", 1.5)
    .attr("class", "tl-marker")
    .on("mouseenter", (mouseEvent: MouseEvent) => {
      const catLabel = ctx.tRef.current(`dsm.${cls.dsm_category}`);
      const subLabel = cls.dsm_subcategory
        ? ctx.tRef.current(`dsm.sub.${cls.dsm_subcategory}`)
        : null;
      setTooltipLines(ctx.tooltip, [
        { text: subLabel ? `${catLabel} - ${subLabel}` : catLabel, bold: true },
        {
          text: `${ctx.tRef.current("classification.status.diagnosed")} (${cls.diagnosis_year})`,
        },
      ]);
      ctx.tooltip.style.display = "block";
      ctx.tooltip.style.left = `${mouseEvent.clientX + 12}px`;
      ctx.tooltip.style.top = `${mouseEvent.clientY - 10}px`;
    })
    .on("mouseleave", () => {
      ctx.tooltip.style.display = "none";
    });
}
