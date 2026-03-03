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

function computeTemporalInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const { persons, events, classifications } = input;

  // Age-at-event clustering by trauma category
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

  for (const [category, ages] of categoryAges) {
    if (ages.length < 3) continue;
    const sd = standardDeviation(ages);
    if (sd < 10) {
      const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
      const low = Math.max(0, Math.round(mean - sd));
      const high = Math.round(mean + sd);
      insights.push({
        category: "temporal",
        icon: "clock",
        titleKey: "insights.ageClustering",
        titleValues: { category: `trauma.category.${category}`, low, high },
        detailKey: "insights.ageClusteringDetail",
        detailValues: { count: ages.length },
        priority: 75,
      });
    }
  }

  // Dense year window: 60%+ of trauma events in a 20-year window
  const eventYears: number[] = [];
  for (const event of events.values()) {
    const y = parseYear(event.approximate_date);
    if (y != null) eventYears.push(y);
  }

  if (eventYears.length >= 3) {
    eventYears.sort((a, b) => a - b);
    let bestCount = 0;
    let bestStart = 0;
    for (const startYear of eventYears) {
      const endYear = startYear + 20;
      const count = eventYears.filter((y) => y >= startYear && y <= endYear).length;
      if (count > bestCount) {
        bestCount = count;
        bestStart = startYear;
      }
    }
    if (bestCount / eventYears.length >= 0.6) {
      insights.push({
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
      });
    }
  }

  // Average age at first diagnosis
  const diagnosisAges: number[] = [];
  for (const cls of classifications.values()) {
    if (cls.diagnosis_year == null) continue;
    for (const pid of cls.person_ids) {
      const person = persons.get(pid);
      const age = ageAtEvent(person?.birth_year ?? null, cls.diagnosis_year);
      if (age != null && age >= 0) {
        diagnosisAges.push(age);
        break; // one age per classification
      }
    }
  }

  if (diagnosisAges.length >= 2) {
    const avgAge = Math.round(diagnosisAges.reduce((a, b) => a + b, 0) / diagnosisAges.length);
    insights.push({
      category: "temporal",
      icon: "activity",
      titleKey: "insights.averageDiagnosisAge",
      titleValues: { age: avgAge },
      detailKey: "insights.averageDiagnosisAgeDetail",
      detailValues: { count: diagnosisAges.length },
      priority: 65,
    });
  }

  return insights;
}

function computeSummaryInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const { persons, events, classifications } = input;

  // Most common trauma category
  if (events.size >= 3) {
    const counts = new Map<string, number>();
    for (const event of events.values()) {
      counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [category, count] = sorted[0];
      insights.push({
        category: "summary",
        icon: "bar-chart",
        titleKey: "insights.mostCommonCategory",
        titleValues: { category: `trauma.category.${category}`, count },
        detailKey: null,
        detailValues: {},
        priority: 50,
      });
    }
  }

  // Shared classifications across persons
  const classPersons = new Map<string, Set<string>>();
  for (const cls of classifications.values()) {
    const key = cls.dsm_subcategory ?? cls.dsm_category;
    const set = classPersons.get(key) ?? new Set();
    for (const pid of cls.person_ids) set.add(pid);
    classPersons.set(key, set);
  }

  for (const [key, personSet] of classPersons) {
    if (personSet.size >= 2) {
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
  }

  // Overall event count
  const totalEvents = events.size;
  const eventPersonIds = new Set<string>();
  for (const event of events.values()) {
    for (const pid of event.person_ids) eventPersonIds.add(pid);
  }

  if (totalEvents >= 5) {
    insights.push({
      category: "summary",
      icon: "hash",
      titleKey: "insights.totalEvents",
      titleValues: { events: totalEvents, persons: eventPersonIds.size },
      detailKey: null,
      detailValues: {},
      priority: 40,
    });
  }

  // Person count
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

function computeResilienceInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const { events, turningPoints, generations } = input;

  if (turningPoints.size === 0) return insights;

  // Turning points following trauma within 5 years
  let followsTraumaCount = 0;
  for (const tp of turningPoints.values()) {
    const tpYear = parseYear(tp.approximate_date);
    if (tpYear == null) continue;
    for (const pid of tp.person_ids) {
      const personEvents = [...events.values()].filter((e) => e.person_ids.includes(pid));
      for (const event of personEvents) {
        const eventYear = parseYear(event.approximate_date);
        if (eventYear != null && tpYear >= eventYear && tpYear - eventYear <= 5) {
          followsTraumaCount++;
          break; // count each turning point once
        }
      }
      break; // count per first linked person
    }
  }

  if (followsTraumaCount >= 1) {
    insights.push({
      category: "resilience",
      icon: "sunrise",
      titleKey: "insights.turningPointsFollowTrauma",
      titleValues: { count: followsTraumaCount },
      detailKey: "insights.turningPointsFollowTraumaDetail",
      detailValues: {},
      priority: 80,
    });
  }

  // Cycle-breaking events across generations
  const cycleBreakingGens = new Set<number>();
  for (const tp of turningPoints.values()) {
    if (tp.category !== "cycle_breaking") continue;
    const gens = getEntityGenerations(tp.person_ids, generations);
    for (const g of gens) cycleBreakingGens.add(g);
  }

  if (cycleBreakingGens.size >= 2) {
    insights.push({
      category: "resilience",
      icon: "shield",
      titleKey: "insights.cycleBreakingGenerations",
      titleValues: { count: cycleBreakingGens.size },
      detailKey: null,
      detailValues: {},
      priority: 82,
    });
  }

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
