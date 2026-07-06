# traumabomen-core

The Kotlin Multiplatform core of the mobile reflection companion
(design: `docs/plans/2026-07-05-ios-companion-design.md`). The only home of
security-critical code: crypto, the sync engine, the SQLDelight stores,
and the API client.

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
- `commonMain/api` — the typed client over the existing backend (Ktor
  core, explicit kotlinx JSON): JWT auth with refresh rotation, salt and
  key-ring endpoints, per-type entity pulls, bulk sync push.
- `iosMain` — iOS actuals: libsodium Argon2id and hardware-backed
  AES-256-GCM, bound via cinterop against static libraries built from the
  pinned official source tarball (`scripts/build-libsodium.sh`).
- `jvmMain` — JVM actuals: BouncyCastle Argon2id, `javax.crypto` AES-GCM.
  Runs the compatibility suite in CI and later feeds the Android app.
- `jvmTest` — the shared crypto compatibility suite against the golden
  fixture at `frontend/src/fixtures/crypto-compat.fixture.json` (also
  asserted by the frontend's `cryptoCompat.unit.test.ts`), the sync
  engine suite, SQL store tests, MockEngine client tests, and an opt-in
  live end-to-end test against a running backend:

  ```
  TRAUMABOMEN_LIVE_API=http://localhost:8000 gradle jvmTest
  ```

## Running

```
cd mobile/core
gradle jvmTest
```

Needs a JDK (toolchain 17, auto-provisioned via foojay) and Gradle 9+.

## Running on iOS

```
cd mobile/core
gradle iosSimulatorArm64Test
```

Needs Xcode with an iOS simulator runtime; the first run downloads the
Kotlin/Native toolchain and builds libsodium from source (cached after).
The crypto compatibility suite is common, so the same 8 tests that pin
BouncyCastle on the JVM pin libsodium on the simulator.

## Next

M2 is complete. M3 per the design: the SwiftUI app, starting with unlock
(Secure Enclave key custody) and the journal.
