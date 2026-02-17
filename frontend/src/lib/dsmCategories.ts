export interface DsmSubcategory {
  key: string;
  code: string;
}

export interface DsmCategory {
  key: string;
  code: string;
  subcategories?: DsmSubcategory[];
}

export const DSM_CATEGORIES: DsmCategory[] = [
  {
    key: "neurodevelopmental",
    code: "F70-F98",
    subcategories: [
      { key: "adhd", code: "F90" },
      { key: "autism", code: "F84" },
      { key: "intellectual_disability", code: "F70-F79" },
      { key: "learning", code: "F81" },
      { key: "communication", code: "F80" },
      { key: "motor", code: "F82" },
    ],
  },
  {
    key: "schizophrenia",
    code: "F20-F29",
    subcategories: [
      { key: "schizophrenia_disorder", code: "F20" },
      { key: "schizoaffective", code: "F25" },
      { key: "brief_psychotic", code: "F23" },
      { key: "delusional", code: "F22" },
    ],
  },
  {
    key: "bipolar",
    code: "F30-F31",
    subcategories: [
      { key: "bipolar_i", code: "F31" },
      { key: "bipolar_ii", code: "F31.81" },
      { key: "cyclothymia", code: "F34.0" },
    ],
  },
  {
    key: "depressive",
    code: "F32-F33",
    subcategories: [
      { key: "major_depression", code: "F32-F33" },
      { key: "persistent_depressive", code: "F34.1" },
      { key: "premenstrual_dysphoric", code: "N94.3" },
      { key: "seasonal_depression", code: "F33" },
    ],
  },
  {
    key: "anxiety",
    code: "F40-F41",
    subcategories: [
      { key: "generalized_anxiety", code: "F41.1" },
      { key: "panic_disorder", code: "F41.0" },
      { key: "social_anxiety", code: "F40.10" },
      { key: "specific_phobia", code: "F40.2" },
      { key: "agoraphobia", code: "F40.00" },
      { key: "separation_anxiety", code: "F93.0" },
    ],
  },
  {
    key: "ocd",
    code: "F42-F45",
    subcategories: [
      { key: "ocd_disorder", code: "F42" },
      { key: "hoarding", code: "F42.3" },
      { key: "body_dysmorphic", code: "F45.22" },
      { key: "hair_pulling", code: "F63.3" },
      { key: "skin_picking", code: "L98.1" },
    ],
  },
  {
    key: "trauma_stressor",
    code: "F43",
    subcategories: [
      { key: "ptsd", code: "F43.1" },
      { key: "acute_stress", code: "F43.0" },
      { key: "adjustment_disorder", code: "F43.2" },
      { key: "reactive_attachment", code: "F94.1" },
    ],
  },
  {
    key: "dissociative",
    code: "F44",
    subcategories: [
      { key: "dissociative_identity", code: "F44.81" },
      { key: "dissociative_amnesia", code: "F44.0" },
      { key: "depersonalization", code: "F48.1" },
    ],
  },
  {
    key: "somatic",
    code: "F45",
    subcategories: [
      { key: "somatic_symptom", code: "F45.1" },
      { key: "illness_anxiety", code: "F45.21" },
      { key: "conversion", code: "F44.4" },
      { key: "factitious", code: "F68.1" },
    ],
  },
  {
    key: "eating",
    code: "F50",
    subcategories: [
      { key: "anorexia", code: "F50.0" },
      { key: "bulimia", code: "F50.2" },
      { key: "binge_eating", code: "F50.81" },
      { key: "avoidant_restrictive", code: "F50.82" },
    ],
  },
  { key: "elimination", code: "F98" },
  {
    key: "sleep",
    code: "F51",
    subcategories: [
      { key: "insomnia", code: "F51.0" },
      { key: "hypersomnia", code: "F51.1" },
      { key: "nightmare_disorder", code: "F51.5" },
      { key: "sleepwalking", code: "F51.3" },
    ],
  },
  { key: "sexual_dysfunction", code: "F52" },
  { key: "gender_dysphoria", code: "F64" },
  {
    key: "impulse_control",
    code: "F91-F63",
    subcategories: [
      { key: "oppositional_defiant", code: "F91.3" },
      { key: "conduct_disorder", code: "F91" },
      { key: "intermittent_explosive", code: "F63.81" },
      { key: "pyromania", code: "F63.1" },
      { key: "kleptomania", code: "F63.2" },
    ],
  },
  {
    key: "substance",
    code: "F10-F19",
    subcategories: [
      { key: "alcohol_use", code: "F10" },
      { key: "cannabis_use", code: "F12" },
      { key: "stimulant_use", code: "F15" },
      { key: "opioid_use", code: "F11" },
      { key: "tobacco_use", code: "F17" },
      { key: "gambling", code: "F63.0" },
    ],
  },
  {
    key: "neurocognitive",
    code: "F01-F09",
    subcategories: [
      { key: "alzheimers", code: "F03" },
      { key: "vascular_dementia", code: "F01" },
      { key: "mild_cognitive", code: "G31.84" },
      { key: "delirium", code: "F05" },
    ],
  },
  {
    key: "personality",
    code: "F60-F69",
    subcategories: [
      { key: "borderline_pd", code: "F60.3" },
      { key: "narcissistic_pd", code: "F60.81" },
      { key: "antisocial_pd", code: "F60.2" },
      { key: "avoidant_pd", code: "F60.6" },
      { key: "dependent_pd", code: "F60.7" },
      { key: "obsessive_compulsive_pd", code: "F60.5" },
      { key: "paranoid_pd", code: "F60.0" },
      { key: "schizotypal_pd", code: "F21" },
    ],
  },
  { key: "paraphilic", code: "F65" },
  { key: "other_mental", code: "F99" },
  { key: "medication_induced", code: "G25" },
  { key: "other_conditions", code: "Z" },
];

export function getCategoryByKey(key: string): DsmCategory | undefined {
  return DSM_CATEGORIES.find((c) => c.key === key);
}
