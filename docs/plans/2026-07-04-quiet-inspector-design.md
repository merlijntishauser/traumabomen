# Quiet inspector design

Date: 2026-07-04
Status: implemented (all five phases, 2026-07-04)

## Problem

The detail panels (person, relationship, pattern, sibling group, events) read
as web forms inside an instrument: gray input boxes everywhere, explicit Save
buttons, number spinners for years, a `---` placeholder select for death year,
and dead vertical space. Worst of all, the person form silently discards
pending edits when the selected node changes (the UX-10 data-loss risk from
the roadmap).

The fix is a coherent inspector system built on two proven patterns from
canvas instruments (Figma, Linear, Notion): quiet fields and autosave.

## 1. Interaction model: autosave

A shared hook, `useAutosaveForm`, replaces the save-button plumbing:

- Draft state lives in the hook (same shape as today's form reducers).
- Commit on leave: text inputs and selects commit on blur/change; textareas
  debounce ~800ms and also commit on blur.
- Commit = today's save path exactly (encrypt full blob client-side, PUT).
  No new crypto surface, only a new trigger.
- Dirty-gate: commits fire only when the draft differs from the last-saved
  snapshot.
- Flush points (kills UX-10): pending edits flush before the form resets on
  person-switch, tab-switch, panel close, and unmount.
- Validation guard: a field invalid to persist (empty name, malformed year)
  does not commit; on blur it reverts to the last saved value. Rule: the
  server never receives a worse state than it has.
- Saved whisper: transient "Saved" in the panel header (muted, 12px, Lucide
  Check), opacity-only fade via `var(--transition-colors)`. Failed PUT shows
  a persistent "Couldn't save" in danger color; draft stays dirty and the
  next commit retries.
- Creation stays explicit: new sub-entities (trauma event, classification,
  relationship period) keep an explicit "Add" button. Autosave applies to
  editing existing things only.

## 2. Field grammar: the quiet inspector

Shared primitives in `frontend/src/components/inspector/`:

- `InspectorField`: label above, value below; value renders as calm text on
  the panel surface (transparent background, no border, 15px body). Hover
  shows a subtle field background (`--color-bg-hover`); focus restores the
  full input look with a 2px `--color-accent-focus` ring. All states from
  existing tokens; works in dark, light, and watercolor by construction.
- Year inputs: `type="text" inputmode="numeric"`, 4-character width. No
  spinners; mobile gets a numeric keypad.
- Month/day: quiet selects, progressive (appear once year set). No literal
  `---` placeholders.
- Ghost affordance: absent optional groups render as one muted row, e.g.
  "+ Add date of death"; clicking reveals the fields with the year focused.
- Adopted: full-width toggle row (label left, switch right, 44px hit target).
- Age: plain muted text after the date row, not a chip.
- Danger zone: `ConfirmDeleteButton` mechanics unchanged, restyled as a quiet
  text-level action behind generous space and a hairline.

## 3. Header and panel chrome

- Name stays the Playwrite heading (weight 300); still edited via the Person
  tab field. Inline heading editing is deferred.
- Status whisper: header second line, right-aligned opposite the years.
  `aria-live="polite"`. EN "Saved"/"Couldn't save", NL "Opgeslagen"/
  "Opslaan mislukt".
- Close keeps its place and 34px height. With autosave, Close is always safe;
  no guard dialog needed.
- Tabs keep structure and counts; the active indicator becomes a 2px
  `--color-accent` underline flush with the tab bar border. The events
  segmented control gets the same treatment one size down.
- Content area drops most horizontal dividers; whitespace does the grouping.
  Two hairlines survive: below the header, above the danger zone.
- Keyboard: Escape closes the panel; Enter in a single-line field commits the
  field (blur), not the panel.

## 4. Rollout

Phased; every commit ships a coherent surface:

1. Primitives + Person tab (proving ground; its tests define the grammar).
2. Event sub-panels: `EditSubPanel`/`EventCard` (trauma, life, turning) and
   `ClassificationsTab`. Existing cards expand into quiet autosaving fields;
   the new-entity flow keeps its explicit Add.
3. Relationship surfaces: `RelationshipsTab` inline type selects autosave;
   `RelationshipDetailPanel` period rows autosave per field with the
   overlapping-periods validation gating commits; "Add period" stays explicit.
4. `PatternPanel` (name, description, color commit on change) and
   `SiblingGroupPanel` (member rows edit in place; promotion stays explicit,
   it is a creation).
5. `SettingsPanel`: already instant-apply; adopts the visual grammar only.
   The old `.detail-panel__field` CSS dies with its last consumer.

Each phase lands with tests, tsc, biome, EN+NL keys, and a screenshot check
in all three themes.

## 5. Testing

- Unit: `useAutosaveForm` (dirty-gate, debounce with fake timers, flush on
  unmount/switch, invalid revert, retry-after-failure); validation guards as
  pure functions.
- Integration: converted panel tests change trigger from "click Save" to
  "blur"; new cases for flush-on-person-switch (the UX-10 regression test),
  ghost-row reveal, whisper aria-live, persistent error state.
- E2E: tree-workflow, data-entry, settings/views specs convert from
  click-Save to fill-and-blur in the same phase as their panel.
  `smoke-production.spec.ts` must ship in the same tag as phase 1, or the
  post-deploy smoketest fails its own deploy.
- i18n: every new key lands in `en` and `nl` in the same commit.
- Quality: `make complexity` and `make quality` after each phase; coverage
  ratchet applies.

## Out of scope (deferred)

- Inline editing of the handwritten header name.
- Biography-style sentence editing.
- Autosave for entity creation flows.
