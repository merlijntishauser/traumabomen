# App Store Connect submission pack

Everything needed to fill in App Store Connect for the first public release,
plus the parts only you can supply.

## What is here

| File                    | Fills in                                                          |
| ----------------------- | ----------------------------------------------------------------- |
| `listing-en.md`         | Name, subtitle, description, keywords, promotional text (English) |
| `listing-nl.md`         | The same fields, Dutch                                            |
| `review-notes.md`       | App Review notes, including the demo account the reviewer needs   |
| `privacy-labels.md`     | The App Privacy questionnaire, answer by answer                   |
| `age-rating.md`         | The age rating questionnaire                                      |
| `export-compliance.md`  | The encryption declaration already baked into the build           |
| `screenshots/6.9-inch/` | Six 1320x2868 screenshots, captured from the running app          |

## What you still have to do yourself

1. **Create the demo account on production and verify it.** Nothing here can
   do that: production requires email verification, and a reviewer cannot
   receive your confirmation mail. See `review-notes.md`.
2. **Create the `support@traumatrees.org` alias.** The support page at
   `/support` publishes that address, so it needs to receive mail before you
   submit. The URL itself is filled in; the mailbox behind it is not.
3. **Read `export-compliance.md` and decide.** The declaration is a legal
   statement about your software, so it needs your judgement, not mine.
4. **Submit a build that has the current screens.** Nothing reaches App
   Store Connect without a `v*` tag; the deploy and Xcode Cloud workflows
   both trigger on it. The screenshots show the 2026-10-07 redesign (person
   lifeline, Timeline tab, growth rings icon) plus the 2026-10-08 glance fix
   and Settings crisis line, so cut a tag after `v0.2.28` (`v0.2.29` or
   later). Pick that build or a newer one in App Store Connect, not an older
   TestFlight build: screenshots that do not match the submitted build are a
   Guideline 2.3.3 rejection.

## Screenshots

Captured on 2026-10-08 on an iPhone 17 Pro Max simulator (1320x2868, the
6.9" size App Store Connect requires) against the local stack, in the light
theme with the English UI and the status bar overridden to 09:41. The data is
the seeded demo family from `../scripts/seed-demo-account.py`, which now also
seeds trauma events, life events, turning points and classifications so the
lifeline and the timeline have something to read. The app is iPhone-only
(`TARGETED_DEVICE_FAMILY: "1"`), so no iPad set is needed.

| File                 | Screen                                              |
| -------------------- | --------------------------------------------------- |
| `01-welcome.png`     | What the app is for, and the three honest caveats   |
| `02-unlock.png`      | The passphrase gate: "We can never read it"         |
| `03-tree-canvas.png` | Three generations on the canvas, with their badges  |
| `04-person-page.png` | One person's life, year by year                     |
| `05-timeline.png`    | The family stripes, reading one year                |
| `06-journal.png`     | Journal entries against a tree                      |

They are unretouched device captures. If you want captions or framed
marketing shots, these are the raw material rather than the finished set.

The order above is the order to upload them: the first screenshot is the one
most people ever see.

To recapture, the Debug build takes launch arguments that drive the whole
flow without a keyboard (see `debugAutoFlow` in `AppModel.swift`):

```sh
xcrun simctl status_bar <udid> override --time 9:41 --batteryState discharging --batteryLevel 100
xcrun simctl ui <udid> appearance light
xcrun simctl launch <udid> org.traumabomen.companion -AppleLanguages "(en)" \
  -custodyRelaxed -email <seed email> -password <seed password> \
  -unlockPassphrase <seed passphrase> [-showTree | -showTimeline] [-openPerson Margaret]
```

Leave out `-unlockPassphrase` for the unlock screen, and reinstall the app for
the welcome screen.
