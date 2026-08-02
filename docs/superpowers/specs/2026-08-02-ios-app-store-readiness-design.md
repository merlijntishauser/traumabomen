# iOS App Store readiness

Bring the iOS companion to the point where it can be submitted for public
release: ship an optimised core, let people create and delete accounts in the
app, and give a new account somewhere to write.

## Why

The TestFlight pipeline already works (Xcode Cloud archives on `v*` tags and
delivers automatically). Public release adds three code-level gaps:

- Xcode Cloud builds the **debug** core XCFramework, so a submitted build would
  ship an unoptimised Kotlin/Native core with assertions enabled.
- App Review guideline 5.1.1(v) requires in-app account deletion for apps that
  offer account creation. `SettingsView` currently offers only Log out.
- The app has no sign-up, so a reviewer cannot get in without credentials
  supplied in the review notes.

Adding sign-up is what makes deletion mandatory rather than merely advisable;
the two ship together.

## Constraints from production

`deploy.yml` sets `REQUIRE_EMAIL_VERIFICATION=true`, `ENABLE_WAITLIST=true`,
`MAX_ACTIVE_USERS=100`. Therefore:

- `POST /auth/register` returns no tokens: the new user must click the emailed
  link before they can log in. The app cannot do anything authenticated
  immediately after registering.
- Registration returns `403 registration_closed` once the cap is reached,
  unless an email-bound `invite_token` is supplied.

## Design

### 1. Release core framework

`ci_scripts/ci_post_clone.sh` builds
`assembleTraumabomenCoreReleaseXCFramework`. The framework path in
`project.yml` becomes configuration-driven so local development keeps using the
debug slice and only cloud builds link the release one.

### 2. Account deletion

- Core: `ApiClient.deleteAccount()` calling `DELETE /auth/account`.
- UI: a destructive row in `SettingsView` under Account, reusing the two-tap
  confirm already used by Log out.
- On success, wipe everything local (Keychain tokens, the Secure Enclave key,
  the cached key ring, the local database) and return to `.welcome`.

Deletion is irreversible and the copy says so plainly, in the same register as
the existing passphrase warning.

### 3. Sign-up

`WelcomeView` gains "Create account", leading to `RegisterView`: email,
password, passphrase, passphrase confirmation, and the irreversibility warning.
No passphrase hint and no safety acknowledgment; those stay web-only for now.

Flow:

1. Swift generates a 16-byte salt with `SecRandomCopyBytes`, base64-encoded, to
   match `generateSalt()` in `frontend/src/lib/crypto.ts`.
2. Call the core's existing `register(email, password, encryptionSalt)`.
3. On success show a "check your email" screen with an "I've verified,
   continue" action that runs the normal login path.
4. On `403 registration_closed`, show that sign-ups are paused and offer a link
   to the website waitlist.

### 4. Key ring bootstrap

`AppModel.decryptRing` throws `UnlockError.noKeyRing` when the server has no
ring and nothing is cached, so a freshly created account cannot unlock. The web
handles this in `loadOrMigrateKeyRing` by catching the 404 and writing a ring.

The app does the same: no ring on the server means a new account, so encrypt an
empty ring with the master key, `putKeyRing` it, and carry on. Without this,
sign-up produces accounts that cannot be opened on the phone.

### 5. First tree

The app can read trees but never creates one, so a new account lands in an
empty journal with no way forward. Wire the core's existing `createTree` into
`AppModel` behind a small naming sheet: generate a 32-byte tree key, add it to
the key ring, re-encrypt and `putKeyRing`, then open the new tree.

## Testing

- Core: unit tests for `deleteAccount` against the existing `ApiClientTest`
  fakes, covering the success and failure paths.
- Swift: the registration flow's validation rules (passphrase match, required
  fields) and the salt generator's length and encoding.
- Manual: sign up on the simulator against the local stack, verify by email
  through Mailpit, unlock, create a tree, write an entry, then delete the
  account and confirm the local state is gone.

## Out of scope

Passphrase hint, the onboarding safety acknowledgment, an in-app waitlist form,
and invite-token entry. All remain on the web.

## App Store items this does not cover

Screenshots, the App Privacy questionnaire, age rating, support and marketing
URLs, and the demo account for App Review. Those are App Store Connect
paperwork, not code. The export-compliance declaration
(`ITSAppUsesNonExemptEncryption: false`) still needs a deliberate review before
the first public submission.
