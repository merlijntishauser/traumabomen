export enum RelationshipType {
  BiologicalParent = "biological_parent",
  StepParent = "step_parent",
  AdoptiveParent = "adoptive_parent",
  BiologicalSibling = "biological_sibling",
  StepSibling = "step_sibling",
  HalfSibling = "half_sibling",
  Partner = "partner",
  Friend = "friend",
}

export enum PartnerStatus {
  Together = "together",
  Married = "married",
  Separated = "separated",
  Divorced = "divorced",
}

export enum TraumaCategory {
  Loss = "loss",
  Abuse = "abuse",
  Addiction = "addiction",
  War = "war",
  Displacement = "displacement",
  Illness = "illness",
  Poverty = "poverty",
}

export interface RelationshipPeriod {
  start_year: number;
  end_year: number | null;
  status: PartnerStatus;
}

/**
 * Auto-manage "divorced" periods after ended marriages.
 *
 * On each save: strips previously auto-generated divorced periods (those
 * starting at a married period's end_year), then re-inserts them with
 * the correct end_year. The end_year is the earliest of: the next period's
 * start_year, either partner's death_year, or null (ongoing).
 */
export function withAutoDissolvedPeriods(
  periods: RelationshipPeriod[],
  partnerDeathYears?: { source?: number | null; target?: number | null },
): RelationshipPeriod[] {
  const sorted = [...periods].sort((a, b) => a.start_year - b.start_year);

  // Collect end_years of all married periods to identify auto-generated divorced periods
  const marriedEndYears = new Set(
    sorted
      .filter((p) => p.status === PartnerStatus.Married && p.end_year != null)
      .map((p) => p.end_year!),
  );

  // Strip auto-generated divorced periods (those starting exactly at a marriage end_year)
  const cleaned = sorted.filter(
    (p) => !(p.status === PartnerStatus.Divorced && marriedEndYears.has(p.start_year)),
  );

  // Earliest death year of either partner (if any)
  const deathCandidates: number[] = [];
  if (partnerDeathYears?.source) deathCandidates.push(partnerDeathYears.source);
  if (partnerDeathYears?.target) deathCandidates.push(partnerDeathYears.target);
  const earliestDeath = deathCandidates.length > 0 ? Math.min(...deathCandidates) : null;

  // Re-generate divorced periods with correct end_years
  const result: RelationshipPeriod[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const period = cleaned[i];
    result.push(period);

    if (period.status === PartnerStatus.Married && period.end_year != null) {
      const next = cleaned[i + 1];
      if (!next || next.start_year > period.end_year) {
        // End at the earliest of: next period start, partner death, or null (ongoing)
        const candidates: number[] = [];
        if (next) candidates.push(next.start_year);
        if (earliestDeath != null && earliestDeath >= period.end_year) {
          candidates.push(earliestDeath);
        }
        const endYear = candidates.length > 0 ? Math.min(...candidates) : null;

        result.push({
          start_year: period.end_year,
          end_year: endYear,
          status: PartnerStatus.Divorced,
        });
      }
    }
  }

  return result;
}

export interface Person {
  name: string;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  gender: string;
  is_adopted: boolean;
  notes: string | null;
  position?: { x: number; y: number };
}

export interface RelationshipData {
  type: RelationshipType;
  periods: RelationshipPeriod[];
  active_period: { start_year: number; end_year: number | null } | null;
}

export interface TraumaEvent {
  title: string;
  description: string;
  category: TraumaCategory;
  approximate_date: string;
  severity: number;
  tags: string[];
}

export enum LifeEventCategory {
  Family = "family",
  Education = "education",
  Career = "career",
  Relocation = "relocation",
  Health = "health",
  StartedMedication = "started_medication",
  StoppedMedication = "stopped_medication",
  Other = "other",
}

export interface LifeEvent {
  title: string;
  description: string;
  category: LifeEventCategory;
  approximate_date: string;
  impact: number | null;
  tags: string[];
}

export type ClassificationStatus = "suspected" | "diagnosed";

export interface ClassificationPeriod {
  start_year: number;
  end_year: number | null;
}

export interface Classification {
  dsm_category: string;
  dsm_subcategory: string | null;
  status: ClassificationStatus;
  diagnosis_year: number | null;
  periods: ClassificationPeriod[];
  notes: string | null;
}

export interface LinkedEntity {
  entity_type: "trauma_event" | "life_event" | "classification";
  entity_id: string;
}

export interface Pattern {
  name: string;
  description: string;
  color: string;
  linked_entities: LinkedEntity[];
}

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}
