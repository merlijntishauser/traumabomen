# Content rights

Answers for App Store Connect -> App Information -> Content Rights, and the
record behind them.

## Answers

- Does your app contain, show, or access third-party content? **Yes**
- Do you have all necessary rights to that content? **Yes**

The app holds no third-party content beyond what is listed below. Everything a
user writes is their own and stays encrypted on their account; the app does
not fetch or show anyone else's content.

## What ships in the app

Confirmed by Merlijn on 2026-10-12: every image is either an Unsplash photo or
a public-domain painting.

### Images

| Asset | What it shows | Source | Rights |
| --- | --- | --- | --- |
| `welcome-light.jpg` | Impressionist coastal landscape with pines; appears to be Monet, *Bordighera* (1884) | Public-domain painting | Public domain |
| `hero-unlock-light.jpg` | Misty river landscape in soft violet; Monet's manner, title not recorded | Public-domain painting | Public domain |
| `welcome-dark.jpg` | A wooden bench on a green lawn before trees | Unsplash (`0YAIK1HaC-Q`, per `docs/plans/2026-02-18-welcome-banner-design.md`) | Unsplash License |
| `hero-unlock-dark.jpg` | A hiker at a log cabin in a dark forest, seen from behind | Unsplash, also the website's unlock hero | Unsplash License |

All four live in `mobile/ios/Resources/Assets.xcassets/` (`welcome.imageset`,
`hero-unlock.imageset`). Claude Monet died in 1926, so his paintings are in the
public domain worldwide (if either painting turns out to be by another
painter, check that they died more than 70 years ago); a faithful photographic reproduction of a
two-dimensional public-domain work adds no new copyright in the EU (DSM
Directive, Article 14) or the US.

The [Unsplash License](https://unsplash.com/license) allows free commercial
use without attribution, including in an app. It forbids selling unaltered
copies and compiling the photos into a competing image service, neither of
which applies here.

The titles of the two paintings and the Unsplash ID of the cabin photo are not
recorded. If it is ever questioned,
the page each came from is the proof; record it here when you find it.

### Fonts

| Font | Use | Licence |
| --- | --- | --- |
| Playwrite NZ Basic | The voice face: wordmark, names, headings | SIL Open Font License 1.1 |
| Fraunces | Bundled for public-facing surfaces | SIL Open Font License 1.1 |
| Lato | Body text | SIL Open Font License 1.1 |

The OFL allows bundling the fonts in an app, commercially, as long as they are
not sold on their own.

### Icons

The in-app icons (`book-open`, `gantt-chart`, `lock`, `network`, `pen-line`,
`settings` imagesets) are Lucide glyphs, ISC License. The app icon (the growth
rings) is original to the project.

## When to revisit

Add a row here before shipping any new image, font, sound, or icon set, with
its source and licence. Apple can ask for proof of rights during review or
after a complaint, and the answer above is only true while this table is.
