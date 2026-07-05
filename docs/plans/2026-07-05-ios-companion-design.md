# iOS reflection companion

Date: 2026-07-05
Status: validated design, not yet started

## Decision summary

| Question | Decision |
|---|---|
| Purpose | Reflection companion, not a second editor |
| Capabilities | Biometric unlock, offline read/write, local reminders |
| Stack | Native (SwiftUI now, Kotlin/Compose later) |
| Sequencing | iOS first, shared Kotlin Multiplatform core |
| Key custody | Secure Enclave-wrapped key, weekly passphrase re-verify |
| Offline writes | Journal entries, turning points, trauma/life events |
| Tree on phone | Read-only pinch-zoom canvas plus native person pages |

## Product shape

The phone is the quiet place to write and revisit; the desk is the place to
build. The app reads the whole tree and writes only the reflective layer:
journal entries, turning points, and trauma/life events. Tree structure
(persons, relationships, patterns, sibling groups) is read-only and points
the user to the desktop. Everything works offline and syncs when it can.

## Architecture

Two layers in a new `mobile/` directory of the monorepo:

- **`mobile/core`, Kotlin Multiplatform.** The only home of security-critical
  code: crypto (Argon2id derivation, AES-256-GCM, key-ring unwrap), API
  client, encrypted local store, sync engine, and domain models mirroring the
  web's TypeScript types. Compiled to an XCFramework for iOS; reused
  unchanged by the future Android app.
- **`mobile/ios`, SwiftUI.** UI only: unlock, tree canvas, person pages,
  journal, turning points, reminders, settings. Never touches ciphertext,
  keys, or HTTP directly.

**Compatibility contract.** Core produces and consumes byte-identical
artifacts to `frontend/src/lib/crypto.ts`: same Argon2id parameters
(64 MB, t=3, p=1), same `{iv, ciphertext}` base64 blob layout, same key-ring
format. A shared fixture file (passphrase, salt, key ring, sample blobs) is
asserted by both the Vitest suite and the KMP suite, so drift breaks CI on
either side.

## Zero-knowledge on device

- One `Crypto` interface in common Kotlin with expect/actual bindings:
  CryptoKit for AES-256-GCM plus libsodium `crypto_pwhash` for Argon2id on
  iOS; `javax.crypto` plus the same libsodium on Android later.
- **First unlock per device**: email/password login, JWT, fetch salt and
  hint, passphrase, Argon2id, master key, key-ring unwrap. Identical to web.
- **Biometric custody**: after the first unlock, core generates a Secure
  Enclave P-256 key with `biometryCurrentSet` access control and wraps the
  master key; the wrapped blob lives in the Keychain as
  `WhenPasscodeSetThisDeviceOnly` (never backed up, never migrates). Daily
  use is Face ID, Enclave unwrap, key in memory. The wrap expires after
  7 days (passphrase required again) and dies automatically on biometric
  enrollment change, passcode removal, or reinstall.
- **Offline passphrase verification**: unwrapping the cached key ring is
  authenticated decryption; a wrong key simply fails. No server needed.
- **Lock behavior**: snapshot obscured on backgrounding; in-memory keys
  dropped after the configured interval (default matches the web auto-lock).
  Notifications never contain family content.

## Offline store and sync

- **Ciphertext mirror**: SQLite via SQLDelight, rows of
  `{id, tree_id, encrypted_data, metadata, updated_at, sync_state}` per
  entity type. The phone at rest holds exactly what the server holds.
  `NSFileProtectionComplete` on the DB file as defense in depth. Decryption
  only in memory after unlock.
- **Pull**: full per-tree re-pull through existing GET endpoints on login
  and online foregrounding. Trees are kilobytes; no delta protocol in v1.
- **Push**: offline writes are encrypted immediately, written to the mirror,
  and appended to an outbox. Online, the outbox replays through the existing
  `POST /trees/{id}/sync` bulk endpoint with retry and backoff, surviving
  restarts. Client-generated UUIDs, as on the web.
- **Conflicts**: creates cannot conflict. Edits remember their base
  `updated_at`; if the server copy moved meanwhile, the phone version is
  preserved as a separate entry rather than merged or dropped. Losing words
  is the only unacceptable outcome. Offline deletes lose to server edits.
- **UI truth-telling**: sync state is a quiet line ("3 entries waiting to
  sync"), never a toast.

## Surfaces

- **Unlock**: Face ID over the moonlit-canopy / morning-mist atmosphere,
  passphrase fallback with hint, the honest unrecoverability line unchanged.
- **Tree**: read-only SwiftUI `Canvas` using the desktop's stored layout;
  pinch-zoom and pan. Edge and badge grammar carry over exactly (solid
  biological, dashed step/adoptive; circles trauma, squares life events,
  triangles classifications).
- **Person pages**: native scrolling story: name, years, relationships,
  events, classifications, turning points. "Add" only for the reflective
  layer, offline-capable.
- **Journal**: entry list plus distraction-free composer; quiet-inspector
  autosave (commit on pause/background, saved whisper), links to turning
  points.
- **Reminders**: opt-in weekly rhythm (day and time), local notification
  with neutral copy ("A quiet moment, if you want one."), deep-linking to
  the composer.
- **Settings**: auto-lock interval, biometric toggle, EN/NL, dark/light
  following the system, log out.
- Deferred to v1.1: insights, pattern views.

## Design language on native

Bundle Playwrite NZ Basic, Fraunces, Lato (all OFL). Theme tokens port to
native color assets. Restraint rules apply verbatim: headings light,
sentence case, no emoji, no springy motion, Lucide-grammar icons. EN/NL
copy is generated into `Localizable.strings` from the same
`translation.json` files, preserving the lockstep rule from one source of
truth.

## Server impact

Near zero: existing JWT auth, existing GETs, existing bulk sync endpoint.
Optional later: a client tag on requests for admin usage stats, and
mobile-suited refresh-token lifetimes. No new routes, no auth changes.

## Testing

- **Compatibility fixtures** (keystone): web encrypts, phone decrypts, and
  back, asserted in both CI suites.
- **Core unit tests**: sync engine (outbox replay, retry, keep-both
  conflicts), key custody state machine (expiry, invalidation), offline
  passphrase verification.
- **iOS UI tests**: unlock paths, offline write then airplane-mode then
  sync replay, background-lock behavior.
- **Manual security checklist per release**: no plaintext in DB file,
  snapshots, notifications, or crash reports (on-device Sentry scrubbing).

## Risks and spikes, ordered

1. **KMP crypto spike first**: prove libsodium Argon2id plus CryptoKit
   AES-GCM reproduce a web fixture byte-for-byte on a real device. If this
   fails, the KMP-core premise needs rethinking.
2. Canvas rendering fidelity against desktop layouts.
3. Keychain and Enclave edge cases (passcode removal, enrollment change)
   across a device matrix.

## Milestones

- **M1**: spike results (crypto compatibility, canvas).
- **M2**: core complete (crypto, store, sync) with fixtures green in CI.
- **M3**: unlock plus journal end-to-end, TestFlight.
- **M4**: tree canvas, person pages, reminders.
- **M5**: App Store review prep (standard exempt encryption export
  declaration), release.
- Android starts only after the companion proves itself in daily use.
