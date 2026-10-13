# Reply to App Review: Guideline 2.1, Information Needed

Received 2026-10-13 for version 0.2.34. This is Apple's standard request to
developer accounts with little review history, not a rejection. Answer all six
points in one reply, attach the recording, and put the same text in App Review
Information -> Notes so the next review has it too.

## 1. The screen recording (you, on a physical iPhone)

Apple wants one continuous recording on a real device running the latest iOS,
starting at the home screen. Registration, login and account deletion must be
in it.

Before you start:

- Update the iPhone to the latest iOS.
- Install build 0.2.34 from TestFlight. If the app is already installed,
  delete it first, so the recording starts at the welcome screen.
- Pick a fresh email address you can open on the same phone (a plus address,
  such as `you+review@...`, works), for the account you will create and delete.
- Settings -> Control Center: make sure Screen Recording is there. Turn on Do
  Not Disturb so no notifications appear in the video.

Record, in this order (about 4 to 6 minutes; no narration needed):

1. Start the screen recording from Control Center, then tap the Traumatrees
   icon on the home screen.
2. **Welcome**: scroll through it, tap Continue.
3. **Registration**: tap "Create an account". Enter the fresh email, a
   password, an encryption passphrase and its confirmation. Let the
   "if you lose your passphrase, your data is unrecoverable" warning be seen.
   Submit.
4. **Email verification**: switch to Mail, open the verification email, tap
   the link, then switch back to Traumatrees.
5. **Login**: log in with the new account and enter its passphrase. The new
   account lands on an empty tree list.
6. **Account deletion**: Settings -> Account -> Delete account, enter the
   password, confirm. The app returns to the sign-in screen.
7. **The demo account**: log in with the demo account's email and password,
   then its encryption passphrase.
8. **Journal**: open an entry and read it. Tap New entry, write a line, save.
9. **Tree**: open the Tree tab, pinch to zoom, tap a person to open their
   page, and scroll their life. Tap a name in the sentence at the top to move
   to a relative.
10. **Timeline**: open the Timeline tab, step through a few years with the
    arrows, switch between Years and Age.
11. **Settings**: show the "If you need support now" section, then Lock.
    Unlock again with Face ID (or the passphrase).
12. Stop the recording.

Password and passphrase fields are masked, so typing them on camera does not
reveal them. Trim the start and end in Photos if needed, then attach the video
to your reply in App Store Connect (App Review -> the message -> Reply).

## 2 to 6. The reply text

Paste this into the reply. It contains no credentials: those stay in the
sign-in fields and the Notes field.

```
1. Screen recording
Attached: a recording on an iPhone running the latest iOS, starting from the
home screen. It shows registration (including email verification), login,
account deletion, and then the typical flow with the demo account: unlocking
with the encryption passphrase, reading and writing a journal entry, the
family tree, a person's life page, the timeline, the crisis-support section
in Settings, and locking and unlocking with Face ID.

The app has no user-generated content visible to other users. Everything a
user writes is private to their own account and encrypted on the device; no
other user can see, receive or search it. There is no sharing, messaging,
feed or profile, so there is nothing to report or block. There is no paid
content, subscription or in-app purchase.

2. Purpose and audience
Traumatrees is a private reflection tool for adults who want to understand
patterns that repeat across generations of their family, such as loss,
addiction, war or illness. Users map their family as a tree, record what
happened in each person's life, see those lives side by side on a timeline,
and keep a private journal about it. Some use it alone, some alongside their
own therapist. It is not therapy and not crisis support, and says so on its
first screen and in Settings, where a crisis line is linked.
The problem it solves: genealogy apps assume one shape of family and keep no
room for what happened, and clinical genogram tools store readable data on
someone else's server. Here every word is encrypted on the device before it
is stored, so neither we nor anyone with server access can read it.
The iPhone app is the companion for reading and writing; the family tree
itself is built on the website (traumatrees.org).

3. Setup and access
Sign in with the demo account in the sign-in fields. Then the app asks for an
"encryption passphrase" (given in the notes above): that second step decrypts
the data on the device and is required. The demo account already holds a
family tree with dated events and journal entries.
Main features: the Journal tab (read and write entries), the Tree tab (the
family on a canvas; tap a person to open their life, year by year), the
Timeline tab (every life as a stripe, read one year at a time), and Settings
(language, theme, reminders, lock, support resources, account deletion).
No sample files or other setup are needed.

4. External services
- Our own backend API (Traumatrees), hosted on Google Cloud (Cloud Run and
  Cloud SQL) in the EU. It stores the account's email address, a password
  hash and encrypted data it cannot read.
- An SMTP email delivery service, used only to send verification and password
  reset emails.
- Sentry, for error reports from the backend only. The iPhone app contains no
  analytics, crash reporting or advertising SDK.
- On the device: Apple's Keychain and Secure Enclave for key storage, Face ID
  or Touch ID for unlocking, and local notifications for optional reminders.
  Encryption uses the open-source libsodium library on the device.
No third-party authentication, payment, AI or data-provider services are used.

5. Regional differences
The app works the same in every region. The interface follows the device
language (English or Dutch). The one difference in content: the crisis-line
link in Settings points to 113 Zelfmoordpreventie for Dutch, and to Crisis
Text Line otherwise. Sign-up is open in every region.

6. Regulated industry and third-party material
The app is not a medical device and offers no diagnosis, treatment or
medical advice; it is a personal journal. Users may record a family member's
diagnosis as their own note, which stays encrypted in their account. Personal
data is handled under the EU GDPR, with servers in the EU. The app contains no
protected third-party material: its images are public-domain paintings and
photos under the Unsplash License, and its fonts are under the SIL Open Font
License.
```

## The Notes field (App Review Information)

Apple also asks for this information in Notes, but Notes holds at most 4000
characters and the full reply alone is close to that. Replace the whole Notes
field with this combined version (about 2,200 characters with the passphrase
filled in), which keeps the sign-in steps from `review-notes.md` first:

```
Traumatrees is a private reflection tool for adults mapping patterns that
repeat across generations of their family (loss, addiction, war, illness). It
is not therapy and not crisis support, and says so on its first screen.

SIGNING IN TAKES TWO STEPS, BOTH REQUIRED:
1. Log in with the email and password in the sign-in fields.
2. When asked for the "encryption passphrase", enter:
       <demo account encryption passphrase>
All content is encrypted on the device; the passphrase decrypts it and is
never sent to us. Without it the app cannot show any content.

MAIN FEATURES (the demo account has a tree, dated events and entries):
Journal tab: read and write entries. Tree tab: the family on a canvas; tap a
person to open their life, year by year. Timeline tab: every life as a
stripe, read one year at a time. Settings: language, theme, reminders, lock,
crisis-support links, and Account -> Delete account (permanent; please keep
the demo account).
The family tree itself is built on the website; the app reads it and writes
the journal and events. Registration is in the app ("Create an account") and
needs email verification, which is why the demo account is provided.

NO SHARED CONTENT: everything a user writes is private and encrypted; no
other user can see it. No sharing, messaging, feed or profiles, so nothing to
report or block. No in-app purchases or paid content.

EXTERNAL SERVICES: our own backend API on Google Cloud (Cloud Run, Cloud SQL)
in the EU, storing email, a password hash and unreadable ciphertext; an SMTP
service for verification and password-reset emails; Sentry for backend error
reports only. On the device: Keychain, Secure Enclave, Face ID, local
notifications, and the open-source libsodium library. No third-party login,
payments, AI, analytics or ads.

REGIONS: identical everywhere; English or Dutch by device language. The
Settings crisis link goes to 113 Zelfmoordpreventie in Dutch, Crisis Text
Line otherwise.

REGULATION: not a medical device; no diagnosis, treatment or advice. Users
may note a relative's diagnosis privately. GDPR, servers in the EU. Images
are public-domain paintings and Unsplash photos; fonts are SIL OFL.
```

## After replying

The review resumes once the reply is in; there is no need to resubmit the
build. If Apple asks a follow-up, it arrives the same way.
