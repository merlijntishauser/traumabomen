# Full Birth/Death Dates

## Context

The app currently stores `birth_year` and `death_year` as integers. Users often know exact birth/death dates for recent generations (parents, grandparents) but only years for older ancestors. We want to support full dates while keeping year-only as a first-class fallback.

## Design decisions

- **Separate fields, not a date string.** Three fields per date (year, month, day) instead of an ISO date string. Maps directly to the UI, needs no parsing, avoids MM-DD vs DD-MM ambiguity entirely.
- **No backend changes.** Birth/death data lives inside the encrypted JSON blob. The server never sees it. Adding nullable fields to the client-side Person type is fully backwards-compatible with existing encrypted data.
- **No timeline changes.** The D3 timeline operates at year granularity, which is the right level for a generational view.
- **Precise age when possible.** When month+day are known, `formatAge` compares against today's date to determine if the birthday has passed this year. Year-only behavior stays as-is.

## Data model

Add four nullable fields to the `Person` interface in `frontend/src/types/domain.ts`:

```typescript
birth_year: number | null;    // existing
birth_month: number | null;   // 1-12, new
birth_day: number | null;     // 1-31, new
death_year: number | null;    // existing
death_month: number | null;   // 1-12, new
death_day: number | null;     // 1-31, new
```

Validation rules (UI-enforced):

- Year can exist alone (current behavior)
- Month requires year
- Day requires month and year

Existing encrypted data that only has `birth_year`/`death_year` remains valid. New fields default to `null` when absent from decrypted JSON. No re-encryption migration needed.

## Display

### PersonNode (tree canvas)

Nodes keep showing years only. Full dates would make nodes too wide. The age calculation gains precision when month/day are available:

- `1976 - (49)` -- born July 8 1976, birthday hasn't passed yet in Feb 2026
- `1976 - (50)` -- year-only, 2026-1976 = 50
- `1920 - 1995 (@ 75)` -- deceased, unchanged

### PersonDetailPanel (edit form)

Below the existing year input, two optional dropdowns appear inline:

```
Birth year:  [1976    ]
             [July v] [8 v]

Death year:  [1995    ]
             [March v] [12 v]
```

Month dropdown shows localized month names via `Intl.DateTimeFormat`. Day dropdown adjusts range based on selected month (28/29/30/31). Both default to empty/unselected.

Age hint gains precision when full date is known.

### Timeline view

No changes. Year granularity is correct for generational timelines.

## formatAge changes

Extend signature:

```typescript
export function formatAge(
  birthYear: number | null,
  deathYear: number | null,
  birthMonth?: number | null,
  birthDay?: number | null,
  deathMonth?: number | null,
  deathDay?: number | null,
): string | null
```

When month+day are available for both birth and the end point (death or today), compare month/day to determine if the birthday has passed, yielding an age that's accurate to the day rather than just the year.

## Files to change

1. `frontend/src/types/domain.ts` -- add 4 nullable fields to Person
2. `frontend/src/lib/age.ts` -- extend formatAge for month/day precision
3. `frontend/src/lib/age.test.ts` -- precision test cases
4. `frontend/src/components/tree/PersonNode.tsx` -- pass month/day to formatAge
5. `frontend/src/components/tree/PersonNode.test.tsx` -- test precise age display
6. `frontend/src/components/tree/PersonDetailPanel.tsx` -- month/day dropdowns for birth and death
7. `frontend/src/components/tree/PersonDetailPanel.test.tsx` -- test new inputs and save payload
8. `frontend/src/locales/en/translation.json` -- labels
9. `frontend/src/locales/nl/translation.json` -- labels
10. `frontend/src/hooks/useTreeData.ts` -- default missing month/day to null on decrypt

No changes needed: backend, database, migrations, timeline, tree layout helpers, API client, encryption module.
