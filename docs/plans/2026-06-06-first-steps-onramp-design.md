# First steps: a first-run on-ramp design

Date: 2026-06-06

## Problem

Too many people register and then stop. The admin funnel
(`GET /admin/stats/funnel`: registered -> verified -> created_tree ->
added_person -> added_relationship -> added_event) and the user table show the
real shape of it (sample of ~13 accounts, 2 of which are our own/seed):

- Signup -> verification is **not** the leak (12/13 verify).
- **Cliff 1 - activation:** roughly half of verified users build *nothing*
  (0 trees, "last active: n/a"). They get in and vanish.
- **Cliff 2 - value:** of those who do build a tree, essentially no real user
  ever adds a trauma **event** - the actual point of the product. People add a
  few relatives, maybe a relationship, and stop right before the value.

The canvas already has an `EmptyCanvasState` with an "Add person" button, so the
gap is not "no CTA." It is (a) the first decision ("who do I even start with?")
and (b) the silence *after* the first node - one person on a canvas is its own
mini blank-state, with no cue toward relationships, events, or what the badges
mean.

## Goal and non-goals

**Goal:** a calm, low-risk first-run that removes blank-canvas paralysis -
"competence, not catharsis." The user should always know the next obvious action
and be able to stop at any time.

**Explicit non-goal (for v1):** chasing an emotional "aha" or intergenerational
pattern on run one. The subject matter is heavy; run one is about orientation
and de-risking, not catharsis. The pattern/insight remains the natural *next*
thing, surfaced by the product elsewhere.

## Concept: "First steps"

Two cooperating parts, shown only on a user's first real (non-demo) tree:

1. **(C) A pre-seeded placeholder node** - the canvas opens with one faded
   "ghost" slot instead of a blank/empty screen.
2. **(A) A contextual next-step rail** - a quiet card that shows one next action
   at a time and advances as the user acts.

**Triggers** when: the current tree is non-demo *and* the global "done" flag is
unset *and* the tree has not yet hit all milestones. Never on demo trees, never
on later trees once finished.

**Retires permanently** the moment either happens: the user completes the three
core milestones (first person, first relationship, first event/badge) *or* taps
"I've got it." No re-nagging.

**Tone:** nothing blocks, nothing spotlights, nothing bounces; every element is
one-tap dismissible; copy is calm and non-urgent (brand voice).

## (C) The pre-seeded placeholder node

- A **synthetic, UI-only** element - never encrypted, never persisted, never
  sent to the server (a no-op for the zero-knowledge model). Implemented as a
  **variant of the existing centered `EmptyCanvasState` overlay**, *not* a React
  Flow node, so there is no dagre/layout interference.
- **Look:** visually distinct from a real `PersonNode` - dashed/muted border, a
  person-outline or "+" glyph, faded. Reads as *a slot*, not a person. Centered
  in the viewport, where the eye lands.
- **Tap -> commit:** opens the existing add-person panel (`onAddPerson`), name
  field focused. On a successful add, the real node replaces it.
- **"x" -> skip:** an always-visible dismiss removes the slot **instantly, no
  confirmation** (nothing to clean up). The canvas falls back to today's plain
  `EmptyCanvasState` (still an obvious "Add person" CTA, just no guided ghost).
  Making the seed trivially deletable is a hard requirement.
- **First-decision de-risk:** the slot's label is the gentle "who do I start
  with?" answer, e.g. *"Start with anyone - you, a parent, a grandparent."* No
  presumption of self-start.
- **Inert:** non-draggable, non-connectable; ignored by pan/zoom and layout.
  Adding a person via the toolbar also clears it (>=1 person => retired).

## (A) The next-step rail

**Division of labour:** the ghost owns step 1 (place the first node); the rail
owns "now what," appearing only once **>=1 person exists** - so two things never
shout "add a person."

**Steps (derived live from `useTreeData` counts - no stored progress):**

| State | Rail copy (intent) |
|-------|--------------------|
| 1 person, 0 relationships | "Connect someone to them - drag from the dot on the node, or use +." (teaches relationships) |
| >=1 relationship, 0 events | "Mark something that shaped them - open a person and add an event. The small circles on a node are events." (teaches badges, points at the core) |
| all three done | "You've got the basics - explore at your own pace," then retires. |

Because the step is **computed from the data**, a returning user who already has
people/relationships/events simply never sees it - no nagging, no migration.

**Persistence:** the only thing worth remembering is an *early* "I've got it"
dismissal (before completing). Use a **localStorage** flag `tt.firstSteps.done`
- zero backend change, per-device. If someone dismisses on one device and opens
an unfinished tree on another, it gently reappears; acceptable for v1.
(Alternative: reuse the server-side onboarding-flag pattern for cross-device, at
the cost of a small API/field - skipped for v1.)

**Placement & style:** a small, quiet card reusing the `ReflectionNudge` look,
pinned bottom-left **above** the `BranchDecoration`, clear of the right-side
panels, z-index below panels/modals, compact on small screens. It holds a
one-line step, a faint "n of 3" progress hint, and an "I've got it" dismiss.
Standard fade only.

## Architecture and components

All frontend. **No backend/API/model change.** Zero-knowledge untouched (the
ghost is UI-only; milestone counts come from already-decrypted in-memory
`useTreeData`).

1. **`useFirstSteps()` hook** - single source of truth. Inputs: `useTreeData`
   counts (persons/relationships/events), the current tree's `is_demo`, and the
   localStorage flag. Returns
   `{ showGhost, step, removeGhost, dismiss }` where
   `step in 'relationship' | 'event' | 'done' | null`. Logic: show only when
   `!is_demo && !done`; derive `step` from counts; `dismiss()` or reaching
   `done` sets the flag so it never returns.
2. **Ghost** - a variant of `EmptyCanvasState` (centered overlay) rendered when
   `showGhost`; x calls `removeGhost()` and falls back to the plain empty state;
   tapping the slot calls the existing `onAddPerson`.
3. **`<FirstStepsRail>`** - a small bottom-left corner card reusing
   `ReflectionNudge`'s styling/markup, rendered when `step` is
   `relationship`/`event`/`done`. Props: `step`, `onDismiss`.
4. **Wiring in `TreeWorkspacePage`:** call `useFirstSteps()`; swap the
   empty-state for the ghost variant when `showGhost`; mount `<FirstStepsRail>`
   otherwise. That is the entire integration surface.
5. **i18n:** a new flat `firstSteps.*` key group in `en` + `nl`.

## Edge cases

- *Demo tree* -> never shows (`is_demo` guard); demo stays a separate "explore"
  path.
- *Returning user with data* -> `done` derives immediately, nothing renders, no
  migration.
- *Second empty tree before finishing the first* -> can reappear (keyed to
  current-tree counts + global `done`). Acceptable for v1.
- *Deletes back to 0 people* -> ghost returns only if not yet `done`.
- *Toolbar add* clears the ghost. *localStorage cleared / new device* -> may
  gently reappear if the tree is still unfinished.

## Accessibility

- The ghost slot is a real `<button>` with an `aria-label`; the x is a separate
  labelled button; both keyboard-activable.
- The rail is a quiet labelled region with a labelled "I've got it" button - no
  aggressive live announcements, standard fade only.
- All copy via i18n with EN + NL parity (enforced by lint).

## Testing

- **Unit** - `useFirstSteps` truth table: counts + `is_demo` + flag ->
  `{showGhost, step}`; dismiss sets the flag.
- **Component** - ghost renders; tap -> `onAddPerson`; x -> fallback; rail shows
  correct step copy and dismisses.
- **E2E (Playwright)** - fresh user -> ghost -> add person -> relationship step
  -> event step -> retires; demo tree -> nothing. Use role/text selectors, not
  brittle CSS.
- **Visual** - placement needs a human eyeball before merge (cannot be rendered
  in tests).

## How we will know it worked

The existing funnel is the scoreboard: watch verified -> `added_person` and
especially -> `added_event` rise. Optional later: a "first-steps
completed/dismissed" event for finer attribution.
