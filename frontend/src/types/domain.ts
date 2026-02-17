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
