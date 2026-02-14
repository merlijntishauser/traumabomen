# Design: DSM-5 Classifications

## Summary

Add a third entity type -- Classifications -- alongside trauma events and life events. A classification represents a DSM-5 diagnostic category attached to one or more persons, with a suspected/diagnosed status, optional diagnosis year, and recurring time periods. Visually represented as triangles on person nodes and colored bottom-border strips on timeline life bars.

## Data model

### Classification (decrypted payload)

```typescript
interface Classification {
  dsm_category: string;              // key from DSM_CATEGORIES
  dsm_subcategory: string | null;    // key from subcategory list, if applicable
  status: "suspected" | "diagnosed";
  diagnosis_year: number | null;     // only when status = "diagnosed"
  periods: ClassificationPeriod[];
  notes: string | null;
}

interface ClassificationPeriod {
  start_year: number;
  end_year: number | null;           // null = ongoing/lifelong
}
```

### API shape (encrypted)

Same pattern as life events: `{ id, person_ids, encrypted_data }`. Server stores opaque ciphertext.

### DSM-5 categories (22 major + 6 neurodevelopmental subtypes)

Categories are string keys. Labels live in i18n files. The select UI is two-level: pick a major category, then optionally a subcategory (only neurodevelopmental has subtypes for now; the model supports adding subtypes to other categories later).

| Key | EN | NL |
|-----|----|----|
| `neurodevelopmental` | Neurodevelopmental Disorders | Neurobiologische ontwikkelingsstoornissen |
| `schizophrenia` | Schizophrenia Spectrum & Psychotic Disorders | Schizofreniespectrum- en andere psychotische stoornissen |
| `bipolar` | Bipolar and Related Disorders | Bipolaire-stemmingsstoornissen |
| `depressive` | Depressive Disorders | Depressieve-stemmingsstoornissen |
| `anxiety` | Anxiety Disorders | Angststoornissen |
| `ocd` | Obsessive-Compulsive and Related Disorders | Obsessieve-compulsieve en verwante stoornissen |
| `trauma_stressor` | Trauma- and Stressor-Related Disorders | Trauma- en stressorgerelateerde stoornissen |
| `dissociative` | Dissociative Disorders | Dissociatieve stoornissen |
| `somatic` | Somatic Symptom and Related Disorders | Somatische-symptoomstoornis en verwante stoornissen |
| `eating` | Feeding and Eating Disorders | Voedings- en eetstoornissen |
| `elimination` | Elimination Disorders | Stoornissen in de zindelijkheid |
| `sleep` | Sleep-Wake Disorders | Slaap-waakstoornissen |
| `sexual_dysfunction` | Sexual Dysfunctions | Seksuele disfuncties |
| `gender_dysphoria` | Gender Dysphoria | Genderdysforie |
| `impulse_control` | Disruptive, Impulse-Control, and Conduct Disorders | Disruptieve, impulsbeheersings- en andere gedragsstoornissen |
| `substance` | Substance-Related and Addictive Disorders | Middelgerelateerde en verslavingsstoornissen |
| `neurocognitive` | Neurocognitive Disorders | Neurocognitieve stoornissen |
| `personality` | Personality Disorders | Persoonlijkheidsstoornissen |
| `paraphilic` | Paraphilic Disorders | Parafiele stoornissen |
| `other_mental` | Other Mental Disorders | Overige psychische stoornissen |
| `medication_induced` | Medication-Induced Movement Disorders | Bewegingsstoornissen en andere bijwerkingen van medicatie |
| `other_conditions` | Other Conditions | Andere problemen die een reden voor zorg kunnen zijn |

**Neurodevelopmental subtypes:**

| Key | EN | NL |
|-----|----|----|
| `adhd` | ADHD | ADHD |
| `autism` | Autism Spectrum Disorder | Autismespectrumstoornis (ASS) |
| `intellectual_disability` | Intellectual Disability | Verstandelijke beperking |
| `learning` | Specific Learning Disorder | Specifieke leerstoornis |
| `communication` | Communication Disorders | Communicatiestoornissen |
| `motor` | Motor Disorders | Motorische stoornissen |

## Visuals

### Person node badges

Triangles, rendered via `clip-path: polygon(50% 0%, 100% 100%, 0% 100%)` at 10px size. Displayed after life event badges in the badge row (max 8 badges total across all three types).

Color by status:
- `--color-classification-suspected` -- amber/muted (e.g. `#fbbf24`)
- `--color-classification-diagnosed` -- cool/solid (e.g. `#38bdf8`)

Tooltip: DSM category name (+ subcategory if set), status, diagnosis year, active periods.

### Timeline view

Each classification renders as a thin colored strip along the bottom edge of the person's life bar, spanning the period's start to end year. Color matches the status (suspected/diagnosed). Multiple classifications stack as parallel strips.

A triangle marker is placed at the diagnosis year (for diagnosed classifications) to visually distinguish from circles (trauma) and diamonds (life events).

Hover tooltip: DSM category, status, period range.

## Files to modify

### Backend

| File | Change |
|------|--------|
| `api/app/models/classification.py` | New model: `Classification(id, tree_id, person_ids, encrypted_data, created_at, updated_at)` |
| `api/app/models/tree.py` | Add `classifications` relationship with cascade delete |
| `api/app/schemas/classification.py` | `ClassificationCreate`, `ClassificationUpdate`, `ClassificationResponse` |
| `api/app/routers/classifications.py` | Standard CRUD under `/trees/{id}/classifications` |
| `api/app/routers/sync.py` | Add `classifications_create/update/delete` to sync request/response |
| `api/app/schemas/sync.py` | Add classification sync schemas |
| `alembic/versions/xxx_add_classifications.py` | Migration for new table |

### Frontend types and API

| File | Change |
|------|--------|
| `types/domain.ts` | Add `Classification`, `ClassificationPeriod`, `ClassificationStatus` enum |
| `types/api.ts` | Add `ClassificationCreate/Update/Response`, sync types |
| `lib/api.ts` | Add CRUD functions + update sync |
| `lib/classificationColors.ts` | Two-color map keyed by status |
| `lib/dsmCategories.ts` | Category keys and subcategory mapping (labels from i18n) |

### Frontend components

| File | Change |
|------|--------|
| `components/tree/PersonNode.tsx` | Add triangle badges after life event badges |
| `components/tree/PersonNode.css` | Add `.person-node__badge--classification` with triangle clip-path |
| `components/tree/PersonDetailPanel.tsx` | Add Classifications section with two-level DSM select, status toggle, diagnosis year, periods editor |
| `components/tree/DsmSelect.tsx` | New searchable two-level select component |
| `components/tree/DsmSelect.css` | Styles for the searchable select |
| `components/timeline/TimelineView.tsx` | Add bottom border strips on life bars + triangle markers |

### Hooks

| File | Change |
|------|--------|
| `hooks/useTreeData.ts` | Fetch and decrypt classifications |
| `hooks/useTreeMutations.ts` | CRUD mutations for classifications |
| `hooks/useTreeLayout.ts` | Pass classifications through to PersonNode data |

### i18n

Add keys to both `locales/en/translation.json` and `locales/nl/translation.json`:

- `classification.classifications` -- section title
- `classification.newClassification` -- button label
- `classification.category` -- field label
- `classification.subcategory` -- field label
- `classification.status` -- field label
- `classification.status.suspected` / `classification.status.diagnosed`
- `classification.diagnosisYear` -- field label
- `classification.periods` -- field label
- `classification.addPeriod` / `classification.removePeriod`
- `classification.notes` -- field label
- `classification.confirmDelete`
- `classification.searchPlaceholder`
- `dsm.neurodevelopmental` through `dsm.other_conditions` -- 22 category labels
- `dsm.sub.adhd` through `dsm.sub.motor` -- 6 subcategory labels

### Theme

Add to both dark and light themes in `styles/theme.css`:

```css
--color-classification-suspected: #fbbf24;
--color-classification-diagnosed: #38bdf8;
```

## Encryption

Same zero-knowledge pattern as other entities. All classification content (DSM category, status, notes, periods) is encrypted client-side. Server sees only opaque blobs and person_ids (UUIDs). Passphrase change re-encryption flow in SettingsPanel already handles all entity types via bulk sync -- classifications are added to that loop.
