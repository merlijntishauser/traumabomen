# Reflection Journal & Guided Prompts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-tree reflection journal with markdown entries, entity linking, and contextual reflection prompts surfaced throughout the app.

**Architecture:** New JournalEntry entity (simpler than events: no person junction table, entity links stored in encrypted blob). Accessible via slide-out panel and dedicated page. Reflection prompts are static translated strings shown in journal form, person detail, pattern view, and canvas nudge banner.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query + react-markdown (frontend), Alembic (migration), Vitest + pytest (tests)

**Design docs:** `docs/plans/2026-02-22-reflection-journal-design.md`, `docs/plans/2026-02-22-reflection-prompts-design.md`

---

## Task 1: Backend Model and Migration

**Files:**
- Create: `api/app/models/journal_entry.py`
- Modify: `api/app/models/tree.py` (add relationship)

**Step 1: Create the model**

Create `api/app/models/journal_entry.py`. Simpler than TurningPoint (no junction table):

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trees.id", ondelete="CASCADE"), index=True
    )
    encrypted_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tree: Mapped["Tree"] = relationship(back_populates="journal_entries")
```

**Step 2: Add relationship to Tree model**

In `api/app/models/tree.py`, add:
```python
from app.models.journal_entry import JournalEntry
...
journal_entries: Mapped[list["JournalEntry"]] = relationship(
    back_populates="tree", cascade="all, delete-orphan"
)
```

**Step 3: Generate and run migration**

```bash
docker compose exec api uv run alembic revision --autogenerate -m "add journal entries"
docker compose exec api uv run alembic upgrade head
```

**Step 4: Verify and commit**

```bash
docker compose exec api uv run pytest
docker compose exec api uv run mypy app/
```

Commit: `Add JournalEntry model and database migration`

---

## Task 2: Backend Schemas and Router

**Files:**
- Modify: `api/app/schemas/tree.py` (add journal schemas)
- Create: `api/app/routers/journal.py`
- Modify: `api/app/main.py` (register router)
- Create: `api/tests/test_journal.py`

**Step 1: Add schemas**

In `api/app/schemas/tree.py`, add after TurningPoint schemas:

```python
# --- JournalEntry ---

class JournalEntryCreate(BaseModel):
    encrypted_data: str

class JournalEntryUpdate(BaseModel):
    encrypted_data: str

class JournalEntryResponse(BaseModel):
    id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime
```

Note: no `person_ids` field. Journal entries are tree-scoped, entity links live inside the encrypted blob.

**Step 2: Create the router**

Create `api/app/routers/journal.py`. This is a simple CRUD router without `crud_helpers` (no junction table):

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.journal_entry import JournalEntry
from app.models.tree import Tree
from app.schemas.tree import JournalEntryCreate, JournalEntryResponse, JournalEntryUpdate

router = APIRouter(prefix="/trees/{tree_id}/journal", tags=["journal"])


@router.post("", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    body: JournalEntryCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryResponse:
    entry = JournalEntry(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return JournalEntryResponse(
        id=entry.id,
        encrypted_data=entry.encrypted_data,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.get("", response_model=list[JournalEntryResponse])
async def list_journal_entries(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[JournalEntryResponse]:
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.tree_id == tree.id)
        .order_by(JournalEntry.created_at.desc())
    )
    entries = result.scalars().all()
    return [
        JournalEntryResponse(
            id=e.id,
            encrypted_data=e.encrypted_data,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e in entries
    ]


@router.put("/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: uuid.UUID,
    body: JournalEntryUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryResponse:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id, JournalEntry.tree_id == tree.id
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )
    entry.encrypted_data = body.encrypted_data
    await db.commit()
    await db.refresh(entry)
    return JournalEntryResponse(
        id=entry.id,
        encrypted_data=entry.encrypted_data,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id, JournalEntry.tree_id == tree.id
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )
    await db.delete(entry)
    await db.commit()
```

**Step 3: Register router in main.py**

Add import and `app.include_router(journal_router)`.

**Step 4: Write tests**

Create `api/tests/test_journal.py`. Test: create (201), list (ordered desc), update, update nonexistent (404), delete (204), delete nonexistent (404), ownership isolation.

**Step 5: Verify and commit**

```bash
docker compose exec api uv run pytest tests/test_journal.py -v
docker compose exec api uv run pytest
docker compose exec api uv run mypy app/
docker compose exec api uv run bandit -r app/
```

Commit: `Add journal entries CRUD router and backend tests`

---

## Task 3: Frontend Types, API, and Data Hooks

**Files:**
- Modify: `frontend/src/types/domain.ts` (add interfaces)
- Modify: `frontend/src/types/api.ts` (add API types)
- Modify: `frontend/src/lib/api.ts` (add CRUD functions)
- Modify: `frontend/src/hooks/useTreeData.ts` (add journal query)
- Modify: `frontend/src/hooks/useTreeMutations.ts` (add journal mutations)

**Step 1: Add domain types**

In `frontend/src/types/domain.ts`:

```typescript
export interface JournalLinkedRef {
  entity_type: "person" | "trauma_event" | "life_event" | "turning_point" | "classification" | "pattern";
  entity_id: string;
}

export interface JournalEntry {
  text: string;
  linked_entities: JournalLinkedRef[];
}
```

**Step 2: Add API types**

In `frontend/src/types/api.ts`:

```typescript
// Journal
export interface JournalEntryCreate {
  encrypted_data: string;
}

export interface JournalEntryUpdate {
  encrypted_data: string;
}

export interface JournalEntryResponse {
  id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Add API functions**

In `frontend/src/lib/api.ts`:

```typescript
// Journal

export function getJournalEntries(treeId: string): Promise<JournalEntryResponse[]> {
  return apiFetchWithRetry(`/trees/${treeId}/journal`);
}

export function createJournalEntry(
  treeId: string,
  data: JournalEntryCreate,
): Promise<JournalEntryResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/journal`, {
    method: "POST",
    body: data,
  });
}

export function updateJournalEntry(
  treeId: string,
  entryId: string,
  data: JournalEntryUpdate,
): Promise<JournalEntryResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/journal/${entryId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteJournalEntry(treeId: string, entryId: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${treeId}/journal/${entryId}`, {
    method: "DELETE",
  });
}
```

**Step 4: Add to useTreeData**

Add `DecryptedJournalEntry` interface, query key, empty map, query hook. Return `journalEntries` from the hook. Follow the life events pattern but without `person_ids`.

```typescript
export interface DecryptedJournalEntry extends JournalEntry {
  id: string;
  created_at: string;
  updated_at: string;
}
```

**Step 5: Add to useTreeMutations**

Add create, update, delete mutations. No optimistic updates needed for MVP (journal entries aren't displayed in real-time like tree data). Invalidate on success.

**Step 6: Verify and commit**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
```

Commit: `Add journal entry data hooks and API functions`

---

## Task 4: Install react-markdown

**Files:**
- Modify: `frontend/package.json` (add dependency)

**Step 1: Install**

```bash
docker compose exec frontend npm install react-markdown
```

**Step 2: Verify no security issues**

```bash
docker compose exec frontend npm audit
```

**Step 3: Commit**

Commit: `Add react-markdown dependency for journal preview`

---

## Task 5: Translations

**Files:**
- Modify: `frontend/public/locales/en/translation.json`
- Modify: `frontend/public/locales/nl/translation.json`

**Step 1: Add English translations**

Add journal UI keys and all 24 reflection prompts:

```json
  "journal.title": "Journal",
  "journal.tab": "Journal",
  "journal.newEntry": "New entry",
  "journal.editEntry": "Edit entry",
  "journal.save": "Save entry",
  "journal.delete": "Delete entry",
  "journal.confirmDelete": "Click again to confirm",
  "journal.empty": "No journal entries yet. Start reflecting on your family tree.",
  "journal.preview": "Preview",
  "journal.write": "Write",
  "journal.linkEntity": "Link entity",
  "journal.linkedEntities": "Linked entities",
  "journal.inspiration": "Need inspiration?",
  "journal.textPlaceholder": "Write your reflection here...",

  "prompt.journal.1": "Who in your family tree do you most identify with, and why?",
  "prompt.journal.2": "What event had the most ripple effects across generations?",
  "prompt.journal.3": "Are there strengths or resilience patterns, not just trauma?",
  "prompt.journal.4": "What patterns do you notice repeating?",
  "prompt.journal.5": "What would you like future generations to know about your family?",
  "prompt.journal.6": "What was never spoken about, but everyone knew?",
  "prompt.journal.7": "Which relationship in your tree surprises you the most?",
  "prompt.journal.8": "If you could ask one ancestor a question, who and what would it be?",
  "prompt.journal.9": "What did your family teach you about handling difficult emotions?",
  "prompt.journal.10": "Where do you see yourself in this tree?",

  "prompt.person.1": "What strengths did {{name}} carry despite these experiences?",
  "prompt.person.2": "How did {{name}}'s turning point affect the next generation?",
  "prompt.person.3": "How has {{name}}'s diagnosis shaped the family's understanding?",
  "prompt.person.4": "What role did {{name}} play in holding the family together?",
  "prompt.person.5": "What do you wish {{name}} had known about themselves?",
  "prompt.person.6": "What did {{name}} pass on that you're grateful for?",
  "prompt.person.7": "How might {{name}}'s story have been different with more support?",
  "prompt.person.8": "What would you say to {{name}} if you could?",

  "prompt.pattern.1": "What does this pattern mean to you?",
  "prompt.pattern.2": "Where did this pattern begin, and who first broke it?",
  "prompt.pattern.3": "How does recognizing this pattern change how you see your family?",
  "prompt.pattern.4": "Is this pattern still active in your generation?",
  "prompt.pattern.5": "What would it take to transform this pattern?",
  "prompt.pattern.6": "Who in the family was most affected by this pattern?",

  "prompt.nudge.writeAbout": "Write about this",
  "prompt.nudge.dismiss": "Dismiss",
  "canvas.showReflectionPrompts": "Show reflection prompts"
```

**Step 2: Add Dutch translations**

Same keys with Dutch text. Use the design doc prompts translated to Dutch.

**Step 3: Commit**

Commit: `Add EN and NL translations for journal and reflection prompts`

---

## Task 6: Journal Components (List + Form)

**Files:**
- Create: `frontend/src/components/journal/JournalEntryList.tsx`
- Create: `frontend/src/components/journal/JournalEntryForm.tsx`
- Create: `frontend/src/components/journal/EntityLinkPicker.tsx`
- Create: `frontend/src/components/journal/Journal.css`
- Create: `frontend/src/lib/reflectionPrompts.ts`

**Step 1: Create reflection prompts module**

`frontend/src/lib/reflectionPrompts.ts`: Static arrays of prompt translation keys. Helper functions: `getRandomJournalPrompts(t, count)` returns `count` random prompts from the journal pool. `getPersonPrompt(t, person, data)` picks a contextual prompt based on what data exists. `getPatternPrompt(t)` picks a random pattern prompt.

**Step 2: Create EntityLinkPicker**

A dropdown component that shows available entities grouped by type (Persons, Trauma events, Life events, Turning points, Classifications, Patterns). Takes the tree data maps as props. Returns the selected `JournalLinkedRef` on pick. Follow the pattern picker in PatternPanel (`buildPersonEntityGroups`).

**Step 3: Create JournalEntryForm**

Markdown textarea with auto-grow. Toggle between "Write" and "Preview" modes. Preview renders markdown via `react-markdown`. "Link entity" button opens `EntityLinkPicker`. Linked entities shown as colored chips below textarea. Collapsible "Need inspiration?" section showing 3 random prompts (clicking inserts text). Save/Cancel/Delete buttons.

**Step 4: Create JournalEntryList**

Reverse chronological list of entry cards. Each card shows: relative timestamp, plaintext preview (first 100 chars), linked entity chips. Click to expand into edit mode (renders `JournalEntryForm` with existing data). "New entry" button at top.

**Step 5: Create CSS**

Follow existing panel styles. Entry cards use `detail-panel__event-card` pattern. Form uses `detail-panel__field` pattern. Markdown preview styled with minimal typography.

**Step 6: Write tests**

Test JournalEntryList rendering (empty state, entry cards, timestamps). Test JournalEntryForm (save callback, prompt insertion, entity linking). Test reflectionPrompts helpers.

**Step 7: Verify and commit**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
```

Commit: `Add journal entry list and form components`

---

## Task 7: Journal Panel (Slide-out)

**Files:**
- Create: `frontend/src/components/journal/JournalPanel.tsx`
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx` (add panel toggle + render)
- Modify: `frontend/src/pages/TimelinePage.tsx` (add panel toggle + render)

**Step 1: Create JournalPanel**

400px slide-out panel (same pattern as PatternPanel). Header with title and close button. Contains `JournalEntryList`. Takes tree data and mutations as props.

**Step 2: Add to TreeWorkspacePage**

Add `BookOpen` icon import from lucide-react. Add `journalPanelOpen` state. Add toggle button in toolbar (after pattern button). Render `JournalPanel` conditionally. Pass `journalEntries` from `useTreeData` and journal mutations.

**Step 3: Add to TimelinePage**

Same pattern: toggle button + panel rendering.

**Step 4: Verify and commit**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
```

Commit: `Add journal slide-out panel to canvas and timeline views`

---

## Task 8: Journal Page (Dedicated View)

**Files:**
- Create: `frontend/src/pages/JournalPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/tree/ViewTabs.tsx` (add journal tab)

**Step 1: Create JournalPage**

Full-width page following TimelinePage pattern. Uses TreeToolbar with `activeView="journal"`. Renders `JournalEntryList` in a centered content area (max-width ~800px for readability). Fetches data via `useTreeData`.

**Step 2: Add route**

In `App.tsx`, add lazy import and route:
```tsx
const JournalPage = lazyWithReload(() => import("./pages/JournalPage"));
// In routes:
<Route path="/trees/:id/journal" element={<AuthGuard><JournalPage /></AuthGuard>} />
```

**Step 3: Add journal tab to ViewTabs**

In `frontend/src/components/tree/ViewTabs.tsx`, add `"journal"` to `ActiveView` type. Add tab with `BookOpen` icon and route `/trees/${compactId}/journal`.

**Step 4: Verify and commit**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
```

Commit: `Add dedicated journal page with toolbar tab`

---

## Task 9: Reflection Prompts (Contextual + Nudge)

**Files:**
- Modify: `frontend/src/hooks/useCanvasSettings.ts` (add `showReflectionPrompts`)
- Modify: `frontend/src/components/tree/CanvasSettingsContent.tsx` (add toggle)
- Create: `frontend/src/components/tree/ReflectionNudge.tsx`
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx` (contextual prompt)
- Modify: `frontend/src/components/PatternView.tsx` (contextual prompt)
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx` (nudge banner)

**Step 1: Add settings toggle**

Add `showReflectionPrompts: boolean` to `CanvasSettings` (default: true). Add toggle in `CanvasSettingsContent` in the "Other" section.

**Step 2: Create ReflectionNudge**

Small banner component above the footer. Shows one random journal prompt per session. "Write about this" button calls `onOpenJournal(promptText)`. "Dismiss" button hides for the session. Styled like the mental health support banner (muted, unobtrusive).

**Step 3: Add nudge to TreeWorkspacePage**

Render `ReflectionNudge` when `canvasSettings.showReflectionPrompts` is true and journal panel is not already open. "Write about this" opens the journal panel with the prompt pre-filled.

**Step 4: Add contextual prompts to PersonDetailPanel**

Below the person header, show a muted prompt when `showReflectionPrompts` is true. Use `getPersonPrompt(t, person, data)` to pick a relevant prompt. Clicking opens the journal panel with the prompt and person pre-linked.

**Step 5: Add contextual prompts to PatternView**

On expanded pattern detail cards, show a muted prompt. Clicking opens journal with prompt and pattern pre-linked.

**Step 6: Write tests**

Test ReflectionNudge rendering and dismiss. Test settings toggle. Test contextual prompt display conditions.

**Step 7: Verify and commit**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
```

Commit: `Add contextual reflection prompts and canvas nudge banner`

---

## Task 10: Final Verification

**Step 1: Run full verification suite**

```bash
docker compose exec frontend npx vitest run
docker compose exec frontend npx tsc --noEmit
docker compose exec api uv run pytest
docker compose exec api uv run mypy app/
docker compose exec api uv run bandit -r app/
make quality
```

**Step 2: Update roadmap**

Mark #2 (Reflection journal) and #3 (Guided reflection prompts) as done.

**Step 3: Commit**

Commit: `Mark reflection journal and guided prompts as done in roadmap`
