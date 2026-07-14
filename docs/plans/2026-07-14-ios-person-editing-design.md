# iOS person-page editing: trauma, life events, milestones, classifications

Date: 2026-07-14
Status: Validated design, ready for an implementation plan

## Why

The iOS companion is "reflection, not a second editor" — but the original
companion design (`docs/plans/2026-07-05-ios-companion-design.md`) already
scoped the phone to write the **reflective layer**: journal entries, turning
points, and trauma/life events. Structure (persons, relationships, patterns,
sibling groups) stays read-only, edited at the desk. Only the journal was wired
end to end; the person page is still read-only.

This feature completes that intended scope: tapping a person lets you add and
edit the entities that hang off them, the way the web person panel does. It is
not a new direction — it finishes the one that was designed.

## Scope

Editable on the person page (create / edit / delete):

- Trauma events
- Life events
- Turning points (milestones)
- Classifications (DSM-5)

Read-only on the phone, unchanged (edited at the desk):

- Person fields (name, birth/death year, notes, adopted)
- Relationships, patterns, sibling groups (the tree structure and the canvas)

## Decisions

- **Fidelity:** full parity with the web field set — categories, severity /
  impact scale, free tags, DSM taxonomy with subcategory, suspected / diagnosed,
  diagnosis year, and recurring period ranges.
- **Save model:** explicit form sheets with Cancel / Save (or Add). One clear
  commit per save; Cancel writes nothing. No per-field autosave on mobile.
- **Person linking:** a multi-person picker in each form (defaulting to the
  current person), so one item can attach to several people, matching the web.

## Data layer (KMP core)

The security-critical path is reused as-is. `SyncEngine.localCreate(treeId,
type, encryptedData, personIds)`, `localUpdate(type, id, data, personIds?)`, and
`localDelete(type, id)` are already generic: they enforce `requireWritable`,
write the offline mirror, and queue an `OutboxOp` that carries `personIds`. The
pull path and `MirrorEntry` already carry `person_ids` in plaintext. The
conflict rules are unchanged (creates never conflict; edits remember their base
version; deletes lose to server edits).

Changes:

1. `EntityType.CLASSIFICATIONS.companionWritable = true` (the other three are
   already `true`).
2. Generalize the `TreeSync` facade so `createLocal` / `updateLocal` /
   `deleteLocal` take an `EntityType` + `personIds`, keeping thin journal
   convenience wrappers so the existing composer is untouched.
3. Confirm `buildPush` serializes `person_ids` into the `POST /trees/{id}/sync`
   request body for person-linked types; add if missing.

No changes to crypto or sync semantics.

## iOS UI and AppModel

- **`PersonSheet` becomes editable.** Each section (What happened / Life events /
  Milestones / Classifications) gets an "Add" affordance; items are tappable to
  edit, with delete in the edit form. Person fields and relationships keep their
  read-only treatment.
- **Four form sheets** over the person page, each Cancel / Save:
  - `TraumaEventForm`, `LifeEventForm`: title, description, category, date,
    severity / impact, tags, people.
  - `TurningPointForm`: title, description, date, people.
  - `ClassificationForm`: DSM category + subcategory, suspected / diagnosed,
    diagnosis year, recurring periods, notes, people.
- **Shared field components:** category picker, scale control, tag-chip editor,
  DSM taxonomy pickers, period-range editor, year field, and `PersonPicker`
  (multi-select, defaults to the current person).
- **Full-fidelity Codable models** mirroring the web JSON schemas, used to both
  populate the edit form and encode on save. They preserve unknown JSON keys on
  round-trip so a field the web adds later is never silently dropped. (Today the
  app decodes these blobs lossily into `StoryItem`, which stays for the canvas /
  badges.)
- **AppModel CRUD:** `saveTraumaEvent`, `saveLifeEvent`, `saveTurningPoint`,
  `saveClassification` (create + update), and `deleteStoryItem(type:id:)`. Each
  builds the entity, encodes to the web's JSON shape, encrypts with the
  in-memory tree key (fresh IV), calls the generalized sync facade with the
  type + `personIds`, pushes, and refreshes the person's story.

## Taxonomies and encoding fidelity

- **Taxonomies** are ported to Swift constants: trauma (7) and life (6)
  categories, and the DSM-5 taxonomy (22 categories + subcategories). Values are
  the stable keys; display labels go through `Loc` / `t()` so EN and NL stay in
  lockstep. The DSM subcategory strings are the bulk of the new translation
  work. (They could later move into the KMP core to share with Android; not
  now.)
- **Encoding must match the web exactly:** `approximate_date` string,
  `severity` / `impact` ints, `tags` array, classification `periods` as
  `{start_year, end_year}`. Locked down by extending the shared-fixture pattern
  already used for crypto: a golden fixture with one of each entity type,
  asserted by both Vitest (web) and the KMP suite, so encode / decode cannot
  drift.

## Safety and validation

- Editing is reachable only when unlocked (the tree key lives in memory).
- Save stays disabled until required fields are set: title for events; DSM
  category + status for classifications.
- Unchanged guarantees: fresh IV per encrypt, no plaintext to the backend beyond
  the `person_ids` junction.
- Offline saves queue and show a "saved on this device" state, like the journal's
  pending indicator.

## Testing

- **KMP core:** create / update / delete of the writable types including
  newly-writable classifications; `person_ids` present in the push body;
  `requireWritable` accepts classifications.
- **iOS:** form validation, the golden encode / decode round-trip, add / edit /
  delete flows, the multi-person picker.
- **End to end:** write, airplane mode, relaunch, sync.

## Out of scope (future)

- Editing person fields or tree structure on the phone (stays desk work).
- Patterns and sibling groups.
- Moving the taxonomies into the KMP core for Android reuse.
