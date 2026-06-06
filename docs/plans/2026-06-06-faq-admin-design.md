# Admin-managed FAQ design

Date: 2026-06-06

## Goal

Let an admin edit the landing-page FAQ (bilingual EN/NL) from the admin
dashboard, instead of the FAQ being hardcoded in the i18n files. The FAQ is
public, admin-authored content, so it is NOT user data and NOT encrypted
(contrast with the zero-knowledge tree data).

## SEO decision (chosen: Option A)

The landing redesign is SEO-motivated, and a client-fetched FAQ is JS-rendered
(indexable by Google, but less reliable than static HTML). Options considered:

- **A. CSR + static i18n fallback (chosen).** The landing fetches `GET /faq` and
  renders live entries; if the fetch is empty or fails it falls back to the
  static i18n FAQ (`landing.faqQ1..4` / `landing.faqA1..4`). The static fallback
  is always present in the DOM as the indexable SEO baseline; admin edits enhance
  it for users. Lowest effort, resilient.
- B. Server-inject the published FAQ + JSON-LD into `index.html` at request time
  (extends the existing nginx `__OG_*__` templating). Best SEO, more infra.
- C. Build-time bake into static HTML at deploy. Best SEO, but couples deploys to
  content edits.

Revisit B if organic search becomes a priority.

## Data model: `FAQEntry`

Plain columns (public content, unencrypted):

- `id` (UUID, pk)
- `question_en`, `answer_en`, `question_nl`, `answer_nl` (text)
- `sort_order` (int)
- `published` (bool, default false)
- `created_at`, `updated_at`

Alembic migration creates the table and **seeds it with the four Q&As already
written in i18n**, so there is content on day one and nothing is lost.

## API (mirrors features.py public + admin split)

- **Public:** `GET /faq` -> published entries ordered by `sort_order`, both
  languages, no auth, cacheable. Consumed by the landing.
- **Admin (admin-guarded):**
  - `GET /admin/faq` -> all entries including drafts
  - `POST /admin/faq` -> create
  - `PUT /admin/faq/{id}` -> update content, `published`, `sort_order`
  - `DELETE /admin/faq/{id}` -> remove
- Pydantic schemas: `FaqEntry`, `FaqCreate`, `FaqUpdate`, `AdminFaqList`.
- Tests: unit for any ordering/validation logic; integration for endpoints +
  admin-guard enforcement.

## Admin UI: `FaqSection`

A new section in `AdminPage` alongside `FeatureTogglesSection` /
`WaitlistSection`, using TanStack Query + mutations:

- Lists entries; each row editable with EN Q/A and NL Q/A fields side by side, a
  published toggle, up/down reorder, and delete-with-confirm.
- "Add question" creates a blank entry.
- All controls properly labelled (real `<label>`/`aria-label`), solid cards,
  sentence case, no emoji. New `admin.faq.*` i18n keys (EN + NL).

## Landing integration

`LandingPage` fetches `GET /faq` via TanStack Query and renders entries in the
active language, generating the `FAQPage` JSON-LD from them; falls back to the
static i18n FAQ when empty/failed (Option A). Until the endpoint ships, the
landing simply uses the static i18n FAQ (which is also the fallback), so the
landing can be built and shipped independently of this feature.

## Phasing

1. Landing page ships first using the static i18n FAQ (the Option A fallback).
2. FAQ admin feature (model, migration + seed, public `GET /faq`, admin CRUD,
   `FaqSection` UI) ships next.
3. Landing switches its FAQ source to `GET /faq` with the static fallback.

## Out of scope (for now)

- Rich text / markdown in answers (plain text first).
- Categories/tags, search, or per-entry analytics.
- Server-side rendering of the FAQ (Option B) unless SEO requires it.
