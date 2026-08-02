# App Privacy questionnaire

Answers for App Store Connect -> App Privacy, with the reason for each, so a
future change can be checked against what was declared.

## The one thing to get right

End-to-end encryption does not mean "no data collected". Apple asks what
leaves the device and is stored, not what you can read. Email addresses and
encrypted content both go to the server, so both are declared. Declaring
nothing because the payload is ciphertext would be a false answer.

Equally, none of it is used for tracking, and there is no analytics or
advertising SDK in the app. Verified by inspection: no third-party SDK appears
in `mobile/ios/Sources` or `project.yml`. The only network destination is the
app's own API.

## Data types

### Contact info -> Email address

- Collected: **Yes**
- Linked to the user's identity: **Yes**
- Used for tracking: **No**
- Purpose: **App Functionality** (authentication and account recovery)

The account is identified by email. It is the one piece of plaintext personal
data the server holds.

### User content -> Other user content

- Collected: **Yes**
- Linked to the user's identity: **Yes**
- Used for tracking: **No**
- Purpose: **App Functionality**

Journal entries, people, relationships, and events. Stored as ciphertext the
server cannot read, but stored, and attached to the account.

### Identifiers, Usage Data, Diagnostics, Location, Contacts, Health

- Collected: **No**

No analytics, no crash reporting SDK, no advertising identifier, no location,
no address book access, and no HealthKit. The reminder feature schedules local
notifications on the device and sends nothing anywhere.

## Tracking

**No.** The app does not track users, does not share data with data brokers,
and does not use data for advertising. Answer "No" to the App Tracking
Transparency question; the app does not call it.

## Notes for the reviewer-facing privacy text

The privacy policy at https://www.traumatrees.org/privacy already describes
this in the same terms. Keep the two in step: if the labels here change, that
page needs the same change.

## When to revisit

Re-check this file if any of these land:

- A crash reporter or analytics SDK (the web app uses Sentry; the iOS app does
  not, and adding it would change these answers)
- Anything reading contacts, photos, or location
- Server-side processing of content that is currently opaque
