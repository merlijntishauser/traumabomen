# Life Events

## Context

The app currently only tracks trauma events. Users need a way to record neutral life events (moving, having a child, finishing school, career changes) that provide context on the timeline without the trauma framing. Life events are a fully separate entity with their own categories, CRUD, and visual treatment.

## Domain Model

```
LifeEventCategory: family | education | career | relocation | health | other

LifeEvent:
  title: string
  description: string
  category: LifeEventCategory
  approximate_date: string          # year or period, same as trauma
  impact: number | null             # optional 1-10 significance scale
  tags: string[]
```

Encrypted identically to trauma events. Server stores opaque blobs plus plaintext person_ids in a junction table.

## Backend

New files mirroring the trauma event pattern:

- `api/app/models/life_event.py` -- `LifeEvent` model + `LifeEventPerson` junction table
- `api/app/routers/life_events.py` -- CRUD at `/trees/{tree_id}/life-events`
- `api/app/schemas/life_event.py` -- `LifeEventCreate`, `LifeEventUpdate`, `LifeEventResponse`
- Alembic migration for the two new tables
- `Tree` model gets a `life_events` relationship

## Frontend

### Types and data layer

- `domain.ts` -- `LifeEventCategory` enum + `LifeEvent` interface
- `api.ts` -- CRUD functions + request/response types
- `useTreeData.ts` -- `DecryptedLifeEvent` interface, new query, added to return value
- `useTreeMutations.ts` -- CRUD mutations

### UI

- `PersonDetailPanel` -- new collapsible "Life events" section with its own form (category dropdown, optional impact field)
- `PersonNode` -- life event badges as squares/diamonds, distinct from trauma circles
- `TimelineView` -- diamond markers alongside trauma circles, using life event category colors

### Colors

- `lifeEventColors.ts` with CSS variable support, same pattern as `traumaColors.ts`
- Six category colors in both light and dark themes

### i18n

- Keys for all six categories, section headers, form labels in EN and NL

## Out of Scope

- Timeline filtering/toggling between event types
- Cross-linking between trauma and life events
- Bulk import
- Pattern system integration (already deferred)
