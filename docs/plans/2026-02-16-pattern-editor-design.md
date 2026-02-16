# Pattern Editor Design

## Purpose

Annotation layer linking events, life events, and classifications across generations to mark recurring themes. The moment the tree stops being a diagram and becomes an insight tool.

## Data Model

### Decrypted (client-side)

```typescript
interface Pattern {
  name: string;             // e.g., "Addiction cycle"
  description: string;      // Free text reflection
  color: string;            // Palette pick, e.g., "#818cf8"
  linked_entities: LinkedEntity[];
}

interface LinkedEntity {
  entity_type: "trauma_event" | "life_event" | "classification";
  entity_id: string;        // UUID of the linked entity
}
```

### Encrypted (server-side)

Same zero-knowledge approach as all other entities:

- `Pattern` table: `id (UUID PK)`, `tree_id (UUID FK, indexed)`, `encrypted_data (Text)`, `created_at`, `updated_at`
- `PatternPerson` junction table: `pattern_id + person_id` composite PK, both FK with CASCADE delete

The `person_ids` for a pattern are derived client-side from the linked entities' person associations. If a pattern links trauma event A (on persons 1, 2) and classification B (on person 3), the pattern's `person_ids` is `[1, 2, 3]`.

### Color Palette

Eight curated colors that work on both dark and light themes:

```typescript
const PATTERN_COLORS = [
  "#818cf8", // indigo
  "#f472b6", // pink
  "#fb923c", // orange
  "#facc15", // yellow
  "#34d399", // emerald
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#f87171", // red
];
```

## UI: PatternPanel (slide-out on canvas)

Primary interface for creating and editing patterns. Triggered from a new toolbar icon (connected-dots/link-chain) on the canvas.

### Panel layout (top to bottom)

1. **Header**: "Patterns" title + "Add pattern" button
2. **Pattern list**: Compact rows -- color dot, name, entity count, visibility toggle (eye icon), expand chevron
3. **Expanded edit state** (inline, when editing):
   - Name input
   - Description textarea
   - Color picker: 8 swatches in a row, click to select
   - Linked entities list: chips showing type icon (circle/square/triangle), person name, entity title, X to unlink
   - "Link entity" button: enters linking mode
   - Save / Cancel / Delete

### Entity linking flow

Two methods, both available simultaneously:

1. **Click on canvas**: Click any entity badge on a person node. The badge gets a highlight ring, entity is added to the pattern.
2. **Pick from list**: Collapsible list in the panel grouped by person, showing all their events/life events/classifications. Click to add.

### Visibility toggle

Eye icon per pattern controls whether connector lines are drawn on the canvas. Local component state, not persisted. All off by default on page load.

## UI: Canvas Connector Lines

When a pattern's visibility is toggled on, colored connector lines appear between person nodes containing linked entities.

### Line style

- Dashed (4px dash, 4px gap) in the pattern's color
- 2px stroke width (thinner than relationship edges)
- 0.6 opacity at rest, 1.0 on hover
- Rendered as SVG overlay, below relationship edges, above canvas background

### Routing

Straight lines between centers of connected person nodes. No Dagre routing -- patterns cross the tree freely. If two entities are on the same person, no line is drawn.

### Interaction

- Hover: tooltip showing pattern name
- Click: opens PatternPanel scrolled to that pattern
- Multiple visible patterns: lines from different patterns offset by 3px to stay distinguishable

### No changes to PersonNode

Badges remain unchanged. Pattern connections are communicated entirely through the overlay lines.

## UI: Pattern View (dedicated tab)

Third view alongside Canvas and Timeline. URL: `/trees/{id}/patterns`. Read-only reflection view.

### Tab bar

Existing Canvas/Timeline toggle gains a third option: "Patterns" with a connected-dots icon.

### Empty state

Centered message: "No patterns yet. Patterns help you see connections across generations." + "Create your first pattern" button navigating to canvas with PatternPanel open.

### Card grid

Responsive: 1 column mobile, 2 tablet, 3 desktop. Each card:

- **Header**: color dot + name + entity count badge
- **Description**: first 2-3 lines, truncated
- **Entity summary**: grouped by person (name bold, indented entity titles with type icon). Max 4 shown, "+N more" overflow.
- **Footer**: "Spans N generations" computed from linked persons' birth years

### Card expand

Click opens full-width detail (replaces grid, back arrow). Full description, all linked entities, "Edit on canvas" button navigating to canvas with PatternPanel focused on that pattern.

No inline editing in this view. All editing goes through PatternPanel on the canvas.

## Backend

### Model

New `Pattern` model + `PatternPerson` junction table, following TraumaEvent/EventPerson structure exactly. Tree model gains `patterns: Mapped[list[Pattern]]`.

### API

- `GET /trees/{id}/patterns` -- fetch all patterns for a tree
- Sync endpoint extended: `patterns_create`, `patterns_update`, `patterns_delete` added to SyncRequest. Same validation (person_ids must exist in tree), same transaction.

No new REST CRUD routes. Patterns go through bulk sync like everything else.

### Passphrase change

Re-encryption flow in SettingsPanel iterates patterns alongside existing entity types.

## Frontend Integration

### Hooks

- `useTreeData`: extended to fetch/decrypt patterns. New state: `patterns: Map<string, DecryptedPattern>`.
- `useTreeMutations`: new `savePattern(pattern, personIds)` and `deletePattern(patternId)`.

### Components

- `PatternPanel.tsx` + CSS -- slide-out panel
- `PatternConnectors.tsx` -- SVG overlay for canvas connector lines
- `PatternView.tsx` + CSS -- card grid view

### Modified files

- `useTreeData.ts`, `useTreeMutations.ts` -- pattern data/mutations
- `TreeWorkspacePage.tsx` -- panel toggle, view tabs, pass pattern data
- `api/app/routers/sync.py` -- sync handler
- `api/app/schemas/sync.py` -- request/response types
- `api/app/models/tree.py` -- relationship
- `frontend/src/types/domain.ts`, `api.ts` -- types
- `frontend/src/locales/en/translation.json`, `nl/translation.json` -- i18n
- `frontend/src/components/tree/SettingsPanel.tsx` -- re-encryption loop

## i18n

New `pattern.*` namespace in both EN and NL:

- Panel: title, add, edit, delete, link entity, linking instructions
- View: tab label, empty state, generation span, entity count
- Colors: accessible labels for the 8 palette options
- Errors: validation messages
