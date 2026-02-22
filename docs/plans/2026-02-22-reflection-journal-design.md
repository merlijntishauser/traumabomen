# Reflection Journal

## Problem

The app has strong data entry (trauma, life events, turning points, classifications, patterns) but no place for users to process what they've entered. The journal is the connective tissue between the data and the meaning: timestamped reflections that can link back to specific entities in the tree.

## Design

A per-tree journal with markdown entries, entity linking via chip picker, and built-in reflection prompts. Accessible both as a slide-out panel (quick access from canvas/timeline) and a dedicated full-width page.

### Data Model

Single `JournalEntry` table (`id`, `tree_id`, `encrypted_data`, `created_at`, `updated_at`). No junction table; entity links are stored inside the encrypted blob (zero-knowledge: server can't see what's linked).

```typescript
interface JournalEntry {
  text: string;
  linked_entities: LinkedRef[];
}

interface LinkedRef {
  entity_type: "person" | "trauma_event" | "life_event" | "turning_point" | "classification" | "pattern";
  entity_id: string;
}
```

### Backend

Simple CRUD router at `/trees/{tree_id}/journal` (no `crud_helpers` since there's no person junction). Five endpoints: create, list, get, update, delete. No bulk sync for MVP.

### UI: Slide-out Panel

Journal icon button in the tree toolbar. Opens a 400px right panel (same pattern as settings/pattern panels). Shows the entry list with "New entry" button. Available from both canvas and timeline views.

### UI: Dedicated Page

`/trees/{id}/journal` route, tab in the toolbar alongside Canvas, Timeline, and Patterns. Full-width layout for longer reading/writing sessions. Lazy-loaded.

Both views share the same `JournalEntryList` and `JournalEntryForm` components.

### Entry List

Reverse chronological (newest first). Each card shows:
- Timestamp (relative for recent, absolute for older)
- First ~100 chars as plaintext preview
- Linked entity chips (colored by type)
- Click to expand/edit

### Entry Form

- Markdown textarea (auto-grows)
- Preview toggle to render markdown
- "Link entity" button opening a grouped picker dropdown (Persons, Trauma events, Life events, Turning points, Classifications, Patterns)
- Linked entity chips below the textarea
- Save/Cancel/Delete buttons

### Reflection Prompts

When creating a new entry, a collapsible "Need inspiration?" section shows curated prompts. Clicking one inserts the prompt text into the textarea. Static strings, not AI-generated. Prompts included:

- "Who in your family tree do you most identify with, and why?"
- "What event had the most ripple effects across generations?"
- "Are there strengths or resilience patterns, not just trauma?"
- "What patterns do you notice repeating?"
- "What would you like future generations to know about your family?"

### Markdown Rendering

Stored as plaintext markdown. Preview mode renders using a lightweight markdown renderer (e.g., `react-markdown` or similar). Supports: bold, italic, lists, headings, paragraphs. No images or HTML.

## Files

### Backend (create)
- `api/app/models/journal_entry.py`
- `api/app/routers/journal.py`
- `api/tests/test_journal.py`
- Alembic migration

### Backend (modify)
- `api/app/models/tree.py` (add relationship)
- `api/app/schemas/tree.py` (add schemas)
- `api/app/main.py` (register router)

### Frontend (create)
- `frontend/src/components/journal/JournalEntryList.tsx`
- `frontend/src/components/journal/JournalEntryForm.tsx`
- `frontend/src/components/journal/JournalPanel.tsx`
- `frontend/src/pages/JournalPage.tsx`
- `frontend/src/components/journal/Journal.css`

### Frontend (modify)
- `frontend/src/types/domain.ts` (JournalEntry, LinkedRef)
- `frontend/src/types/api.ts` (API types)
- `frontend/src/lib/api.ts` (CRUD functions)
- `frontend/src/hooks/useTreeData.ts` (journal query)
- `frontend/src/hooks/useTreeMutations.ts` (journal mutations)
- `frontend/src/pages/TreeWorkspacePage.tsx` (panel toggle)
- `frontend/src/pages/TimelinePage.tsx` (panel toggle)
- `frontend/src/components/tree/TreeToolbar.tsx` (journal tab)
- Router config (journal route)
- `frontend/public/locales/en/translation.json`
- `frontend/public/locales/nl/translation.json`
