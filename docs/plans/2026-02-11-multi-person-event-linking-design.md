# Multi-Person Event Linking

## Problem

Trauma events often affect multiple family members (war, displacement, a family loss), but the current UI only links new events to the single selected person and never shows or allows editing of person linkage.

## Design

### Data flow

No backend, hook, or API changes needed. `EventCreate` and `EventUpdate` already accept `person_ids`, and `useTreeMutations` already passes `personIds` through. Changes are UI-only.

### EventForm changes

The `EventForm` component receives two new props:

- `allPersons: Map<string, DecryptedPerson>` -- all persons in the tree
- `initialPersonIds: string[]` -- pre-checked persons (new event: `[selectedPerson.id]`; existing event: `event.person_ids`)

The form holds `selectedPersonIds: Set<string>` in local state, initialized from `initialPersonIds`.

A checkbox list renders all persons sorted by name, between the tags field and the action buttons, under a "Linked persons" label.

Save is disabled when `selectedPersonIds` is empty (at least one person must be linked). If only one person is checked, unchecking it is a no-op.

On save, the form passes `Array.from(selectedPersonIds)` as the person IDs instead of echoing back the original set.

### i18n

- `trauma.linkedPersons`: "Linked persons" (en) / "Gekoppelde personen" (nl)

### Files changed

- `frontend/src/components/tree/PersonDetailPanel.tsx`
- `frontend/src/locales/en/translation.json`
- `frontend/src/locales/nl/translation.json`
