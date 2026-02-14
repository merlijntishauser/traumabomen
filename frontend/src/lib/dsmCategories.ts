export interface DsmCategory {
  key: string;
  subcategories?: string[];
}

export const DSM_CATEGORIES: DsmCategory[] = [
  {
    key: "neurodevelopmental",
    subcategories: [
      "adhd",
      "autism",
      "intellectual_disability",
      "learning",
      "communication",
      "motor",
    ],
  },
  { key: "schizophrenia" },
  { key: "bipolar" },
  { key: "depressive" },
  { key: "anxiety" },
  { key: "ocd" },
  { key: "trauma_stressor" },
  { key: "dissociative" },
  { key: "somatic" },
  { key: "eating" },
  { key: "elimination" },
  { key: "sleep" },
  { key: "sexual_dysfunction" },
  { key: "gender_dysphoria" },
  { key: "impulse_control" },
  { key: "substance" },
  { key: "neurocognitive" },
  { key: "personality" },
  { key: "paraphilic" },
  { key: "other_mental" },
  { key: "medication_induced" },
  { key: "other_conditions" },
];

export function getCategoryByKey(key: string): DsmCategory | undefined {
  return DSM_CATEGORIES.find((c) => c.key === key);
}
