# Relationship Prompt After Person Creation

## Overview

When a user creates a new person and closes the detail panel, a toast prompt asks whether to connect them to an existing person. If yes, the toast expands inline to let the user pick a target person and relationship type, then creates the relationship and dismisses. Controlled by the `promptRelationship` canvas setting (default: on).

## Flow

1. User clicks "Add person", detail panel opens with the new person selected.
2. User fills in details (name, birth year, etc.) and closes the panel by any means (Save, Close, click pane, Escape).
3. If the tree has 2+ persons and the `promptRelationship` setting is on, the toast appears at bottom-center.
4. **Ask step**: "Connect [name] to someone?" with Yes/No buttons.
5. **Pick person step**: toast expands to show all other persons (name + birth year for disambiguation).
6. **Pick type step**: toast shows relationship type options with a direction indicator and swap button for parent types.
7. User selects a type: relationship is created, toast dismisses.
8. No or Cancel at any step: toast dismisses.

## Trigger timing

The prompt does not appear immediately on person creation. It appears when `selectedPersonId` becomes `null` while `relationshipPromptPersonId` is still set (i.e., when the detail panel closes). If the user selects a different person before closing, the prompt is cleared silently.

## Component design

`RelationshipPrompt` has an internal `step` state with three phases: `ask`, `pickPerson`, `pickType`.

Props:

```ts
{
  person: DecryptedPerson;
  allPersons: Map<string, DecryptedPerson>;
  onCreateRelationship: (sourceId: string, targetId: string, type: RelationshipType) => void;
  onDismiss: () => void;
}
```

The component handles all step transitions internally. Direction (source/target) for parent types uses a smart default: if birth years are available and differ, the older person becomes the source. A swap button lets the user flip it. Non-directional types (sibling, partner, friend) don't show the swap button.

## Visual design

All three steps render in the same fixed-bottom-center toast container. The card grows vertically as needed, with `max-height: 50vh` and overflow scroll for large trees.

**Ask step** (compact, single row):

```
Connect Alice to someone?   [Yes] [No]
```

**Pick person step** (scrollable list):

```
Connect Alice to:             [Cancel]
------------------------------------------
  Bob (1965)
  Carol (1990)
  David
```

**Pick type step** (direction header + type buttons):

```
Alice -> Bob           [Swap] [Cancel]
------------------------------------------
  Alice is biological parent of Bob
  Alice is step-parent of Bob
  Alice is adoptive parent of Bob
  Biological sibling
  Step-sibling
  Partner
  Friend
```

Person rows and type buttons are styled like `.relationship-popover__option` (existing pattern). The swap button reuses the popover swap style. Step transitions are instant (no extra animation). The initial appearance uses the existing `relationship-prompt-in` slide-up animation.

## Implementation

### TreeWorkspacePage.tsx

- Remove the immediate trigger in `handleAddPerson`'s `onSuccess`. Instead, only store the new person's ID in `relationshipPromptPersonId`.
- Change render condition to `relationshipPromptPersonId && !selectedPersonId && !selectedEdgeId`.
- Auto-dismiss effect: clear `relationshipPromptPersonId` if the user selects a different person or if `persons.size < 2`.
- Expand `RelationshipPrompt` props and wire `onCreateRelationship` to `mutations.createRelationship.mutate`.

### TreeCanvas.css

- `.relationship-prompt__list`: scrollable container (`max-height: 50vh`, `overflow-y: auto`).
- `.relationship-prompt__item`: clickable rows (reuse popover option look).
- `.relationship-prompt__header`: direction row in the type step.
- `.relationship-prompt__swap`: swap button (reuse popover swap style).

### Translation keys

- `relationship.promptConnectTo`: "Connect {{name}} to:" / "{{name}} koppelen aan:"

No other files change. The `useCanvasSettings` and `SettingsPanel` changes from the previous commit stay as-is.
