# traumabomen-core

The Kotlin Multiplatform core of the mobile reflection companion
(design: `docs/plans/2026-07-05-ios-companion-design.md`). The only home of
security-critical code: crypto now; the encrypted local store, sync engine,
and API client follow.

## Layout

- `commonMain` — the platform-independent contract: `EncryptedBlob` (the
  web wire format), `Argon2Params` (pinned derivation parameters),
  `expect` declarations for Argon2id and AES-256-GCM, and the
  `TraumaCrypto` facade mirroring `frontend/src/lib/crypto.ts`.
- `jvmMain` — JVM actuals: BouncyCastle Argon2id, `javax.crypto` AES-GCM.
  Runs the compatibility suite in CI and later feeds the Android app.
- `jvmTest` — the shared compatibility suite against the golden fixture at
  `frontend/src/fixtures/crypto-compat.fixture.json` (also asserted by the
  frontend's `cryptoCompat.unit.test.ts`). Derivation, key ring, entity
  decryption, round-trips, IV freshness, wrong-key failure.

## Running

```
cd mobile/core
gradle jvmTest
```

Needs a JDK (toolchain 17, auto-provisioned via foojay) and Gradle 9+.

## Next

- iOS targets (`iosArm64`, `iosSimulatorArm64`) with libsodium cinterop and
  CryptoKit-backed actuals; equivalence already proven by
  `mobile/spikes/crypto-compat`.
- Ciphertext mirror (SQLDelight) and outbox sync engine per the design.
