# Landing page: SEO, trust, and conversion plan

Date: 2026-06-10

Assessment of an externally drafted 15-point improvement prompt against the
current landing page, the design system, and the house voice. Roughly a third
of the prompt is already in place, a third is valuable once adapted to the
brand, and a third conflicts with the brand and is rejected.

## Already in place (no work)

- How-it-works 3-step cards, product screenshots (tree + timeline, theme
  aware), trust section plus the /security explainer, FAQPage and
  SoftwareApplication JSON-LD, full metadata (title, description, OG, Twitter,
  canonical, EN/NL hreflang), admin-managed FAQ.

## Rejected (brand conflicts)

- Sticky mobile CTA and a CTA after every section. The voice rules say never
  urgency, never marketing energy; the page itself promises "Nothing here is
  urgent." Conversion pressure on a trauma product erodes the trust it needs.
- Carousel for screenshots (restrained-motion rule; static layout instead).
- "End-to-end encryption" wording. The product says zero-knowledge and
  "encrypted on your device"; E2EE implies multi-party messaging semantics.
- The prompt's hero and CTA copy verbatim (Title Case, marketing tone). All
  copy is rewritten in house style, EN and NL in lockstep.

## Phase 1: landing quick wins (small, one pass)

1. Hero SEO: keep brand + quiet tagline; surface the existing keyword line
   `landing.tagline` ("Map intergenerational trauma onto visual family
   trees.") so the page carries its head keywords in visible copy near the
   top. Reconsider what the h1 is (brand name alone is weak for SEO; likely
   h1 = brand + keyword line combined, or keyword line as h2).
2. Tertiary CTA: a quiet "See how it works" link in the hero that scrolls to
   the how-it-works section.
3. Structured data: add Organization and WebSite nodes to the existing JSON-LD
   graph.
4. Screenshot captions: one-line captions under the tree and timeline
   glimpses; add a pattern-view capture when provided (same dark/light pair
   convention).
5. FAQ content: add three entries to the migration seed, the static i18n
   fallback, and the live DB: "What is intergenerational trauma?", "Who can
   see my data?", "Can I delete my data?".

## Phase 2: /learn page (the real SEO lever)

A dedicated indexable page in glance+depth style, ~600-900 words total:

- "What is intergenerational trauma?" (definition, family systems,
  generational patterns, current research, no medical claims).
- "How family tree mapping helps reveal generational patterns" (the prompt's
  keyword set used naturally: intergenerational trauma, family trauma
  patterns, inherited trauma, generational trauma, family systems, family
  history mapping).
- References block (Yehuda et al. epigenetics research, Bowen family systems
  theory, trauma-informed education resources).
- Landing gets a 2-3 sentence teaser section linking to it; footer link.
- EN + NL, meta/hreflang like /privacy and /security.

## Phase 3: example tree (separate design, biggest conversion idea)

"See an example tree" lets a visitor understand the product before creating an
account. Two candidate shapes, to decide before building:

- A) Static tour page: 3-4 annotated screenshots (canvas, detail panel,
  timeline, patterns) in a guided scroll. Cheap, no backend.
- B) Read-only public demo tree: real canvas seeded with fictional data.
  Strongest proof, but needs an unauthenticated read path that bypasses
  encryption (demo data stored plaintext or client-bundled), routing, and
  guard rails. A design doc of its own.

Recommendation: ship A now, consider B later.

## Phase 4: founder note (needs Merlijn's words)

Short "Why this exists" section: motivation, privacy commitment, reflection
mission. Draft to be approved or rewritten by Merlijn; no placeholder shipped.

## Phase 5: verification

- Lighthouse on the landing (target: performance >= 90, accessibility >= 95,
  SEO >= 95), axe pass, keyboard walk, both themes, 390px width.
- Heading hierarchy check after the hero h1 decision.

## Open decisions

1. Hero h1 structure (brand vs keyword line).
2. /learn route name (learn vs about-intergenerational-trauma).
3. Pattern-view screenshot: provided like the last batch, or captured from a
   seeded dev tree.
4. Example tree: option A (tour page) now, or go straight for B.
5. Founder note: write it, draft it for approval, or skip.
