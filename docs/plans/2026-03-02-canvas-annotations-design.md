# Canvas Annotations Design

## Problem

The app lacks a way to capture spatial observations directly on the canvas. Patterns link entities across generations, but sometimes the insight is positional: "this side of the family had more trauma" or "these three people lived together." Free-positioned sticky notes fill this gap without the overhead of the pattern editor.

## Solution

Sticky notes that users can place anywhere on the canvas. Text content encrypted client-side, position stored in plaintext. Rendered as a second React Flow custom node type alongside PersonNode. Six muted colors for visual grouping.

## Data model

### Annotation model (new)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tree_id` | UUID FK -> trees | CASCADE delete |
| `encrypted_data` | Text | Contains `{ text, color }` |
| `position_x` | Float | Plaintext, for canvas layout |
| `position_y` | Float | Plaintext, for canvas layout |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

Position is plaintext because it has no semantic meaning without the note text. This matches how `person_ids` on events are stored unencrypted for structural integrity.

### Encrypted data structure

```typescript
interface AnnotationData {
  text: string;
  color: "sage" | "linen" | "lavender" | "rose" | "sky" | "honey";
}
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/trees/{id}/annotations` | List all annotations |
| `POST` | `/trees/{id}/annotations` | Create annotation |
| `PUT` | `/trees/{id}/annotations/{ann_id}` | Update text, color, or position |
| `DELETE` | `/trees/{id}/annotations/{ann_id}` | Delete annotation |

Same ownership enforcement as other entities via `get_owned_tree`. Also added to the bulk sync endpoint.

Shared tree viewers can GET annotations but not create, update, or delete (via `get_readable_tree` for reads, `get_owned_tree` for writes).

## React Flow integration

### AnnotationNode component

Registered as `annotation` in the `nodeTypes` map alongside `person`. Fixed width of 160px, auto-height based on text. Draggable and selectable, but no connection handles (no edges to/from annotations). Z-index below person nodes so notes do not obscure family members.

### Two states

**View mode** (default): rendered text. Single click selects (shows delete button). Double-click enters edit mode.

**Edit mode**: text becomes a `<textarea>` with auto-resize. Color dots appear below (6 circles, selected one has accent ring). Click outside or Escape saves and exits.

### Position persistence

On drag stop: `PUT /trees/{id}/annotations/{ann_id}` with new position. Optimistic cache update via React Query, same pattern as person position updates.

### Creation

Two paths:

1. **Double-click empty canvas**: check hit target is the React Flow pane (not a node), create annotation at click coordinates in edit mode with empty text and default color (sage). If user clicks away with empty text, the annotation is discarded.
2. **Toolbar button**: "Add note" (StickyNote icon) next to "Add person". Creates note at visible viewport center in edit mode.

## Visual design

### Color palette

Six muted, translucent colors matching the forest theme:

| Name | RGB base | Feel |
|---|---|---|
| sage (default) | `45, 138, 94` | Forest green tint |
| linen | `180, 160, 130` | Warm parchment |
| lavender | `150, 120, 180` | Soft purple |
| rose | `180, 100, 120` | Muted pink |
| sky | `100, 150, 200` | Soft blue |
| honey | `200, 170, 60` | Post-it yellow |

Background: RGB at 0.15 opacity (dark theme) / 0.12 (light theme). Border: same RGB at 0.3 opacity. Translucent cards feel part of the canvas rather than floating above it.

### Color picker

6 circles (16px) in a row below the textarea in edit mode. Each dot uses solid RGB for visibility. Selected dot gets a 2px `--color-accent` ring. Hidden in view mode.

### Typography

Lato 13px, line-height 1.4, `white-space: pre-wrap`. Max visible height in view mode: 200px with fade-out gradient at bottom. Textarea in edit mode scrolls after ~300px.

### Delete button

Small X icon (14px), top-right, visible on selection only. `--color-text-muted` default, `--color-danger` on hover. No confirmation dialog.

### Drop shadow

Subtle: `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`.

## Toolbar and settings

### Toolbar

"Add note" button (StickyNote icon from Lucide) next to "Add person". Hidden in read-only mode for shared trees.

### Canvas settings

New toggle: "Show annotations" (default: on). When off, annotation nodes filtered out of React Flow nodes array. Useful when annotations clutter the view.

### Keyboard

- `Escape` while editing: save and exit edit mode
- `Delete`/`Backspace` while selected (not editing): delete note

## Read-only mode (shared trees)

Annotations visible but not editable, draggable, or deletable. No "Add note" button. Double-click on canvas does nothing.

## Testing

### Backend

- Annotation CRUD: create, read, update, delete
- Ownership enforcement: other user gets 404
- Bulk sync: annotations in sync request/response
- Shared tree: viewer can GET, cannot POST/PUT/DELETE
- CASCADE: deleting tree deletes annotations

### Frontend unit tests

- AnnotationNode: renders text and color, edit mode shows textarea and color dots, empty text discards on blur
- Color picker: selecting dot updates color, selected dot shows ring
- Node conversion: API responses to React Flow nodes with correct positions

### Frontend component tests

- Double-click empty canvas creates annotation, double-click on node does not
- Toolbar "Add note" creates annotation at viewport center
- Canvas settings toggle hides/shows annotations
- Read-only mode: no creation, editing, or deletion

## Files

### New
- `api/app/models/annotation.py`: SQLAlchemy model
- `api/app/routers/annotations.py`: CRUD endpoints
- `frontend/src/components/tree/AnnotationNode.tsx`: custom node
- `frontend/src/components/tree/AnnotationNode.css`: styles
- `frontend/src/lib/annotationColors.ts`: color palette

### Modified
- `api/app/routers/sync.py`: annotation support in bulk sync
- `frontend/src/pages/TreeWorkspacePage.tsx`: register node type, creation handlers
- `frontend/src/hooks/useTreeData.ts`: fetch annotations
- `frontend/src/hooks/useTreeMutations.ts`: annotation mutations
- Translation files: annotation keys

## Not included

- Arrows or connectors between annotations and nodes (future enhancement)
- Rich text formatting in notes (markdown, bold, etc.)
- Annotation grouping or layering
- Annotation search or filtering
