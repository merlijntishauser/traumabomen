# Traumabomen

Zero-knowledge encrypted web app for mapping intergenerational trauma onto visual family trees. Personal reflection tool -- all sensitive data is encrypted client-side; the server never sees plaintext.

## Project Structure

```
traumabomen/
  CLAUDE.md               Project instructions (includes @AGENTS.md)
  AGENTS.md               Detailed project documentation
  docker-compose.yml      Local dev: db + api + frontend
  .env.example            Placeholder env vars (copy to .env)
  docs/                   Design documents and plans
  scripts/                Utility scripts
  .github/                CI workflows and templates
  frontend/               Vite + React + TypeScript SPA
    Dockerfile            Multi-stage: dev / build / production (nginx)
    src/
      components/         React components (tree/, timeline/)
      contexts/           React contexts (EncryptionContext)
      hooks/              Custom hooks (useTreeData, useTreeMutations, etc.)
      lib/                Utilities (api, crypto, colors, dsmCategories)
      locales/            i18n translations (en/, nl/)
      pages/              Route page components
      styles/             CSS (theme, auth, admin, etc.)
      types/              TypeScript type definitions (domain, api)
  api/                    FastAPI Python backend
    Dockerfile            Multi-stage: dev / production
    app/
      models/             SQLAlchemy models
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

### Database Migrations

```bash
# Create a new migration
docker compose exec api uv run alembic revision --autogenerate -m "description"

# Run migrations
docker compose exec api uv run alembic upgrade head
```

### Running Tests

```bash
# Backend tests
docker compose exec api uv run pytest

# Frontend tests
docker compose exec frontend npx vitest run

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
- **Biological parent** -- birth parent connection
- **Step-parent** -- partner of a biological parent, no biological link
- **Adoptive parent** -- legally/emotionally parenting, non-biological
- **Biological sibling** -- shared both parents
- **Step-sibling** -- connected through step-parent relationship
- **Partner** -- romantic/marital relationship (temporal, see below)
- **Friend** -- non-familial connection

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

### Pattern (deferred)
- `id`: UUID
- `name`: string
- `description`: string
- `linked_event_ids`: list of TraumaEvent UUIDs

Annotation layer linking multiple TraumaEvents across generations to mark recurring themes.

## Architecture

### Zero-Knowledge Encryption Flow
1. **Registration:** Email/password for auth + separate encryption passphrase. Client generates salt (stored server-side). Passphrase + salt derive AES-256 key via Argon2id. Key held in memory only.
2. **Login:** JWT auth -> fetch salt -> prompt for passphrase -> derive key -> decrypt tree data.
3. **Data operations:** All sensitive fields encrypted client-side before any API call. Server stores opaque ciphertext blobs.
4. **Tab close / logout:** Key is garbage collected. No persistence.
5. **Passphrase change:** Decrypt all blobs with old key -> re-encrypt with new key -> bulk sync.
6. **Passphrase lost = data lost.** UI must make this explicit during registration with a confirmation step.

### Encryption Module (`/lib/crypto.ts`)
- `deriveKey(passphrase, salt)` -> AES-256-GCM key via Argon2id
- `encrypt(plaintext, key)` -> random IV + AES-256-GCM -> `{ iv, ciphertext }` as base64
- `decrypt(encryptedBlob, key)` -> extract IV, decrypt, return plaintext
- `generateSalt()` -> used during registration

### Backend is a Thin Encrypted Document Store
No domain logic server-side -- content is opaque. Server validates auth, ownership, and structural integrity (referenced UUIDs exist) but cannot validate content.

## API Design

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify`
- `POST /auth/resend-verification`
- `POST /auth/change-password`
- `GET /auth/salt`
- `PUT /auth/salt`
- `DELETE /auth/account`

### Resources (all payloads: `{ id, encrypted_data, metadata }`)
- `GET/POST/PUT/DELETE /trees`
- `GET/POST/PUT/DELETE /trees/{id}/persons`
- `GET/POST/PUT/DELETE /trees/{id}/relationships`
- `GET/POST/PUT/DELETE /trees/{id}/events`
- `GET/POST/PUT/DELETE /trees/{id}/life-events`
- `GET/POST/PUT/DELETE /trees/{id}/classifications`

### Bulk Sync
- `POST /trees/{id}/sync` -- batch of creates, updates, deletes across all entity types in a single transaction

### Admin
- `GET /admin/stats/*` -- analytics endpoints (overview, retention, usage, funnel, activity, growth, users)

## Frontend Architecture

### Routing
- `/login`, `/register` -- auth flows
- `/verify-pending`, `/verify` -- email verification
- `/unlock` -- encryption passphrase entry
- `/privacy` -- privacy policy
- `/trees` -- tree list
- `/trees/{id}` -- main workspace, tree canvas view
- `/trees/{id}/timeline` -- timeline view
- `/admin` -- admin dashboard (admin-guarded)

### Key Components
- `<EncryptionProvider>` -- React context holding derived key in memory. Exposes `encrypt()` / `decrypt()`. Wraps authenticated app.
- `<TreeWorkspacePage>` -- React Flow canvas with person nodes, relationship edges. Dagre auto-layout. Drag-to-create relationships, zoom, pan.
- `<PersonNode>` -- Custom React Flow node. Name, years, adoption icon. Badges: circles (trauma events), squares (life events), triangles (classifications).
- `<PersonDetailPanel>` -- Slide-out panel. Edit person fields, relationships, trauma events, life events, classifications. Encrypt-then-save.
- `<RelationshipDetailPanel>` -- Panel for editing relationship details and periods.
- `<SettingsPanel>` -- Canvas settings, theme, language, account management (password/passphrase change, account deletion).
- `<TimelineView>` -- D3 horizontal timeline. Generational rows, life bars, trauma/life event markers, classification period strips.

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
- `/locales/en/translation.json` -- English (base, all keys)
- `/locales/nl/translation.json` -- Dutch
- Language detection: browser preference, overridable in settings
- All UI strings via `t('key')` from day one
- Flat namespaced keys: `tree.addPerson`, `trauma.category.addiction`, `relationship.type.stepParent`
- Date formatting via `Intl.DateTimeFormat` respecting locale

## Testing Strategy

### Unit Tests (Vitest)
- Encryption module: round-trip encrypt/decrypt, key derivation determinism, IV uniqueness
- Domain logic: half-sibling inference, relationship period validation (no overlapping periods), pattern linking

### Component Tests (React Testing Library)
- PersonNode rendering (adopted, trauma badges, various states)
- PersonDetailPanel CRUD flows
- Relationship period editor (add/remove periods)
- Tested against decrypted in-memory state, no crypto in component tests

### Integration Tests (Playwright)
- Full journeys: register -> passphrase -> create tree -> add persons -> relationships -> trauma events -> timeline view
- Crypto round-trip: logout -> login -> passphrase -> verify decryption
- Failure path: wrong passphrase -> graceful error

### Backend Tests (pytest)
- API endpoints: encrypted blobs stored/returned untouched
- Auth flows
- Bulk sync transactionality (partial failure -> rollback)
- Ownership isolation (user A cannot access user B's trees)

## Scope

### Implemented
- Auth (email/password + encryption passphrase + email verification)
- Multiple trees per user
- Person CRUD with all relationship types (including friend)
- Temporal partner relationships
- Trauma event CRUD with categories
- Life event CRUD with categories
- DSM-5 classification CRUD (suspected/diagnosed, periods, subcategories)
- Tree canvas view (React Flow + Dagre layout)
- Timeline view (D3 with life bars, event markers, classification strips)
- Zero-knowledge encryption
- English + Dutch
- Bulk sync endpoint
- Admin dashboard with analytics
- Account management (password change, passphrase change with re-encryption, account deletion)
- Privacy policy page
- Mental health support banner

### Deferred
- Pattern editor
- OAuth/social login
- GEDCOM import
- PDF/image export
- Custom category management
- Collaborative/shared trees
- Passphrase recovery hints
- Offline-first with service worker
- Additional languages


## Design System

### Visual Identity

The app uses a "dark forest" nature aesthetic with strong thematic coherence. The dominant hue is forest green (`#2d8a5e`), used as the single accent color across both themes. The dark theme evokes a midnight forest (near-black greens), while the light theme evokes morning light through birches (warm linen-sage).

### Typography

- **Heading font:** `Playwrite NZ` -- a flowing handwriting-style script with variable weight (100-400). Evokes personal journals and handwritten family notes, fitting the reflective nature of the tool.
- **Body font:** `Lato` -- a clean, humanist sans-serif with good legibility at all sizes. Weights 300/400/700/900 loaded. Warm and approachable without being decorative.
- Fonts loaded via Google Fonts CDN with `preconnect`.
- All font families defined as CSS variables (`--font-heading`, `--font-body`) in `theme.css`.

### Color Palette

All colors defined as CSS custom properties in `frontend/src/styles/theme.css`. The dark theme is the default (`:root`), light theme applies via `[data-theme="light"]`.

- **Surfaces:** 5-level depth scale from `--color-bg-primary` (deepest) to `--color-bg-hover` (interactive)
- **Accent:** Single green (`#2d8a5e`) with hover, subtle, and focus-ring variants
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

- **Stay in the green palette.** New surfaces, borders, and shadows should use the existing green-tinted variables. Never introduce grays or blues for structural elements.
- **Respect the atmosphere.** The app deliberately builds depth through layered gradients, noise textures, and organic SVG decorations. Don't flatten it with solid backgrounds.
- **Heading font is personal.** Playwrite NZ's flowing script gives headings a handwritten, journal-like quality. Use weight 200-300 for large display, 300-400 for compact panel headers. Pair with the clean Lato body font for readability.
- **Category colors are a closed set.** Trauma, life event, and classification colors are carefully chosen to work in both themes. Don't add new ones without updating both theme variants.
- **Motion is restrained.** The app uses `0.15s ease` transitions for color/background changes and `0.25s ease-out` slide-in for panels. Don't add bouncy, springy, or attention-seeking animations -- the subject matter is sensitive.
- **Panels slide from the right.** All detail panels (person, relationship, pattern, settings) are 400px-wide absolute overlays on the right side of the canvas.
- **Buttons have three tiers.** Primary (accent background), default (secondary background with border), and danger (red text/border). Small variant uses 11px font.
- **Button heights are uniform within a bar.** All toolbar buttons (text and icon) share `height: 32px`. All footer buttons and links share `height: 24px`. Never let padding alone determine button height -- use an explicit `height` so elements align.
- **Badge shapes encode meaning.** Circles = trauma events, squares = life events, triangles = classifications. These shapes are part of the visual language, don't repurpose them.

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