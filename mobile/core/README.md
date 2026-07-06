# traumabomen-core

The Kotlin Multiplatform core of the mobile reflection companion
(design: `docs/plans/2026-07-05-ios-companion-design.md`). The only home of
security-critical code: crypto and the sync engine now; the SQLDelight
store and API client follow.

## Layout

- `commonMain/crypto` — the platform-independent contract: `EncryptedBlob`
  (the web wire format), `Argon2Params` (pinned derivation parameters),
  `expect` declarations for Argon2id and AES-256-GCM, and the
  `TraumaCrypto` facade mirroring `frontend/src/lib/crypto.ts`.
- `commonMain/sync` — the ciphertext mirror model, the offline outbox, and
  `SyncEngine`: content-based conflict detection, keep-both preservation of
  conflicting edits, delete-loses-to-edit, and the bulk sync request
  builder matching `POST /trees/{id}/sync`. Storage behind `MirrorStore` /
  `OutboxStore` seams (in-memory now, SQLDelight on device).
- `jvmMain` — JVM actuals: BouncyCastle Argon2id, `javax.crypto` AES-GCM.
  Runs the compatibility suite in CI and later feeds the Android app.
- `jvmTest` — the shared crypto compatibility suite against the golden
  fixture at `frontend/src/fixtures/crypto-compat.fixture.json` (also
  asserted by the frontend's `cryptoCompat.unit.test.ts`), plus the sync
  engine suite (conflicts, coalescing, pull reconciliation, push payloads).

## Running

```
cd mobile/core
gradle jvmTest
```

Needs a JDK (toolchain 17, auto-provisioned via foojay) and Gradle 9+.

## Next

- iOS targets (`iosArm64`, `iosSimulatorArm64`) with libsodium cinterop and
  CryptoKit-backed actuals; equivalence already proven by
  `mobile/spikes/crypto-compat`. Needs Xcode and the Kotlin/Native
  toolchain download, so best done interactively.
- SQLDelight implementations of `MirrorStore` and `OutboxStore`.
- The API client (JWT auth, per-tree pulls, bulk sync push).
