# Code Review Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 6 code review findings: split large components, reduce prop count, narrow exception handling, extract rate limiter constants.

**Architecture:** Pure refactoring -- no behavioral changes. Extract sub-components from large files, group related props into objects, replace broad `except Exception` with specific exception types, name magic numbers. All existing tests must continue to pass.

**Tech Stack:** React/TypeScript (frontend), Python/FastAPI (backend)

---

### Task 1: Extract RelationshipPopover and RelationshipPrompt from TreeWorkspacePage

**Files:**
- Create: `frontend/src/components/tree/RelationshipPopover.tsx`
- Create: `frontend/src/components/tree/RelationshipPrompt.tsx`
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx`

**Step 1: Create RelationshipPopover component**

Create `frontend/src/components/tree/RelationshipPopover.tsx` containing the `RelationshipPopover` function (lines 104-157 of TreeWorkspacePage.tsx), along with the `DIRECTIONAL_TYPES` constant and `T_COMMON_CANCEL` constant it uses. Imports needed:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@xyflow/react";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";
```

Export the component and the `DIRECTIONAL_TYPES` set (also used by RelationshipPrompt).

**Step 2: Create RelationshipPrompt component**

Create `frontend/src/components/tree/RelationshipPrompt.tsx` containing the `RelationshipPrompt` function (lines 159-294 of TreeWorkspacePage.tsx). Import `DIRECTIONAL_TYPES` from `./RelationshipPopover`. Imports needed:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";
import { DIRECTIONAL_TYPES } from "./RelationshipPopover";
```

**Step 3: Update TreeWorkspacePage imports**

Remove `RelationshipPopover`, `RelationshipPrompt`, `DIRECTIONAL_TYPES`, and `T_COMMON_CANCEL` from TreeWorkspacePage.tsx. Add imports:

```tsx
import { RelationshipPopover } from "../components/tree/RelationshipPopover";
import { RelationshipPrompt } from "../components/tree/RelationshipPrompt";
```

Remove the `RelationshipType` import only if it's no longer used directly (it is still used in `handleCreateRelationship` -- keep it).

**Step 4: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Expected: All pass, no type errors.

**Step 5: Commit**

```bash
git add frontend/src/components/tree/RelationshipPopover.tsx frontend/src/components/tree/RelationshipPrompt.tsx frontend/src/pages/TreeWorkspacePage.tsx
git commit -m "Extract RelationshipPopover and RelationshipPrompt from TreeWorkspacePage"
```

---

### Task 2: Extract canvas toolbar buttons from TreeWorkspacePage

**Files:**
- Create: `frontend/src/components/tree/CanvasToolbarButtons.tsx`
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx`

**Step 1: Create CanvasToolbarButtons component**

Extract the toolbar button JSX (lines 742-788 of TreeWorkspacePage.tsx -- the children passed to `<TreeToolbar>`) into a new component. Props:

```tsx
interface CanvasToolbarButtonsProps {
  onAddPerson: () => void;
  isAddingPerson: boolean;
  onAutoLayout: () => void;
  hasLayout: boolean;
  onUndo: () => void;
  canUndo: boolean;
  patternPanelOpen: boolean;
  onTogglePatterns: () => void;
  journalPanelOpen: boolean;
  onToggleJournal: () => void;
}
```

Import `BookOpen, LayoutGrid, Undo2, UserPlus, Waypoints` from lucide-react in this file.

**Step 2: Use CanvasToolbarButtons in TreeWorkspacePage**

Replace the inline toolbar buttons with `<CanvasToolbarButtons>`, passing the relevant props. Remove the lucide imports that are no longer used in TreeWorkspacePage (`BookOpen`, `LayoutGrid`, `Undo2`, `UserPlus`, `Waypoints`) -- keep `TreePine` which is used in the empty state.

**Step 3: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Expected: All pass.

**Step 4: Commit**

```bash
git add frontend/src/components/tree/CanvasToolbarButtons.tsx frontend/src/pages/TreeWorkspacePage.tsx
git commit -m "Extract canvas toolbar buttons from TreeWorkspacePage"
```

---

### Task 3: Split AdminPage into section components

**Files:**
- Create: `frontend/src/hooks/useAdminData.ts`
- Create: `frontend/src/components/admin/OverviewSection.tsx`
- Create: `frontend/src/components/admin/FunnelSection.tsx`
- Create: `frontend/src/components/admin/GrowthSection.tsx`
- Create: `frontend/src/components/admin/ActivitySection.tsx`
- Create: `frontend/src/components/admin/RetentionSection.tsx`
- Create: `frontend/src/components/admin/UsageSection.tsx`
- Create: `frontend/src/components/admin/UserListSection.tsx`
- Create: `frontend/src/components/admin/WaitlistSection.tsx`
- Create: `frontend/src/components/admin/FeedbackSection.tsx`
- Create: `frontend/src/components/admin/FeatureTogglesSection.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`

**Step 1: Create useAdminData hook**

Extract all `useQuery` and `useMutation` calls (lines 352-417 of AdminPage.tsx) plus the derived loading/error state (lines 419-440) into `frontend/src/hooks/useAdminData.ts`. Return all query results and mutation functions as a typed object. Also move the `formatDate` helper here since multiple sections will need it.

```ts
export interface AdminData {
  overview: UseQueryResult<...>;
  funnel: UseQueryResult<...>;
  // ... all query results
  approveMutation: UseMutationResult<...>;
  // ... all mutations
  isLoading: boolean;
  error: Error | null;
  formatDate: (iso: string, locale: string) => string;
}
```

**Step 2: Create section components**

Each section component receives only the data it needs from the hook. Pattern for each:

- `OverviewSection`: receives `overview.data`, renders the 4 overview cards
- `FunnelSection`: receives `funnel.data`, renders funnel bars. Move `FUNNEL_STEP_KEYS` constant here.
- `GrowthSection`: receives `growth.data`. Move `GrowthChart` component here.
- `ActivitySection`: receives `activity.data`. Move `DAY_I18N_KEYS`, `heatmapColor`, heatmap grid logic here.
- `RetentionSection`: receives `retention.data`. Move `retentionColor` here.
- `UsageSection`: receives `usage.data`. Move `UsageChart` component and `BUCKET_LABELS` here.
- `UserListSection`: receives `users.data`, `formatDate`.
- `WaitlistSection`: receives `waitlist.data`, `waitlistCapacity.data`, mutations. Move waitlist rendering here.
- `FeedbackSection`: receives `feedback.data`, mutations. Move feedback rendering here.
- `FeatureTogglesSection`: receives `features.data`, `users.data`, mutation. Move the `FeatureToggleCard` component here (currently exported from AdminPage for testing).

Each component should be a simple function component with typed props. No new CSS files needed -- reuse existing `admin.css` classes.

**Step 3: Simplify AdminPage**

AdminPage.tsx becomes the shell: toolbar + loading/error + section composition. Approximately:

```tsx
export default function AdminPage() {
  const { t } = useTranslation();
  const logout = useLogout();
  const data = useAdminData();

  return (
    <div className="admin-page">
      {/* toolbar */}
      {data.isLoading && ...}
      {data.error && ...}
      {!data.isLoading && !data.error && (
        <div className="admin-content">
          <OverviewSection data={data.overview.data} />
          <FunnelSection data={data.funnel.data} />
          {/* etc */}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Update FeatureToggleCard test import**

The test at `frontend/src/pages/FeatureToggleCard.test.tsx` imports `FeatureToggleCard` from `../pages/AdminPage`. Update the import to point to `../components/admin/FeatureTogglesSection`.

**Step 5: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Expected: All pass.

**Step 6: Commit**

```bash
git add frontend/src/hooks/useAdminData.ts frontend/src/components/admin/ frontend/src/pages/AdminPage.tsx frontend/src/pages/FeatureToggleCard.test.tsx
git commit -m "Split AdminPage into section components with useAdminData hook"
```

---

### Task 4: Group PersonDetailPanel callback props

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx`
- Modify: `frontend/src/components/WorkspacePanelHost.tsx`
- Modify: `frontend/src/pages/TimelinePage.tsx` (if it passes PersonDetailPanel props)

**Step 1: Define handler group interfaces**

In PersonDetailPanel.tsx, group the 12 save/delete callbacks into 2 objects:

```tsx
export interface PersonDetailHandlers {
  onSavePerson: (data: Person) => void;
  onDeletePerson: (personId: string) => void;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => void;
  onClose: () => void;
}

export interface EntityHandlers {
  onSaveEvent: (eventId: string | null, data: TraumaEvent, personIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
  onSaveLifeEvent: (lifeEventId: string | null, data: LifeEvent, personIds: string[]) => void;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  onSaveTurningPoint: (turningPointId: string | null, data: TurningPoint, personIds: string[]) => void;
  onDeleteTurningPoint: (turningPointId: string) => void;
  onSaveClassification: (classificationId: string | null, data: Classification, personIds: string[]) => void;
  onDeleteClassification: (classificationId: string) => void;
}
```

Update `PersonDetailPanelProps` to use these:

```tsx
interface PersonDetailPanelProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints: DecryptedTurningPoint[];
  classifications: DecryptedClassification[];
  allPersons: Map<string, DecryptedPerson>;
  initialSection?: PersonDetailSection;
  initialEntityId?: string;
  handlers: PersonDetailHandlers;
  entityHandlers: EntityHandlers;
  showReflectionPrompts?: boolean;
  onOpenJournal?: (prompt: string, linkedRef?: JournalLinkedRef) => void;
}
```

This reduces props from 19 to 13. Destructure `handlers` and `entityHandlers` inside the component to keep internal code unchanged.

**Step 2: Update callers**

In `WorkspacePanelHost.tsx`, build the `handlers` and `entityHandlers` objects from the existing handler refs:

```tsx
<PersonDetailPanel
  // ... data props unchanged
  handlers={{
    onSavePerson: handlers.handleSavePerson,
    onDeletePerson: handlers.handleDeletePerson,
    onSaveRelationship: handlers.handleSaveRelationship,
    onClose: () => panels.setSelectedPersonId(null),
  }}
  entityHandlers={{
    onSaveEvent: handlers.eventHandlers.save,
    onDeleteEvent: handlers.eventHandlers.remove,
    onSaveLifeEvent: handlers.lifeEventHandlers.save,
    // ... etc
  }}
/>
```

Check `TimelinePage.tsx` for the same pattern and update if needed.

**Step 3: Update PersonDetailPanel test**

Update `frontend/src/components/tree/PersonDetailPanel.test.tsx` to pass grouped props.

**Step 4: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Expected: All pass.

**Step 5: Commit**

```bash
git add frontend/src/components/tree/PersonDetailPanel.tsx frontend/src/components/WorkspacePanelHost.tsx frontend/src/pages/TimelinePage.tsx frontend/src/components/tree/PersonDetailPanel.test.tsx
git commit -m "Group PersonDetailPanel callback props into handler objects"
```

---

### Task 5: Split SettingsPanel into section sub-components

**Files:**
- Create: `frontend/src/components/tree/settings/ChangePasswordSection.tsx`
- Create: `frontend/src/components/tree/settings/ChangePassphraseSection.tsx`
- Create: `frontend/src/components/tree/settings/DeleteAccountSection.tsx`
- Modify: `frontend/src/components/tree/SettingsPanel.tsx`

**Step 1: Create ChangePasswordSection**

Extract the password change state variables (`pwCurrent`, `pwNew`, `pwConfirm`, `pwMessage`, `pwLoading`) and the `handleChangePassword` function plus the password form JSX (lines 371-421 of SettingsPanel.tsx). This component manages its own state:

```tsx
export function ChangePasswordSection() {
  const { t } = useTranslation();
  const [pwCurrent, setPwCurrent] = useState("");
  // ... all password state
  // ... handleChangePassword
  // ... return JSX
}
```

**Step 2: Create ChangePassphraseSection**

Extract passphrase state (`ppCurrent`, `ppNew`, `ppConfirm`, `ppMessage`, `ppLoading`, `ppProgress`), `handleChangePassphraseMigrated`, `handleChangePassphraseLegacy`, `handleChangePassphrase`, and the passphrase form JSX (lines 425-471). Needs `isMigrated`, `setMasterKey`, `setPassphraseHash` from EncryptionContext:

```tsx
export function ChangePassphraseSection() {
  const { t } = useTranslation();
  const { isMigrated, setMasterKey, setPassphraseHash } = useEncryption();
  // ... all passphrase state and handlers
}
```

**Step 3: Create DeleteAccountSection**

Extract delete state (`deleteExpanded`, `deleteConfirmText`, `deletePassword`, `deleteMessage`, `deleteLoading`), `handleDeleteAccount`, and the delete form JSX (lines 475-523). Needs `useLogout`:

```tsx
export function DeleteAccountSection() {
  const { t } = useTranslation();
  const logout = useLogout();
  // ... all delete state and handlers
}
```

**Step 4: Simplify SettingsPanel**

SettingsPanel.tsx keeps: `open` state, `tab` state, positioning logic, click-outside handling, the trigger button, the portal dropdown, and the tab bar. The account tab content becomes:

```tsx
{tab === "account" && (
  <>
    <ChangePasswordSection />
    <div className="settings-panel__divider" />
    <ChangePassphraseSection />
    <div className="settings-panel__divider" />
    <DeleteAccountSection />
  </>
)}
```

This reduces SettingsPanel from 532 to ~130 lines, and each section sub-component is 80-130 lines owning its own state.

**Step 5: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Expected: All pass.

**Step 6: Commit**

```bash
git add frontend/src/components/tree/settings/ frontend/src/components/tree/SettingsPanel.tsx
git commit -m "Split SettingsPanel into ChangePassword, ChangePassphrase, and DeleteAccount sections"
```

---

### Task 6: Narrow exception handling in backend

**Files:**
- Modify: `api/app/email.py`

**Step 1: Replace broad exceptions with specific types**

In `_send_cta_email` (line 236-241), replace:
```python
except Exception:
```
with:
```python
except (smtplib.SMTPException, OSError):
```

In `send_feedback_email` (line 321-324), replace:
```python
except Exception:
```
with:
```python
except (smtplib.SMTPException, OSError):
```

In `send_email_background` (line 340-342), replace:
```python
with contextlib.suppress(Exception):
```
with:
```python
with contextlib.suppress(smtplib.SMTPException, OSError):
```

Note: `smtplib.SMTPException` covers all SMTP errors. `OSError` covers connection failures (refused, timeout, DNS). Together they cover all realistic email sending failures.

Do NOT change `sync.py:375` -- that `except Exception` is a top-level error handler for a transactional operation that correctly logs and re-raises. It's the right pattern there.

**Step 2: Run tests and checks**

Run: `docker compose exec api uv run pytest`
Run: `docker compose exec api uv run mypy app/`
Run: `docker compose exec api uv run bandit -r app/`
Expected: All pass.

**Step 3: Commit**

```bash
git add api/app/email.py
git commit -m "Narrow email exception handling to SMTPException and OSError"
```

---

### Task 7: Extract rate limiter magic numbers into named constants

**Files:**
- Modify: `api/app/rate_limiter.py`

**Step 1: Define named constants**

Add constants near the top of the file (after existing constants):

```python
# Login tarpit thresholds
FREE_ATTEMPTS = 3          # attempts 1-3: no delay
SHORT_TARPIT_DELAY = 5     # seconds delay for attempts 4-6
LONG_TARPIT_DELAY = 30     # seconds delay for attempts 7-9
SHORT_TARPIT_THRESHOLD = 4 # attempt count that triggers short delay
LONG_TARPIT_THRESHOLD = 7  # attempt count that triggers long delay
LOCKOUT_THRESHOLD = 10     # attempt count that triggers 429
```

**Step 2: Use constants in functions**

Update `_tarpit_delay`:
```python
def _tarpit_delay(attempts: int) -> int:
    if attempts >= LONG_TARPIT_THRESHOLD:
        return LONG_TARPIT_DELAY
    if attempts >= SHORT_TARPIT_THRESHOLD:
        return SHORT_TARPIT_DELAY
    return 0
```

Update `check_and_tarpit`:
```python
if worst >= LOCKOUT_THRESHOLD:
```

**Step 3: Run tests and checks**

Run: `docker compose exec api uv run pytest`
Run: `docker compose exec api uv run mypy app/`
Expected: All pass.

**Step 4: Commit**

```bash
git add api/app/rate_limiter.py
git commit -m "Extract rate limiter magic numbers into named constants"
```

---

### Task 8: Final verification

**Step 1: Run all test suites**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Run: `docker compose exec api uv run pytest`
Run: `docker compose exec api uv run mypy app/`
Run: `make quality` (if available)
Run: `make complexity` (if available)

**Step 2: Verify no regressions**

All tests pass, no type errors, no quality degradation.
