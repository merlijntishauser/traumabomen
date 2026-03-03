import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";

export interface Insight {
  category: "generational" | "temporal" | "summary" | "resilience";
  icon: string;
  titleKey: string;
  titleValues: Record<string, string | number>;
  detailKey: string | null;
  detailValues: Record<string, string | number>;
  priority: number;
}

export interface InsightInput {
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  generations: Map<string, number>;
}

/** Parse a year from an approximate_date string like "1985" or "1985-1990". */
export function parseYear(approxDate: string): number | null {
  const match = approxDate.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

/** Compute age at event given birth year and event year. */
function ageAtEvent(birthYear: number | null, eventYear: number | null): number | null {
  if (birthYear == null || eventYear == null) return null;
  return eventYear - birthYear;
}

/** Get the generation number for any person linked to an entity. */
function getEntityGenerations(personIds: string[], generations: Map<string, number>): number[] {
  return personIds.map((pid) => generations.get(pid)).filter((g): g is number => g != null);
}

/** Standard deviation of a number array. */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeGenerationalInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const { events, classifications, generations } = input;

  // Group trauma categories by generation
  const categoryGens = new Map<string, Set<number>>();
  for (const event of events.values()) {
    const gens = getEntityGenerations(event.person_ids, generations);
    for (const gen of gens) {
      const set = categoryGens.get(event.category) ?? new Set();
      set.add(gen);
      categoryGens.set(event.category, set);
    }
  }

  for (const [category, gens] of categoryGens) {
    if (gens.size >= 2) {
      insights.push({
        category: "generational",
        icon: "layers",
        titleKey: "insights.categoryAcrossGenerations",
        titleValues: { category: `trauma.category.${category}`, count: gens.size },
        detailKey: null,
        detailValues: {},
        priority: 90 + gens.size,
      });
    }
  }

  // Group classifications by generation (using dsm_category)
  const classGens = new Map<string, Set<number>>();
  for (const cls of classifications.values()) {
    const gens = getEntityGenerations(cls.person_ids, generations);
    for (const gen of gens) {
      const key = cls.dsm_subcategory ?? cls.dsm_category;
      const set = classGens.get(key) ?? new Set();
      set.add(gen);
      classGens.set(key, set);
    }
  }

  for (const [key, gens] of classGens) {
    if (gens.size >= 2) {
      const isSubcategory = [...classifications.values()].some((c) => c.dsm_subcategory === key);
      const labelKey = isSubcategory ? `dsm.sub.${key}` : `dsm.${key}`;
      insights.push({
        category: "generational",
        icon: "layers",
        titleKey: "insights.classificationAcrossGenerations",
        titleValues: { classification: labelKey, count: gens.size },
        detailKey: null,
        detailValues: {},
        priority: 85 + gens.size,
      });
    }
  }

  return insights;
}

function collectAgesByCategory(
  events: Map<string, DecryptedEvent>,
  persons: Map<string, DecryptedPerson>,
): Map<string, number[]> {
  const categoryAges = new Map<string, number[]>();
  for (const event of events.values()) {
    const eventYear = parseYear(event.approximate_date);
    if (eventYear == null) continue;
    for (const pid of event.person_ids) {
      const person = persons.get(pid);
      const age = ageAtEvent(person?.birth_year ?? null, eventYear);
      if (age != null && age >= 0) {
        const ages = categoryAges.get(event.category) ?? [];
        ages.push(age);
        categoryAges.set(event.category, ages);
      }
    }
  }
  return categoryAges;
}

function ageClusteringInsights(categoryAges: Map<string, number[]>): Insight[] {
  const insights: Insight[] = [];
  for (const [category, ages] of categoryAges) {
    if (ages.length < 3) continue;
    const sd = standardDeviation(ages);
    if (sd >= 10) continue;
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    insights.push({
      category: "temporal",
      icon: "clock",
      titleKey: "insights.ageClustering",
      titleValues: {
        category: `trauma.category.${category}`,
        low: Math.max(0, Math.round(mean - sd)),
        high: Math.round(mean + sd),
      },
      detailKey: "insights.ageClusteringDetail",
      detailValues: { count: ages.length },
      priority: 75,
    });
  }
  return insights;
}

function denseYearWindowInsight(events: Map<string, DecryptedEvent>): Insight | null {
  const eventYears: number[] = [];
  for (const event of events.values()) {
    const y = parseYear(event.approximate_date);
    if (y != null) eventYears.push(y);
  }
  if (eventYears.length < 3) return null;

  eventYears.sort((a, b) => a - b);
  let bestCount = 0;
  let bestStart = 0;
  for (const startYear of eventYears) {
    const count = eventYears.filter((y) => y >= startYear && y <= startYear + 20).length;
    if (count > bestCount) {
      bestCount = count;
      bestStart = startYear;
    }
  }
  if (bestCount / eventYears.length < 0.6) return null;

  return {
    category: "temporal",
    icon: "calendar",
    titleKey: "insights.denseYearWindow",
    titleValues: {
      startYear: bestStart,
      endYear: bestStart + 20,
      percentage: Math.round((bestCount / eventYears.length) * 100),
    },
    detailKey: "insights.denseYearWindowDetail",
    detailValues: { count: bestCount, total: eventYears.length },
    priority: 70,
  };
}

function averageDiagnosisAgeInsight(
  classifications: Map<string, DecryptedClassification>,
  persons: Map<string, DecryptedPerson>,
): Insight | null {
  const diagnosisAges: number[] = [];
  for (const cls of classifications.values()) {
    if (cls.diagnosis_year == null) continue;
    for (const pid of cls.person_ids) {
      const person = persons.get(pid);
      const age = ageAtEvent(person?.birth_year ?? null, cls.diagnosis_year);
      if (age != null && age >= 0) {
        diagnosisAges.push(age);
        break;
      }
    }
  }
  if (diagnosisAges.length < 2) return null;

  const avgAge = Math.round(diagnosisAges.reduce((a, b) => a + b, 0) / diagnosisAges.length);
  return {
    category: "temporal",
    icon: "activity",
    titleKey: "insights.averageDiagnosisAge",
    titleValues: { age: avgAge },
    detailKey: "insights.averageDiagnosisAgeDetail",
    detailValues: { count: diagnosisAges.length },
    priority: 65,
  };
}

function computeTemporalInsights(input: InsightInput): Insight[] {
  const { persons, events, classifications } = input;
  const insights: Insight[] = [];

  insights.push(...ageClusteringInsights(collectAgesByCategory(events, persons)));

  const denseWindow = denseYearWindowInsight(events);
  if (denseWindow) insights.push(denseWindow);

  const diagnosisAge = averageDiagnosisAgeInsight(classifications, persons);
  if (diagnosisAge) insights.push(diagnosisAge);

  return insights;
}

function mostCommonCategoryInsight(events: Map<string, DecryptedEvent>): Insight | null {
  if (events.size < 3) return null;
  const counts = new Map<string, number>();
  for (const event of events.values()) {
    counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const [category, count] = sorted[0];
  return {
    category: "summary",
    icon: "bar-chart",
    titleKey: "insights.mostCommonCategory",
    titleValues: { category: `trauma.category.${category}`, count },
    detailKey: null,
    detailValues: {},
    priority: 50,
  };
}

function sharedClassificationInsights(
  classifications: Map<string, DecryptedClassification>,
): Insight[] {
  const classPersons = new Map<string, Set<string>>();
  for (const cls of classifications.values()) {
    const key = cls.dsm_subcategory ?? cls.dsm_category;
    const set = classPersons.get(key) ?? new Set();
    for (const pid of cls.person_ids) set.add(pid);
    classPersons.set(key, set);
  }

  const insights: Insight[] = [];
  for (const [key, personSet] of classPersons) {
    if (personSet.size < 2) continue;
    const isSubcategory = [...classifications.values()].some((c) => c.dsm_subcategory === key);
    const labelKey = isSubcategory ? `dsm.sub.${key}` : `dsm.${key}`;
    insights.push({
      category: "summary",
      icon: "users",
      titleKey: "insights.sharedClassification",
      titleValues: { classification: labelKey, count: personSet.size },
      detailKey: null,
      detailValues: {},
      priority: 55,
    });
  }
  return insights;
}

function computeSummaryInsights(input: InsightInput): Insight[] {
  const { persons, events, classifications } = input;
  const insights: Insight[] = [];

  const commonCategory = mostCommonCategoryInsight(events);
  if (commonCategory) insights.push(commonCategory);

  insights.push(...sharedClassificationInsights(classifications));

  // Overall event count
  const eventPersonIds = new Set<string>();
  for (const event of events.values()) {
    for (const pid of event.person_ids) eventPersonIds.add(pid);
  }
  if (events.size >= 5) {
    insights.push({
      category: "summary",
      icon: "hash",
      titleKey: "insights.totalEvents",
      titleValues: { events: events.size, persons: eventPersonIds.size },
      detailKey: null,
      detailValues: {},
      priority: 40,
    });
  }

  // Tree size
  if (persons.size >= 3) {
    const generationCount = new Set([...input.generations.values()]).size;
    if (generationCount >= 2) {
      insights.push({
        category: "summary",
        icon: "users",
        titleKey: "insights.treeSize",
        titleValues: { persons: persons.size, generations: generationCount },
        detailKey: null,
        detailValues: {},
        priority: 35,
      });
    }
  }

  return insights;
}

/** Check if a turning point follows any trauma event for its first linked person within 5 years. */
function turningPointFollowsTrauma(
  tp: DecryptedTurningPoint,
  events: Map<string, DecryptedEvent>,
): boolean {
  const tpYear = parseYear(tp.approximate_date);
  if (tpYear == null) return false;
  const pid = tp.person_ids[0];
  if (pid == null) return false;
  for (const event of events.values()) {
    if (!event.person_ids.includes(pid)) continue;
    const eventYear = parseYear(event.approximate_date);
    if (eventYear != null && tpYear >= eventYear && tpYear - eventYear <= 5) return true;
  }
  return false;
}

function followsTraumaInsight(
  events: Map<string, DecryptedEvent>,
  turningPoints: Map<string, DecryptedTurningPoint>,
): Insight | null {
  let count = 0;
  for (const tp of turningPoints.values()) {
    if (turningPointFollowsTrauma(tp, events)) count++;
  }
  if (count < 1) return null;
  return {
    category: "resilience",
    icon: "sunrise",
    titleKey: "insights.turningPointsFollowTrauma",
    titleValues: { count },
    detailKey: "insights.turningPointsFollowTraumaDetail",
    detailValues: {},
    priority: 80,
  };
}

function cycleBreakingInsight(
  turningPoints: Map<string, DecryptedTurningPoint>,
  generations: Map<string, number>,
): Insight | null {
  const cycleBreakingGens = new Set<number>();
  for (const tp of turningPoints.values()) {
    if (tp.category !== "cycle_breaking") continue;
    for (const g of getEntityGenerations(tp.person_ids, generations)) cycleBreakingGens.add(g);
  }
  if (cycleBreakingGens.size < 2) return null;
  return {
    category: "resilience",
    icon: "shield",
    titleKey: "insights.cycleBreakingGenerations",
    titleValues: { count: cycleBreakingGens.size },
    detailKey: null,
    detailValues: {},
    priority: 82,
  };
}

function computeResilienceInsights(input: InsightInput): Insight[] {
  const { events, turningPoints, generations } = input;
  if (turningPoints.size === 0) return [];

  const insights: Insight[] = [];

  const follows = followsTraumaInsight(events, turningPoints);
  if (follows) insights.push(follows);

  const cycleBreaking = cycleBreakingInsight(turningPoints, generations);
  if (cycleBreaking) insights.push(cycleBreaking);

  // Most common turning point category
  if (turningPoints.size >= 3) {
    const counts = new Map<string, number>();
    for (const tp of turningPoints.values()) {
      counts.set(tp.category, (counts.get(tp.category) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [category, count] = sorted[0];
      insights.push({
        category: "resilience",
        icon: "star",
        titleKey: "insights.mostCommonTurningPoint",
        titleValues: { category: `turningPoint.category.${category}`, count },
        detailKey: null,
        detailValues: {},
        priority: 60,
      });
    }
  }

  return insights;
}

export function computeInsights(input: InsightInput): Insight[] {
  const all = [
    ...computeGenerationalInsights(input),
    ...computeTemporalInsights(input),
    ...computeSummaryInsights(input),
    ...computeResilienceInsights(input),
  ];

  return all.sort((a, b) => b.priority - a.priority);
}
