# Implementation plan: iOS person-page editing

Design: `2026-07-14-ios-person-editing-design.md`
Approach: trunk-based, small self-contained commits, `main` stays green after
each phase. No worktree / feature branch (project convention).

## Status (2026-07-14)

Phases 1-4 done and shipped; the feature is functionally complete: tapping a
person lets you add / edit / delete trauma events, life events, milestones, and
classifications, with full web field parity, a multi-person picker, offline-first
writes, and EN/NL labels.

- Phase 1 (core) done: `5adb5bb`
- Phase 2 (models + CRUD) done: `711bf91` (models round-trip-verified via the
  `swift` CLI)
- Phase 3 (taxonomies `30e1742`, components `8604fbb`) done
- Phase 4 (forms: turning `720f122`, trauma+life `df5a47d`, classification
  `b25e6fc`) done
- Phase 5: KMP `jvmTest` and the iOS simulator build are green.

Deferred polish (not blocking): a per-item "saved on this device" pending badge;
an iOS XCTest target hosting the round-trip fixture (verified via `swift` CLI for
now) and the shared web/iOS golden fixture; an on-device offline write/relaunch
test.

## Phase 1 — Core data layer + golden fixture (KMP)

The smallest, safest first step; unblocks everything and is fully testable
without the iOS UI.

1. `EntityType.CLASSIFICATIONS.companionWritable = true`.
2. Generalize the `TreeSync` facade: `createLocal(treeId, type, data, personIds)`,
   `updateLocal(type, id, data, personIds?)`, `deleteLocal(type, id)`; keep the
   journal-only convenience wrappers so the composer is untouched.
3. Confirm/patch `buildPush` to serialize `person_ids` for person-linked types
   in the `POST /trees/{id}/sync` body.
4. Golden fixture: add one of each writable entity type (trauma, life, turning,
   classification) to a shared JSON fixture, asserted for encode/decode by the
   KMP suite (and later Vitest).
5. KMP tests: create/update/delete each writable type; classifications accepted
   by `requireWritable`; `person_ids` present in the push body.

Verify: `./gradlew jvmTest` green.

## Phase 2 — iOS full-fidelity models + AppModel CRUD

1. Swift Codable structs for TraumaEvent, LifeEvent, TurningPoint, Classification
   (all web fields; preserve unknown JSON keys on round-trip).
2. iOS unit test: encode/decode against the golden fixture.
3. AppModel: `saveTraumaEvent`, `saveLifeEvent`, `saveTurningPoint`,
   `saveClassification` (create + update), `deleteStoryItem(type:id:)`. Each
   encrypts with the in-memory tree key (fresh IV), calls the generalized sync
   facade with type + `personIds`, pushes, refreshes.
4. Give `refreshTree` / a per-person fetch access to the full models for
   populating edit forms (today it decodes lossily into `StoryItem`).

Verify: simulator build; encode/decode unit tests.

## Phase 3 — Taxonomies + shared field components

1. Port trauma (7) and life (6) category lists and the DSM-5 taxonomy (22
   categories + subcategories) to Swift constants (stable keys).
2. EN/NL labels via `Loc`/`t()`, including DSM subcategories (the bulk of the
   new translation content). Keep EN/NL in lockstep.
3. Shared components: `CategoryPicker`, `ScaleControl`, `TagEditor`, `DSMPicker`,
   `PeriodEditor`, `YearField`, `PersonPicker` (multi-select, defaults to the
   current person).

Verify: simulator build.

## Phase 4 — Forms + editable person page (one type at a time)

1. `TurningPointForm` (title/description/date/people), wired into `PersonSheet`.
2. `TraumaEventForm` + `LifeEventForm` (category, scale, tags, people).
3. `ClassificationForm` (DSM category+subcategory, status, year, periods, notes,
   people).
4. Make `PersonSheet` editable: per-section Add, tap-to-edit, delete in the
   form, "saved on this device" pending state on new items.

Verify after each form: simulator build; iOS tests for add/edit/delete and
Save-disabled-until-valid.

## Phase 5 — Offline + full verification

1. Pending indicators on queued items, matching the journal.
2. End-to-end: write, airplane mode, relaunch, sync.
3. Full gates: KMP `jvmTest`, iOS build, web `vitest` (shared fixture), `tsc`,
   and the quality/complexity gates. Confirm EN/NL parity.

## Sequencing notes

- Each numbered step is a candidate commit; each phase leaves `main` buildable
  and green.
- The shared golden fixture is the guardrail against encode/decode drift; land
  it in Phase 1 and assert it on both sides.
- Ship user-visible editing only from Phase 4; Phases 1-3 are safe groundwork.
