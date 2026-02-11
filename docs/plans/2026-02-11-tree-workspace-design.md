# Tree Workspace Design

The main working view where users visualize and edit their family tree. Built on React Flow with Dagre auto-layout, a custom PersonNode, styled relationship edges, and a slide-out detail panel.

## Page Structure & Routing

Route: `/trees/:id` (auth-guarded). User navigates here from `TreeListPage`.

Three layers in a full-viewport layout:

- **Top toolbar** -- Tree name, "Add person" button, "Timeline" link, logout. Single compact row.
- **Canvas** -- React Flow filling remaining viewport. Pan, zoom, dot grid background. Dagre auto-layout positions nodes top-to-bottom.
- **Detail panel** -- Slides in from the right (~400px fixed width) when a person node is selected. Canvas shrinks to accommodate (no overlay). Closes on Escape or clicking empty canvas.

## Data Loading & Decryption

On mount, three parallel TanStack Query calls: `getPersons`, `getRelationships`, `getEvents`. Each returns `{ id, encrypted_data }` arrays. Decrypted in the query functions using `decrypt()` from EncryptionContext. Cached data is already decrypted.

Decrypted state held as three ID-keyed maps:

- `persons: Map<string, Person & { id }>`
- `relationships: Map<string, RelationshipData & { id, source_person_id, target_person_id }>`
- `events: Map<string, TraumaEvent & { id, person_ids }>`

Mutations encrypt before sending to the API, then invalidate the query cache to trigger refetch. No local state divergence.

Loading state: centered spinner. Decryption failure: error message with link to login.

## React Flow Canvas & Dagre Layout

A `useTreeLayout` hook converts persons and relationships into React Flow `Node[]` and `Edge[]`.

Each person becomes a node of type `"person"`. Each relationship becomes an edge with styling based on type (solid for biological, dashed for step/adoptive, distinct style for partner).

Dagre configuration:

- `rankdir: "TB"` (top-to-bottom)
- `ranksep: 100` (vertical gap between generations)
- `nodesep: 60` (horizontal gap between siblings)
- Partner pairs constrained to same rank

Layout recalculates on every change to persons or relationships. Positions are never persisted -- always derived.

Canvas: `fitView` on load, `nodesDraggable={false}`, pan and zoom enabled.

## PersonNode

Custom React Flow node (~180px wide card):

- **Name** -- bold primary text
- **Years** -- "1945 - 2020" or "1945 -" for living
- **Adoption label** -- "(adopted)" when `is_adopted` is true
- **Trauma badges** -- colored dots along bottom, one per event, color-coded by category

Connection handles:

- **Top** (target) -- incoming parent edges
- **Bottom** (source) -- outgoing child edges, also drag source for creating relationships
- **Left/Right** -- partner edges (horizontal connections)

Interaction: click to select (opens detail panel), selected state shows highlighted border, hover shows elevation change.

## PersonDetailPanel

Fixed-width (400px), right-anchored, slides in/out. Three collapsible sections:

**Person details (open by default):** Name, birth year, death year, gender, adopted, notes. Save and delete buttons. Delete has confirmation.

**Relationships (collapsed):** Lists all relationships grouped by type. Shows other person's name, type, partner periods. "Add relationship" button as alternative to canvas dragging.

**Trauma events (collapsed):** Lists events with title, category badge, date, severity. Click to expand for inline editing. "Add event" button for new events.

## Creating Persons & Relationships

**New person:** Toolbar "Add person" button. Creates person with default data, sends to API, appears on canvas, detail panel opens.

**New relationship:** Primary method is drag-to-connect from a node's bottom handle to another node. A popover asks for relationship type (and initial period for partners). Alternative: "Add relationship" button in the detail panel. Both encrypt and save to API.

## File Structure

```
frontend/src/
  pages/
    TreeWorkspacePage.tsx    -- Orchestrates data loading + layout
    TreeListPage.tsx         -- Updated: fetch trees, link to workspace
  components/
    tree/
      TreeCanvas.tsx         -- React Flow instance + toolbar
      PersonNode.tsx         -- Custom node
      PersonDetailPanel.tsx  -- Slide-out panel
      RelationshipEdge.tsx   -- Custom edge with style variants
      TraumaEventForm.tsx    -- Inline event editor
      RelationshipForm.tsx   -- Popover for new relationships
  hooks/
    useTreeData.ts           -- TanStack Query: fetch + decrypt
    useTreeLayout.ts         -- Dagre: data -> positioned nodes + edges
    useTreeMutations.ts      -- Encrypt + save mutations
  lib/
    traumaColors.ts          -- Category -> color map
```

## Out of Scope

- Timeline view (future work)
- Pattern editor (deferred per spec)
- Multiple trees per user (MVP: single tree)
- Manual node positioning (auto-layout only)
