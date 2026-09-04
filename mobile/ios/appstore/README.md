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
| `screenshots/6.9-inch/` | Four 1320x2868 screenshots, captured from the running app         |

## What you still have to do yourself

1. **Create the demo account on production and verify it.** Nothing here can
   do that: production requires email verification, and a reviewer cannot
   receive your confirmation mail. See `review-notes.md`.
2. **Create the `support@traumatrees.org` alias.** The support page at
   `/support` publishes that address, so it needs to receive mail before you
   submit. The URL itself is filled in; the mailbox behind it is not.
3. **Read `export-compliance.md` and decide.** The declaration is a legal
   statement about your software, so it needs your judgement, not mine.
4. **Check that a build reached App Store Connect.** Nothing gets there
   without a `v*` tag; the deploy and Xcode Cloud workflows both trigger on
   it. Tags `v0.2.11` and `v0.2.12` (2026-08-03) already include this pack,
   so a TestFlight build should exist. If it does not, cut a new tag.

## Screenshots

Captured on an iPhone 17 Pro Max simulator (1320x2868, the 6.9" size App
Store Connect requires) against the local stack, using the seeded demo data
from `../scripts/seed-demo-account.py`. The app is iPhone-only
(`TARGETED_DEVICE_FAMILY: "1"`), so no iPad set is needed.

| File                 | Screen                                            |
| -------------------- | ------------------------------------------------- |
| `01-welcome.png`     | What the app is for, and the three honest caveats |
| `02-unlock.png`      | The passphrase gate: "We can never read it"       |
| `03-tree-canvas.png` | Three generations on the canvas                   |
| `04-journal.png`     | Journal entries against a tree                    |

They are unretouched device captures. If you want captions or framed
marketing shots, these are the raw material rather than the finished set.

The order above is the order to upload them: the first screenshot is the one
most people ever see.
