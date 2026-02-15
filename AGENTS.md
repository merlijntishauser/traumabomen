# Traumabomen

Zero-knowledge encrypted web app for mapping intergenerational trauma onto visual family trees. Personal reflection tool -- all sensitive data is encrypted client-side; the server never sees plaintext.

## Project Structure

```
traumabomen/
  CLAUDE.md               Project instructions
  docker-compose.yml      Local dev: db + api + frontend
  .env.example            Placeholder env vars (copy to .env)
  docs/                   Design documents
  frontend/               Vite + React + TypeScript SPA
    Dockerfile            Multi-stage: dev / build / production (nginx)
    src/                  React source code
  api/                    FastAPI Python backend
    Dockerfile            Multi-stage: dev / production
    app/                  Application code
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
- **Framework:** Vite + React + React Router + TypeScript
- **Tree visualization:** React Flow + Dagre auto-layout
- **Timeline visualization:** D3.js
- **State management:** TanStack Query (React Query)
- **i18n:** react-i18next (English + Dutch)
- **Encryption:** Web Crypto API (AES-256-GCM) + Argon2id via argon2-browser WASM

### Backend
- **Framework:** FastAPI (Python)
- **ORM:** SQLAlchemy
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens)

### Testing
- **Unit tests:** Vitest
- **Component tests:** React Testing Library
- **Integration tests:** Playwright
- **Backend tests:** pytest

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

### Pattern (deferred from MVP)
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

### Resources (all payloads: `{ id, encrypted_data, metadata }`)
- `GET/POST/PUT/DELETE /trees`
- `GET/POST/PUT/DELETE /trees/{id}/persons`
- `GET/POST/PUT/DELETE /trees/{id}/relationships`
- `GET/POST/PUT/DELETE /trees/{id}/events`
- `GET/POST/PUT/DELETE /trees/{id}/patterns`

### Bulk Sync
- `POST /trees/{id}/sync` -- batch of creates, updates, deletes across all entity types in a single transaction

## Frontend Architecture

### Routing
- `/login`, `/register` -- auth flows
- `/trees` -- tree list (MVP: single tree)
- `/trees/{id}` -- main workspace, tree view
- `/trees/{id}/timeline` -- timeline view

### Key Components
- `<EncryptionProvider>` -- React context holding derived key in memory. Exposes `encrypt()` / `decrypt()`. Wraps authenticated app.
- `<TreeCanvas>` -- React Flow instance. Person nodes, relationship edges. Dagre auto-layout. Drag-to-create relationships, zoom, pan.
- `<PersonNode>` -- Custom React Flow node. Name, years, adoption icon, trauma event badges (color-coded by category).
- `<PersonDetailPanel>` -- Slide-out panel. Edit person fields, trauma events, relationship periods. Encrypt-then-save.
- `<TimelineView>` -- D3 horizontal timeline. Generational bands as rows, trauma events as markers, partner periods as horizontal bars.
- `<PatternEditor>` -- Deferred from MVP.

### Relationship Visual Styles
- Solid lines: biological relationships
- Dashed lines: step/adoptive relationships
- Small icons/labels on edges for type clarity

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

## MVP Scope

### In MVP
- Auth (email/password + encryption passphrase)
- Single tree per user
- Person CRUD with all relationship types
- Temporal partner relationships
- Trauma event CRUD with categories
- Tree view (React Flow + Dagre layout)
- Timeline view (basic D3)
- Zero-knowledge encryption
- English + Dutch
- Bulk sync endpoint

### Deferred
- Multiple trees per user
- Pattern editor
- OAuth/social login
- GEDCOM import
- PDF/image export
- Custom category management
- Collaborative/shared trees
- Passphrase recovery hints
- Offline-first with service worker
- Additional languages

## Security Rules
- Never store or log the encryption key or passphrase
- Never send plaintext sensitive data to the backend
- All sensitive fields must be encrypted before leaving the client
- Encryption key must only exist in memory, never persisted to localStorage/sessionStorage/cookies
- Every `encrypt()` call must use a fresh random IV

DISTILLED_AESTHETICS_PROMPT = """
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:
 
Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
 
Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
 
Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
 
Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.
 
Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
 
Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
"""

...

### Quality guidelines  

**ALWAYS** follow these quality guidelines:

- **IMPORTANT**: When you complete a task that has new functions write unit tests for the new function
- **IMPORTANT**: When you complete a task that updates code make sure all existing unit tests pass and write new tests if needed
- Each time you write or update a unit test run them and ensure they pass
- **IMPORTANT**: When you complete a task run `docker compose exec api uv run pytest` and `docker compose exec frontend npx vitest run` to ensure all tests pass
- **IMPORTANT**: When you complete a task run `docker compose exec frontend npx tsc --noEmit` and `docker compose exec api uv run mypy app/` to check for type errors and fix them

### Security guidelines

**ALWAYS** follow these security guidelines:

- **IMPORTANT**: When you add or update a Python dependency run `docker compose exec api uv run pip-audit` to check for security issues
- **IMPORTANT**: When you add or update a npm dependency run `docker compose exec frontend npm audit` to check for security issues
- **IMPORTANT**: When you add or update a dependency run `docker compose exec frontend npm outdated` and `docker compose exec api uv run pip list --outdated` to check for outdated dependencies
- **IMPORTANT**: When you complete a task run `docker compose exec api uv run bandit -r app/` to check for Python security issues and fix any findings