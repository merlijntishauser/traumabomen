---
version: 1
slug: "frontend-src-pages-timelinepage-tsx"
primary_target: "frontend/src/pages/TimelinePage.tsx"
related_targets: ["frontend/src/components/timeline/TimelineView.tsx"]
---

# Timeline view

Scope: the tree timeline (`/trees/{id}/timeline`). Mode: Operate.

Audience and job: a person and their therapist looking at one screen together, or the person alone. The job is to see the whole family across time at a glance and talk about one year (or one age) at a time. Legibility on a shared screen outranks exploration.

Must keep: Years and Age modes. Everything else (edit and annotate modes, filters, chip bar, pattern lanes) may be dropped or moved elsewhere.

Constraints: domain colours stay the closed set from theme.css in both themes; badge shapes keep their meaning; EN/NL parity; reduced motion honoured.

Unresolved: where editing from the timeline goes (the person page already edits in place); whether patterns return as an overlay on the stripes.

## Direction contract

THESIS: Each life is one band of whole-year cells, tinted only by what the user recorded, so a family reads from across a room. It refuses the lifebar Gantt chart with floating labels.

OWN-WORLD: Flat colour fields on a quiet ground, no contours behind the chart. Trauma categories fill cells; approximate spans and suspected classifications are hatched, never a second hue. Life events are squares under the band, classifications a rule along its foot, turning points a star above. One reserved ink, used for nothing else, marks the year being read. Three type sizes.

STORY: The visitor sees which generations carried what and when, picks one year or age, and reads together what it held for everyone alive.

FIRST VIEWPORT: Header with view tabs; a bar with the Years/Age switch and a legend of the categories present. Left: names by generation. Centre: stripe banks under a decade ruler, the reading column lit. Right: a 340px pane, the year at 40px, then each living person with their age and that year's entries, closing with one open question.

FORM: climate stripes (Ed Hawkins), candidate 3 of 7; seed key 841ac20e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
