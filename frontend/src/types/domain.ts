export enum RelationshipType {
  BiologicalParent = "biological_parent",
  StepParent = "step_parent",
  AdoptiveParent = "adoptive_parent",
  BiologicalSibling = "biological_sibling",
  StepSibling = "step_sibling",
  Partner = "partner",
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
  birth_year: number;
  death_year: number | null;
  gender: string;
  is_adopted: boolean;
  notes: string | null;
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

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}
