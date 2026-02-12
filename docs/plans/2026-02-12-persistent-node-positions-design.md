# Persistent Node Positions

## Problem

Node positions are computed by dagre on every render. When a user drags a node, the position is held in local React state only and lost on page reload. Users cannot arrange their family tree spatially.

## Design

### Data model

Add an optional `position` field to the `Person` domain type:

```typescript
interface Person {
  name: string;
  birth_year: number;
  // ... existing fields ...
  position?: { x: number; y: number };
}
```

Position is stored inside the existing encrypted person blob. No API changes. The server remains a dumb blob store.

A person with `position` set is "pinned." A person without it is "unpinned" and gets auto-positioned by dagre.

### Layout logic (useTreeLayout)

1. Run dagre on the full graph as today to compute a base layout.
2. After dagre runs, override positions for pinned nodes with their stored `position`.
3. Unpinned nodes keep dagre-computed positions.

New nodes always start unpinned with a dagre position until the user drags them.

### Drag-to-pin flow (TreeWorkspacePage)

Listen for `onNodeDragStop` on the React Flow component. When fired:

1. Read the node's new position from the event.
2. Look up the current person data from the persons Map.
3. Call `updatePerson.mutate()` with existing data plus the new position.

Use `queryClient.setQueryData` for optimistic cache update instead of query invalidation. This avoids a flash where dagre would snap the node back to its computed position before the refetched data arrives.

### Auto-layout button

A secondary toolbar button ("Auto-layout") that clears all pinned positions:

1. Collect all persons with a `position` set.
2. Fire `updatePerson` calls in parallel with position removed.
3. After completion, invalidate the persons query. Dagre recomputes everything.

Only enabled when at least one person has a pinned position.

No confirmation dialog -- the action is easily reversible by dragging nodes back.

## Scope

- 1 type change: Person gets optional position
- 1 hook change: useTreeLayout respects pinned positions
- 1 page change: TreeWorkspacePage adds onNodeDragStop + auto-layout button
- 0 API changes
- 2 i18n keys: tree.autoLayout (EN: "Auto-layout", NL: "Automatisch rangschikken")
