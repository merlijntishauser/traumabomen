# Demo Tree Feature

## Purpose

Allow users to create a pre-populated demo tree as a sandbox for exploring the app's features (timeline, patterns, filtering) without entering personal data first. Each user gets their own encrypted copy they can freely edit.

## Design

### Data model

Add `is_demo: bool` column to the `Tree` model (default `False`). The `POST /trees` schema gets an optional `is_demo` field. The `GET /trees` response includes `is_demo` so the frontend can enforce limits and show badges.

Admin stat queries filter with `Tree.is_demo.is_(False)` to exclude demo trees from funnel and usage metrics.

### Fixture generation

A Python script (`scripts/generate_demo_fixture.py`) uses Faker to produce two static JSON fixtures:

- `frontend/src/fixtures/demo-tree-en.json` (English names, descriptions)
- `frontend/src/fixtures/demo-tree-nl.json` (Dutch names, descriptions)

Each fixture contains plaintext data structured as:

```
treeName: string
persons: array (with stable IDs like "demo-p1")
relationships: array (referencing person IDs)
events: array (trauma events with person_ids)
lifeEvents: array (life events with person_ids)
classifications: array (with periods, person_ids)
patterns: array (with linked_entities referencing event/classification IDs)
```

The fixture includes:

- 3 generations: grandparents (2), parents (3+), children (2+)
- Partner relationships with periods (married, separated, etc.)
- Trauma events across all 7 categories
- Life events across multiple categories
- Classifications: both suspected and diagnosed, with periods
- Pattern 1: cross-generational trauma pattern (e.g., addiction or loss recurring)
- Pattern 2: ASD (autism spectrum disorder) linking a grandmother and her granddaughter

Run the script once, commit the output. Re-run only when the fixture needs updating.

### Frontend creation flow

When the user clicks "Create demo tree":

1. Load the fixture matching the active language (en/nl)
2. Create the tree via `POST /trees` with `is_demo: true` and encrypted tree name
3. Generate real UUIDs for all entities, mapping fixture IDs to UUIDs
4. Encrypt each entity with the user's encryption key
5. Bulk sync all entities via `POST /trees/{id}/sync`
6. Navigate to the new tree workspace

### Limits

Maximum 3 demo trees per user. Checked client-side by counting `is_demo === true` trees from the tree list. Button disabled at the limit with explanatory text.

### UI

- "Create demo tree" button on tree list page, secondary button style, next to "Create"
- Demo trees in the list show a small "Demo" badge next to the tree name
- Inside the tree workspace, the demo tree behaves identically to a regular tree
- Tree name: "Demo: Sandbox with fake data!" (or Dutch equivalent)

## Files

### New files

| File | Purpose |
|------|---------|
| `scripts/generate_demo_fixture.py` | Faker script to generate locale-specific fixtures |
| `frontend/src/fixtures/demo-tree-en.json` | English demo data |
| `frontend/src/fixtures/demo-tree-nl.json` | Dutch demo data |
| `frontend/src/lib/createDemoTree.ts` | Function: load fixture, generate UUIDs, encrypt, sync |
| `alembic/versions/xxx_add_tree_is_demo.py` | Migration adding `is_demo` column |

### Modified files

| File | Changes |
|------|---------|
| `api/app/models/tree.py` | Add `is_demo: bool` column |
| `api/app/routers/trees.py` | Accept `is_demo` in create schema, include in response |
| `api/app/routers/admin.py` | Filter demo trees from stat queries |
| `frontend/src/pages/TreeListPage.tsx` | Add "Create demo tree" button, demo badge, limit check |
| `frontend/src/types/api.ts` | Add `is_demo` to tree API types |
| `frontend/src/locales/en/translation.json` | i18n keys for demo tree UI |
| `frontend/src/locales/nl/translation.json` | Dutch translations |
