# Auto-Layout Animation and Position Undo

## Problem

The auto-layout button resets all pinned node positions and lets Dagre recompute the layout from scratch. Nodes teleport to new positions with no visual continuity, making it disorienting. There is also no way to revert accidental drags or an unwanted auto-layout reset.

## Design

### Position Undo Stack

A `usePositionHistory` hook maintains an in-memory stack of position snapshots. Each snapshot is a `Map<string, { x: number; y: number } | undefined>` capturing every person's pinned position (or `undefined` if unpinned) at that moment.

The stack is capped at 20 entries and only tracks position changes. Two operations push onto the stack:

- Before a drag completes (`onNodeDragStart`): saves the dragged node's current position
- Before auto-layout: saves all current positions

`undo()` pops the latest snapshot, applies it to the query cache optimistically, and persists each changed position to the backend using existing `updatePerson` mutations. A `canUndo` boolean drives the button's disabled state.

The stack lives in React state only. Navigating away or refreshing clears it.

### Animated Auto-Layout

When the user clicks auto-layout:

1. Push all current positions onto the undo stack
2. Remove pinned positions from persons (same as today)
3. Let Dagre compute new layout positions
4. Animate nodes from current canvas positions to new Dagre positions over ~300ms using CSS transitions (`transform 0.3s ease` on each node)
5. Persist the cleared positions to the backend

The user sees nodes sliding into place rather than teleporting. Undo restores the previously pinned positions.

### UI

- Undo button in the tree toolbar: lucide `Undo2` icon, no label text, disabled when stack is empty
- Keyboard shortcut: `Cmd+Z` / `Ctrl+Z` when canvas is focused and no input/textarea has focus
- No redo (YAGNI)
- `tree.undo` translation key for the button title attribute (EN + NL)

## Files

### Create
- `frontend/src/hooks/usePositionHistory.ts`
- `frontend/src/hooks/usePositionHistory.test.ts`

### Modify
- `frontend/src/pages/TreeWorkspacePage.tsx`
- `frontend/public/locales/en/translation.json`
- `frontend/public/locales/nl/translation.json`

### Unchanged
- `useTreeLayout.ts`, `treeLayoutHelpers.ts` (layout computation unchanged)
- Backend (no changes; positions persist via existing `updatePerson` mutations)
