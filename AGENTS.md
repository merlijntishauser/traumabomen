# Traumabomen

Zero-knowledge encrypted web app for mapping intergenerational trauma onto visual family trees. Personal reflection tool — all sensitive data is encrypted client-side; the server never sees plaintext.

## Project Structure

```
traumabomen/
  CLAUDE.md               Project instructions (includes @AGENTS.md)
  AGENTS.md               Detailed project documentation
  CONTRIBUTING.md         Contributor guide
  SECURITY.md             Security policy and reporting
  Makefile                Development, testing, and deployment targets
  docker-compose.yml      Local dev: db + api + frontend
  .env.example            Placeholder env vars (copy to .env)
  docs/                   Design documents and plans
  scripts/                Utility scripts (coverage, complexity, privacy, performance)
  .github/                CI workflows (ci, deploy, CodeQL, Nuclei, Dependabot)
  frontend/               Vite + React + TypeScript SPA
    Dockerfile            Multi-stage: dev / build / production (nginx)
    vite.config.ts        Build config with manual chunk splitting
    src/
      components/         React components (tree/, timeline/, journal/, insights/)
      contexts/           React contexts (EncryptionContext)
      hooks/              Custom hooks (useTreeData, useTreeMutations, etc.)
      lib/                Utilities (api, crypto, colors, dsmCategories)
      locales/            i18n translations (en/, nl/)
      pages/              Route page components (heavy pages lazy-loaded)
      styles/             CSS (theme, auth, admin, etc.)
      types/              TypeScript type definitions (domain, api)
  api/                    FastAPI Python backend
    Dockerfile            Multi-stage: dev / production
    app/
      models/             SQLAlchemy models (user, tree, feedback, waitlist, feature_flag, journal_entry, turning_point)
      routers/            FastAPI route handlers
      auth.py             JWT authentication utilities
      config.py           Environment configuration
      database.py         Database connection setup
      dependencies.py     FastAPI dependency injection
      email.py            Email sending utilities
    alembic/              Database migrations
```

## Development

```bash
# First time setup
cp .env.example .env     # Then edit secrets as needed

# Start all services (postgres + api + frontend with hot-reload)
docker compose up

# Frontend: http://localhost:5173
# API:      http://localhost:8000
# API via frontend proxy: http://localhost:5173/api/health
```

### Version control

This project uses **trunk-based development**. Commit directly to `main`.

- Do **not** open pull requests for your own work. No feature branches, no review branches, no "let me run it through CI first" detours.
- Run the relevant tests, typecheck, and lint locally (see Quality guidelines) before pushing. Pre-commit hooks must pass.
- Keep commits small and self-contained so `git bisect` stays useful.
- The only PRs that live in this repo are from Dependabot, or exceptional cases where a human explicitly asks for review before merge.
- If CI fails on `main` after a push, fix-forward with another commit to `main`, don't revert unless the breakage is broad.

### Database Migrations

```bash
# Create a new migration
docker compose exec api uv run alembic revision --autogenerate -m "description"

# Run migrations
docker compose exec api uv run alembic upgrade head
```

### Running Tests

```bash
# Backend tests (all)
docker compose exec api uv run pytest

# Backend unit tests only (fast, no DB)
docker compose exec api uv run pytest tests/unit/

# Backend integration tests only (DB + HTTP)
docker compose exec api uv run pytest tests/integration/

# Frontend tests (all)
docker compose exec frontend npx vitest run

# Frontend unit tests only (fast, no DOM)
docker compose exec frontend npx vitest run --project unit

# Frontend integration tests only (jsdom)
docker compose exec frontend npx vitest run --project integration

# Frontend e2e
docker compose exec frontend npx playwright test
```

## Production Builds

Each service has a `production` Docker target using hardened base images:

```bash
docker build --target production -t traumabomen-frontend ./frontend
docker build --target production -t traumabomen-api ./api
```

- Frontend production image serves static files via nginx on port 8080
- API production image runs uvicorn as non-root `appuser` on port 8000

## Secrets

- **Local:** `.env` file (not committed, see `.env.example` for shape)
- **Production:** Google Cloud Secret Manager (injected as env vars at deploy time)
- **Never commit:** `.env`, encryption keys, JWT secrets, database credentials

## Tech Stack

### Frontend
- **Framework:** Vite 7 + React 19 + React Router 7 + TypeScript 5.9
- **Tree visualization:** React Flow (@xyflow/react) + Dagre auto-layout
- **Timeline visualization:** D3.js
- **State management:** TanStack Query (React Query) v5
- **i18n:** react-i18next (English + Dutch)
- **Encryption:** Web Crypto API (AES-256-GCM) + Argon2id via argon2-browser WASM
- **Linting:** Biome

### Backend
- **Framework:** FastAPI (Python)
- **ORM:** SQLAlchemy (async, with asyncpg)
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens) via PyJWT + bcrypt
- **Linting:** Ruff + mypy

### Testing
- **Unit tests:** Vitest v4
- **Component tests:** React Testing Library
- **Integration tests:** Playwright
- **Backend tests:** pytest (with pytest-asyncio)

## Domain Model

### Person
- `id`: UUID
- `name`: string
- `birth_year`: integer (approximate)
- `death_year`: integer (optional)
- `gender`: string
- `is_adopted`: boolean
- `notes`: string (optional)

### Relationship (edge between two Persons)
Typed and directional. Types:
- **Biological parent** —birth parent connection
- **Step-parent** —partner of a biological parent, no biological link
- **Adoptive parent** —legally/emotionally parenting, non-biological
- **Biological sibling** —shared both parents
- **Step-sibling** —connected through step-parent relationship
- **Partner** —romantic/marital relationship (temporal, see below)
- **Friend** —non-familial connection

Half-sibling relationships are inferred (two persons sharing exactly one biological parent), not stored as a separate edge type.

Parent-type relationships carry an optional `active_period` (start/end year) for step-parent relationships.

### Temporal Partner Relationships
Partner edges contain a list of `RelationshipPeriod` entries:
- `start_year`: integer
- `end_year`: integer (optional, null = ongoing)
- `status`: `together` | `married` | `separated` | `divorced`

Multiple periods on the same edge support real-world complexity (e.g., marry, divorce, reunite).

### TraumaEvent
- `id`: UUID
- `person_ids`: list of UUIDs (attached to one or more Persons)
- `title`: string
- `description`: string (free text)
- `category`: string (loss, abuse, addiction, war, displacement, illness, poverty)
- `approximate_date`: string (year or period)
- `severity`: integer (user-defined scale)
- `tags`: list of strings (optional)

### LifeEvent
- `id`: UUID
- `person_ids`: list of UUIDs (attached to one or more Persons)
- `title`: string
- `description`: string (free text)
- `category`: string (family, education, career, relocation, health, other)
- `approximate_date`: string (year or period)
- `impact`: integer (user-defined scale)
- `tags`: list of strings (optional)

### Classification (DSM-5)
- `id`: UUID
- `person_ids`: list of UUIDs (attached to one or more Persons)
- `dsm_category`: string (one of 22 DSM-5 major categories)
- `dsm_subcategory`: string (optional, e.g. ADHD under neurodevelopmental)
- `status`: `suspected` | `diagnosed`
- `diagnosis_year`: integer (optional, relevant when diagnosed)
- `periods`: list of `{ start_year, end_year }` (recurring time periods)
- `notes`: string (optional)

### Pattern
- `id`: UUID
- `name`: string
- `description`: string
- `color`: string (from predefined palette)
- `linked_entities`: list of `{ entity_type, entity_id }` (trauma events, life events, or classifications)
- `person_ids`: list of UUIDs (persons associated with the pattern)

Annotation layer linking multiple entities across generations to mark recurring themes. Supports linking trauma events, life events, and classifications. Visualized as connectors on the canvas and as cards on the dedicated pattern page.

### SiblingGroup
- `id`: UUID
- `person_ids`: list of UUIDs (full Person nodes in this sibling group)
- `members`: list of `{ name, birth_year }` (lightweight siblings not in the tree)

Compact representation of siblings without creating full Person nodes. One group per person constraint (server-side 409). Members can be promoted to full persons via bulk sync. Renders as a pill node on the canvas.

### TurningPoint
- `id`: UUID
- `person_ids`: list of UUIDs (attached to one or more Persons)
- `title`: string
- `description`: string (free text)
- `approximate_date`: string (year or period)

Key moments or transitions in a person's life used as anchors for journal reflections.

### JournalEntry
- `id`: UUID
- `tree_id`: UUID
- `title`: string
- `content`: string (free text)
- `linked_turning_point_ids`: list of UUIDs (optional)

Personal reflections tied to a tree. Can link to turning points for context.

### FeatureFlag
- `key`: string (primary key, e.g., `watercolor_theme`)
- `audience`: `disabled` | `admins` | `selected` | `all`

Controls feature availability. Audience determines who sees the feature: all users, admins only, a selected set of users, or nobody. Selected users stored in a `FeatureFlagUser` junction table (`flag_key`, `user_id`).

## Architecture

### Zero-Knowledge Encryption Flow
1. **Registration:** Email/password for auth + separate encryption passphrase + optional plaintext hint (max 255 chars). Client generates salt (stored server-side). Passphrase + salt derive AES-256 key via Argon2id. Key held in memory only.
2. **Login:** JWT auth -> fetch salt + hint -> prompt for passphrase (hint shown if set) -> derive key -> decrypt tree data.
3. **Data operations:** All sensitive fields encrypted client-side before any API call. Server stores opaque ciphertext blobs.
4. **Tab close / logout:** Key is garbage collected. No persistence.
5. **Passphrase change:** Decrypt all blobs with old key -> re-encrypt with new key -> bulk sync.
6. **Passphrase hint:** Optional plaintext reminder stored server-side. Shown on unlock page, auth modal, and manageable in account settings. Not the passphrase itself.
7. **Passphrase lost = data lost.** UI must make this explicit during registration with a confirmation step.

### Encryption Module (`/lib/crypto.ts`)
- `deriveKey(passphrase, salt)` -> AES-256-GCM key via Argon2id
- `encrypt(plaintext, key)` -> random IV + AES-256-GCM -> `{ iv, ciphertext }` as base64
- `decrypt(encryptedBlob, key)` -> extract IV, decrypt, return plaintext
- `generateSalt()` -> used during registration

### Backend is a Thin Encrypted Document Store
No domain logic server-side —content is opaque. Server validates auth, ownership, and structural integrity (referenced UUIDs exist) but cannot validate content.

## API Design

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify`
- `POST /auth/resend-verification`
- `POST /auth/change-password`
- `GET /auth/salt` —returns encryption salt and passphrase hint
- `PUT /auth/salt`
- `PUT /auth/hint` —update or clear passphrase hint (max 255 chars)
- `PUT /auth/onboarding` —acknowledge onboarding safety modal
- `DELETE /auth/account`

### Resources (all payloads: `{ id, encrypted_data, metadata }`)
- `GET/POST/PUT/DELETE /trees`
- `GET/POST/PUT/DELETE /trees/{id}/persons`
- `GET/POST/PUT/DELETE /trees/{id}/relationships`
- `GET/POST/PUT/DELETE /trees/{id}/events`
- `GET/POST/PUT/DELETE /trees/{id}/life-events`
- `GET/POST/PUT/DELETE /trees/{id}/classifications`
- `GET/POST/PUT/DELETE /trees/{id}/patterns`
- `GET/POST/PUT/DELETE /trees/{id}/turning-points`
- `GET/POST/PUT/DELETE /trees/{id}/sibling-groups`
- `GET/POST/PUT/DELETE /trees/{id}/journal`

### Bulk Sync
- `POST /trees/{id}/sync` —batch of creates, updates, deletes across all entity types in a single transaction

### Feedback
- `POST /feedback` —submit user feedback (category, message, optional anonymous flag)

### Waitlist
- `POST /waitlist` —join the waitlist

### Features
- `GET /features` —returns feature flags enabled for the current user (checks audience: all, admins, selected)

### Admin
- `GET /admin/stats/*` —analytics endpoints (overview, retention, usage, funnel, activity, growth, users)
- `GET /admin/waitlist` —list all waitlist entries
- `PATCH /admin/waitlist/{id}/approve` —approve and send invite email
- `DELETE /admin/waitlist/{id}` —remove entry
- `GET /admin/waitlist/capacity` —active user count and waitlist status
- `GET /admin/features` —list all feature flags with audience and selected user IDs
- `PUT /admin/features/{key}` —update a flag's audience and optional selected users

## Frontend Architecture

### Routing
- `/login`, `/register` —auth flows
- `/waitlist` —waitlist signup (when registration is capacity-gated)
- `/verify-pending`, `/verify` —email verification
- `/unlock` —encryption passphrase entry
- `/privacy` —privacy policy
- `/trees` —tree list
- `/trees/{id}` —main workspace, tree canvas view
- `/trees/{id}/timeline` —timeline view
- `/trees/{id}/patterns` —pattern view (linked trauma/life events/classifications)
- `/trees/{id}/journal` —journal entries view
- `/trees/{id}/insights` —personal insights summary
- `/admin` —admin dashboard (admin-guarded)

### Key Components
- `<EncryptionProvider>` —React context holding derived key in memory. Exposes `encrypt()` / `decrypt()`. Wraps authenticated app.
- `<OnboardingGuard>` —Shows safety acknowledgment modal on first login. Syncs with server-side flag via `PUT /auth/onboarding`.
- `<TreeWorkspacePage>` —React Flow canvas with person nodes, relationship edges. Dagre auto-layout. Drag-to-create relationships, zoom, pan.
- `<PersonNode>` —Custom React Flow node. Name, years, adoption icon. Badges: circles (trauma events), squares (life events), triangles (classifications).
- `<PersonDetailPanel>` —Slide-out panel. Edit person fields, relationships, trauma events, life events, classifications. Encrypt-then-save.
- `<RelationshipDetailPanel>` —Panel for editing relationship details and periods.
- `<PatternPanel>` —Inline panel in tree workspace for pattern CRUD: create/edit/delete patterns, link entities (trauma events, life events, classifications), color picker, visibility toggle.
- `<PatternView>` —Dedicated page showing pattern cards with linked entities, generation span, and detail expansion.
- `<PatternConnectors>` —Canvas overlay rendering visual links between pattern-connected entities.
- `<SettingsPanel>` —Canvas settings, theme, language, account management (password/passphrase change, passphrase hint, auto-lock timeout, account deletion).
- `<PassphraseHintSection>` —Account settings component for viewing, editing, and clearing the passphrase hint.
- `<AutoLockSection>` —Account settings component for configuring the auto-lock timeout.
- `<AuthModal>` —Overlay modal for unlock (passphrase entry with hint) and re-auth (session expired, re-login) flows.
- `<TimelineView>` —D3 horizontal timeline. Generational rows, life bars, trauma/life event markers, classification period strips.
- `<FeedbackModal>` —User feedback submission modal (category, message, anonymous option).
- `<ThemeToggle>` —Toolbar button cycling through available themes (dark/light/watercolor). Icons: Moon (dark), Sun (light), Droplets (watercolor).
- `<JournalView>` —Journal entries page with entry list, create/edit/delete, linked turning points.
- `<InsightsView>` —Personal insights summary page with aggregated tree statistics.

### Relationship Visual Styles
- Solid lines: biological relationships
- Dashed lines: step/adoptive relationships
- Small icons/labels on edges for type clarity

### Badge System on Person Nodes
- Circles: trauma events (colored by category)
- Squares: life events (colored by category)
- Triangles: classifications (amber = suspected, blue = diagnosed)

## Internationalization
- react-i18next with JSON translation files
- `/locales/en/translation.json` —English (base, all keys)
- `/locales/nl/translation.json` —Dutch
- Language detection: browser preference, overridable in settings
- All UI strings via `t('key')` from day one
- Flat namespaced keys: `tree.addPerson`, `trauma.category.addiction`, `relationship.type.stepParent`
- Date formatting via `Intl.DateTimeFormat` respecting locale

## Testing Strategy

### Test Naming Convention (Frontend)

Tests are split into two tiers with strict naming. The `vitest.config.ts` `projects` array defines two projects (`unit` and `integration`) that run in different environments.

- **`*.unit.test.ts`** -- Pure logic tests. No DOM, no React rendering, no `@testing-library/*` imports. Runs in Node (no jsdom overhead). Place next to the module being tested. Use this for: utility functions, data transformations, validators, color mappers, inference logic, API call construction, type guards.

- **`*.test.ts` / `*.test.tsx`** -- Integration tests. Renders components or hooks via React Testing Library. Runs in jsdom. Use this for: component rendering, user interaction flows, hook state transitions, form behavior.

**Rules (enforced in code review):**
- If a test file imports from `@testing-library/react`, it MUST NOT be named `.unit.test.ts`
- If a test file does NOT render components or hooks, it MUST be named `.unit.test.ts`
- New helper/utility functions MUST have a `.unit.test.ts` companion
- Moving a test between tiers requires renaming the file

**Running tests:**
- `make test-fe-unit` -- fast unit tests only (no DOM, seconds)
- `make test-fe-integration` -- component/hook tests (jsdom, slower)
- `make test-fe` -- both tiers combined
- CI and `make quality` run unit tests first for fast failure, then full suite with coverage

### Unit Tests (Vitest, `*.unit.test.ts`)
- Encryption module: round-trip encrypt/decrypt, key derivation determinism, IV uniqueness
- Domain logic: half-sibling inference, relationship period validation (no overlapping periods), pattern linking
- API functions, color mappers, insight computation, timeline helpers

### Integration Tests (Vitest, `*.test.ts` / `*.test.tsx`)
- PersonNode rendering (adopted, trauma badges, various states)
- PersonDetailPanel CRUD flows
- Relationship period editor (add/remove periods)
- Hook state transitions (useTreeData, useLockScreen, useCanvasSettings)
- Tested against decrypted in-memory state, no crypto in component tests

### E2E Tests (Playwright)
- Full journeys: register -> passphrase -> create tree -> add persons -> relationships -> trauma events -> timeline view
- Crypto round-trip: logout -> login -> passphrase -> verify decryption
- Failure path: wrong passphrase -> graceful error

### Test Directory Convention (Backend)

Backend tests are split into two directories under `api/tests/`:

- **`tests/unit/`** -- Pure logic tests. No database, no HTTP client, no `db_session`/`client` fixtures. Tests use mocks and patches only. Use this for: email sending, rate limiter logic, database module setup, Sentry hooks, utility functions.

- **`tests/integration/`** -- Tests that need the DB (SQLite in-memory) and/or ASGI HTTP client. Fixtures (`db_session`, `client`, `user`, `headers`, `tree`, `person`) are defined in `tests/integration/conftest.py`. Use this for: API endpoint tests, auth flows, CRUD operations, bulk sync, ownership isolation.

**Rules (enforced in code review):**
- If a test uses `db_session`, `client`, or any DB fixture, it MUST live in `tests/integration/`
- If a test does NOT need DB or HTTP client, it MUST live in `tests/unit/`
- New utility/helper functions MUST have a `tests/unit/` companion test
- Shared fixtures for integration tests go in `tests/integration/conftest.py`
- The root `tests/conftest.py` contains only fixtures shared by both (rate limiter reset)

**Running tests:**
- `make test-be-unit` -- fast unit tests only (no DB, sub-second)
- `make test-be-integration` -- DB + HTTP tests (slower)
- `make test-be` -- both tiers combined
- CI and `make quality` run unit tests first for fast failure, then full suite with coverage

## Scope

### Implemented
- Auth (email/password + encryption passphrase + email verification)
- Onboarding safety acknowledgment modal (persisted server-side)
- Waitlist with admin approval and invite emails
- Multiple trees per user
- Person CRUD with all relationship types (including friend)
- Temporal partner relationships
- Trauma event CRUD with categories
- Life event CRUD with categories
- DSM-5 classification CRUD (suspected/diagnosed, periods, subcategories)
- Pattern CRUD (link trauma events, life events, classifications across persons; color-coded; canvas connectors)
- Tree canvas view (React Flow + Dagre layout)
- Timeline view (D3 with life bars, event markers, classification strips)
- Pattern view (dedicated page with card grid and detail expansion)
- Zero-knowledge encryption
- English + Dutch
- Bulk sync endpoint
- Admin dashboard with analytics and waitlist management
- Account management (password change, passphrase change with re-encryption, account deletion)
- User feedback submission
- Privacy policy page
- Mental health support banner
- Route-based code splitting (lazy-loaded heavy pages with stale-deploy auto-reload)
- Turning point CRUD (key life moments as journal anchors)
- Journal entries (personal reflections linked to turning points)
- Personal insights summary page
- Feature flag system (audience-based: disabled/admins/selected/all)
- Admin feature toggles UI
- Watercolor theme (teal-blue on warm cream, feature-flagged)
- Three-theme system (dark/light/watercolor) with synchronized state
- Sibling groups (compact sibling representation, promotion to full persons)
- Passphrase hints (optional plaintext reminder, shown on unlock/auth modal, manageable in settings)

### Deferred
- OAuth/social login
- GEDCOM import
- PDF/image export
- Custom category management
- Collaborative/shared trees
- Offline-first with service worker
- Additional languages


## Design System

### Visual Identity

The app uses a nature-inspired aesthetic with strong thematic coherence. Three themes are available:

- **Dark** (default): "Midnight forest" with near-black greens. Accent: forest green (`#2d8a5e`).
- **Light**: "Morning light through birches" with warm linen-sage. Accent: forest green (`#2d8a5e`).
- **Watercolor** (feature-flagged): Soft teal-blue on warm cream/parchment. Accent: teal-blue (`#4a9bb5`). Gated behind the `watercolor_theme` feature flag; only visible when an admin enables it.

The theme system uses `useSyncExternalStore` for cross-component state synchronization, with `useAvailableThemes` deriving the theme list from feature flags. Settings show radio buttons; the toolbar ThemeToggle cycles through available themes.

### Typography

- **Heading font:** `Playwrite NZ Basic` —a flowing handwriting-style script with variable weight (100-400). Evokes personal journals and handwritten family notes, fitting the reflective nature of the tool.
- **Body font:** `Lato` —a clean, humanist sans-serif with good legibility at all sizes. Weights 300/400/700/900 loaded. Warm and approachable without being decorative.
- Fonts loaded via Google Fonts CDN with `preconnect`.
- All font families defined as CSS variables (`--font-heading`, `--font-body`) in `theme.css`.

### Color Palette

All colors defined as CSS custom properties in `frontend/src/styles/theme.css`. The dark theme is the default (`:root`), light theme applies via `[data-theme="light"]`, watercolor via `[data-theme="watercolor"]`.

- **Surfaces:** 5-level depth scale from `--color-bg-primary` (deepest) to `--color-bg-hover` (interactive)
- **Accent:** Green (`#2d8a5e`) for dark/light themes, teal-blue (`#4a9bb5`) for watercolor, with hover, subtle, and focus-ring variants
- **Text:** 4-level hierarchy: primary, secondary, muted, inverse
- **Semantic:** Danger (red), edge types (pink/purple/orange for partner/half-sibling/friend), trauma categories (7 colors), life event categories (6 colors), classification status (amber suspected, blue diagnosed)

### Atmospheric Details

- **Toolbar accent line:** 3px gradient (`--color-accent` to transparent) via `::after` pseudo-element on `.tree-toolbar`
- **Background gradient:** Radial gradient with noise texture overlay (`feTurbulence` SVG filter at `opacity: 0.035`) to prevent banding
- **BranchDecoration:** Procedurally generated SVG trees in bottom-left corner at `opacity: 0.12`, randomized on page load, drawn with Bezier curves in accent color
- **Lock screen:** Multi-layered CSS backgrounds simulating moonlit canopy (dark) or morning mist (light) using 6-8 radial gradients with `backdrop-filter: blur(20px)`
- **Auth hero:** Theme-aware photo images with gradient overlays fading to background color

### Design Principles

When modifying the frontend, follow these principles:

- **Stay in the theme palette.** New surfaces, borders, and shadows should use the existing CSS variables. Dark/light themes use green-tinted variables; watercolor uses warm neutrals with teal accents. Never introduce off-palette colors for structural elements.
- **Respect the atmosphere.** The app deliberately builds depth through layered gradients, noise textures, and organic SVG decorations. Don't flatten it with solid backgrounds.
- **Heading font is personal.** Playwrite NZ Basic's flowing script gives headings a handwritten, journal-like quality. Use weight 200-300 for large display, 300-400 for compact panel headers. Pair with the clean Lato body font for readability.
- **Category colors are a closed set.** Trauma, life event, and classification colors are carefully chosen to work in all themes. Don't add new ones without updating all theme variants.
- **Motion is restrained.** The app uses `0.15s ease` transitions for color/background changes and `0.25s ease-out` slide-in for panels. Don't add bouncy, springy, or attention-seeking animations —the subject matter is sensitive.
- **Panels slide from the right.** All detail panels (person, relationship, pattern, settings) are 400px-wide absolute overlays on the right side of the canvas.
- **Buttons have three tiers.** Primary (accent background), default (secondary background with border), and danger (red text/border). Small variant uses 11px font.
- **Button heights are uniform within a bar.** All toolbar buttons (text and icon) share `height: 32px`. All footer buttons and links share `height: 24px`. Never let padding alone determine button height —use an explicit `height` so elements align.
- **Badge shapes encode meaning.** Circles = trauma events, squares = life events, triangles = classifications. These shapes are part of the visual language, don't repurpose them.
- **Never use `--` or `—` in text strings.** Use proper punctuation (`,` `;` `:` or parentheses) instead. This applies to translation files, UI copy, and any other user-facing text.
- **Body is 15px.** Not 14, not 16. The base font-size on `body` is `var(--text-body-size)` and components inherit from it.
- **Headings are always light** (weight 200-400). Never bold the handwriting face. Use `var(--text-h1-*)` / `.t-h1` etc. when an element's tag does not match the desired role.
- **Sentence case for every label**, including buttons. *"Add person"*, not *"Add Person"*. Only proper nouns capitalize.
- **Lucide icons only** for stock UI. Import individually (`import { Heart, Lock } from "lucide-react"`), never the whole pack. For domain marks not in Lucide, draw a 24×24 / 2px-stroke SVG matching Lucide's grammar.
- **Glass surfaces are reserved.** Use `tt-card--glass` / `--shadow-glass` only on auth and lock cards over hero photography. Never on workspace, settings, panels, or any data-dense surface — readability of dense data wins over depth.
- **No press shrink, no scale transforms, no springs.** Every transition goes through `var(--transition-colors)` (0.15s ease). The two named animations (`auth-reveal`, `slide-in-right`) are the only motion grammar.

### What we do NOT do

A pattern set observed by absence in the existing app — preserve it:

- No glassmorphism on data-dense surfaces (workspace, panels, settings).
- No bluish-purple gradients. The only gradient is the radial accent wash (`bg-gradient`) and the radial vignette over hero photography.
- No emoji cards or emoji icons. The subject matter is too sensitive — emoji is non-negotiable banned in UI, copy, and translations.
- No left-border-only "callout" cards as a system. Specific exceptions only: `auth-warning--prominent` (3px left border, danger) and `auth-hint-block` (2px left border, accent).
- No drop caps, no decorative quote marks.
- No icon-with-rounded-square-background pattern.
- No skeleton loaders with shimmer. Loading is plain text: *"Loading…"*.
- No toast notifications with bouncy entrances.

### Voice & content

- **Pronouns: "you" and "your".** Use "we" sparingly, only for technical guarantees ("We can never read your data").
- **Glance + depth.** Lead with reassurance in plain English; follow with proof (Argon2id, AES-256-GCM, etc.) in a "depth" section. The privacy policy is the canonical example.
- **Honest about hard truths, never softened.** Example: *"If you lose your passphrase, your data is unrecoverable. This is by design."* Never wrap that in apologetic language.
- **Reflection prompts are open questions, not imperatives.** *"What was never spoken about, but everyone knew?"* — not *"Try writing about…"*.
- **No exclamation marks** in product copy. Allowed exception: genuine good news such as the waitlist approval banner.
- **Bilingual EN/NL stay in lockstep.** Every key in `frontend/src/locales/en/translation.json` has a peer in `nl/translation.json`. The Dutch voice is equally restrained.

### Quality guidelines

**ALWAYS** follow these quality guidelines:

- **IMPORTANT**: When you complete a task that has new functions write unit tests for the new function
- **IMPORTANT**: When you complete a task that updates code make sure all existing unit tests pass and write new tests if needed
- **IMPORTANT**: Each time you write or update a unit test run them and ensure they pass
- **IMPORTANT**: When you complete a task run `docker compose exec api uv run pytest` and `docker compose exec frontend npx vitest run` to ensure all tests pass
- **IMPORTANT**: When you complete a task run `docker compose exec frontend npx tsc --noEmit` and `docker compose exec api uv run mypy app/` to check for type errors and fix them
- **IMPORTANT**: After refactoring ALWAYS run `make complexity` and `make quality`. Degradation in code coverage and /o r quality is unacceptable

### Security guidelines

**ALWAYS** follow these security guidelines:

- **IMPORTANT**: Never store or log the encryption key or passphrase
- **IMPORTANT**: Never send plaintext sensitive data to the backend
- **IMPORTANT**: All sensitive fields must be encrypted before leaving the client 
- **IMPORTANT**: Encryption key must only exist in memory, never persisted to localStorage/sessionStorage/cookies
- **IMPORTANT**: Every `encrypt()` call must use a fresh random IV
- **IMPORTANT**: When you add or update a Python dependency run `docker compose exec api uv run pip-audit` to check for security issues
- **IMPORTANT**: When you add or update a npm dependency run `docker compose exec frontend npm audit` to check for security issues
- **IMPORTANT**: When you add or update a dependency run `docker compose exec frontend npm outdated` and `docker compose exec api uv run pip list --outdated` to check for outdated dependencies
- **IMPORTANT**: When you complete a task run `docker compose exec api uv run bandit -r app/` to check for Python security issues and fix any findings