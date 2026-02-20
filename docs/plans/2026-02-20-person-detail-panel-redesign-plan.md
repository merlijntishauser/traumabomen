# PersonDetailPanel Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the accordion-based PersonDetailPanel with a tabbed panel featuring sub-panel editing, richer summaries, and progressive person linking.

**Architecture:** Extract the monolithic 1,479-line component into a shell (`PersonDetailPanel`) with tab navigation, plus 6 extracted sub-components (`PersonTab`, `RelationshipsTab`, `EventsTab`, `ClassificationsTab`, `EditSubPanel`, `PersonLinkField`). Forms move into the sub-panel slide-over pattern. CSS updated for tabs, cards, and transitions.

**Tech Stack:** React 19, TypeScript, lucide-react icons, existing CSS variables from theme.css

**Design doc:** `docs/plans/2026-02-20-person-detail-panel-redesign.md`

---

## Phase 1: Foundation (EditSubPanel + PersonLinkField)

Build the two shared primitives first since all tabs depend on them.

### Task 1: EditSubPanel component

The slide-over container used by all edit forms. Renders a header with back button and title, scrollable content slot, and footer with save/cancel/delete.

**Files:**
- Create: `frontend/src/components/tree/EditSubPanel.tsx`
- Create: `frontend/src/components/tree/EditSubPanel.test.tsx`
- Modify: `frontend/src/styles/detail-panel.css` (add sub-panel styles)

**Step 1:** Write the test file.

```tsx
// EditSubPanel.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditSubPanel } from "./EditSubPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("EditSubPanel", () => {
  it("renders title and children", () => {
    render(
      <EditSubPanel title="Edit Event" onBack={vi.fn()}>
        <div>form content</div>
      </EditSubPanel>,
    );
    expect(screen.getByText("Edit Event")).toBeInTheDocument();
    expect(screen.getByText("form content")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(
      <EditSubPanel title="Edit" onBack={onBack}>
        <div />
      </EditSubPanel>,
    );
    fireEvent.click(screen.getByLabelText("common.close"));
    expect(onBack).toHaveBeenCalled();
  });

  it("renders footer actions when provided", () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    render(
      <EditSubPanel
        title="Edit"
        onBack={vi.fn()}
        onSave={onSave}
        onDelete={onDelete}
        deleteLabel="Delete event"
      >
        <div />
      </EditSubPanel>,
    );
    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByText("Delete event")).toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onSave={onSave}>
        <div />
      </EditSubPanel>,
    );
    fireEvent.click(screen.getByText("common.save"));
    expect(onSave).toHaveBeenCalled();
  });

  it("uses two-click confirmation for delete", () => {
    const onDelete = vi.fn();
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onDelete={onDelete} deleteLabel="Delete">
        <div />
      </EditSubPanel>,
    );
    const deleteBtn = screen.getByText("Delete");
    fireEvent.click(deleteBtn);
    expect(onDelete).not.toHaveBeenCalled();
    // Second click confirms
    fireEvent.click(screen.getByText(/confirm/i));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

**Step 2:** Run tests, verify they fail (component doesn't exist yet).

**Step 3:** Implement `EditSubPanel.tsx`.

```tsx
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface EditSubPanelProps {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
}

export function EditSubPanel({
  title,
  onBack,
  onSave,
  onDelete,
  deleteLabel,
  children,
}: EditSubPanelProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="detail-panel__sub-panel">
      <div className="detail-panel__sub-header">
        <button
          type="button"
          className="detail-panel__sub-back"
          onClick={onBack}
          aria-label={t("common.close")}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="detail-panel__sub-title">{title}</span>
      </div>
      <div className="detail-panel__sub-body">{children}</div>
      {(onSave || onDelete) && (
        <div className="detail-panel__sub-footer">
          {onSave && (
            <button
              type="button"
              className="detail-panel__btn detail-panel__btn--primary"
              onClick={onSave}
            >
              {t("common.save")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="detail-panel__btn detail-panel__btn--danger detail-panel__btn--small"
              onClick={() => {
                if (confirmDelete) {
                  onDelete();
                  setConfirmDelete(false);
                } else {
                  setConfirmDelete(true);
                }
              }}
            >
              {confirmDelete ? t("common.delete") + "?" : (deleteLabel ?? t("common.delete"))}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4:** Add CSS for sub-panel to `detail-panel.css`:

```css
/* Sub-panel slide-over */
.detail-panel__sub-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  animation: slide-in-right 0.2s ease-out;
}

.detail-panel__sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-primary);
}

.detail-panel__sub-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
}

.detail-panel__sub-back:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.detail-panel__sub-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-panel__sub-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.detail-panel__sub-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--color-border-primary);
}
```

**Step 5:** Run tests, verify they pass. Commit: `"Add EditSubPanel slide-over container component"`.

---

### Task 2: PersonLinkField component

Progressive disclosure person selector. Shows "Linked to: Name" by default, expands to checkbox list on click.

**Files:**
- Create: `frontend/src/components/tree/PersonLinkField.tsx`
- Create: `frontend/src/components/tree/PersonLinkField.test.tsx`

**Step 1:** Write the test file.

```tsx
// PersonLinkField.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { PersonLinkField } from "./PersonLinkField";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function makePerson(id: string, name: string): DecryptedPerson {
  return {
    id, name, birth_year: 1980, birth_month: null, birth_day: null,
    death_year: null, death_month: null, death_day: null,
    gender: "other", is_adopted: false, notes: null,
  };
}

const persons = new Map([
  ["p1", makePerson("p1", "Alice")],
  ["p2", makePerson("p2", "Bob")],
  ["p3", makePerson("p3", "Carol")],
]);

describe("PersonLinkField", () => {
  it("shows single linked person name in collapsed state", () => {
    render(
      <PersonLinkField
        allPersons={persons}
        selectedIds={new Set(["p1"])}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows multiple linked person names separated by comma", () => {
    render(
      <PersonLinkField
        allPersons={persons}
        selectedIds={new Set(["p1", "p2"])}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("expands to show checkboxes when link button clicked", () => {
    render(
      <PersonLinkField
        allPersons={persons}
        selectedIds={new Set(["p1"])}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/link/i));
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("calls onChange when a person checkbox is toggled", () => {
    const onChange = vi.fn();
    render(
      <PersonLinkField
        allPersons={persons}
        selectedIds={new Set(["p1"])}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText(/link/i));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));
    expect(onChange).toHaveBeenCalledWith(new Set(["p1", "p2"]));
  });

  it("prevents unchecking the last person", () => {
    const onChange = vi.fn();
    render(
      <PersonLinkField
        allPersons={persons}
        selectedIds={new Set(["p1"])}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText(/link/i));
    fireEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 2:** Run tests, verify fail.

**Step 3:** Implement `PersonLinkField.tsx` (simple component: collapsed line with expand button, expanded checkbox list with toggle logic and "prevent last removal" guard from existing `togglePersonInSet` utility).

**Step 4:** Run tests, verify pass. Commit: `"Add PersonLinkField progressive disclosure component"`.

---

## Phase 2: Tab Shell

### Task 3: Replace accordion with tab navigation

Rewrite the main `PersonDetailPanel.tsx` to use tabs instead of accordion sections. This task only changes the navigation shell; tab content remains as-is (just wrapped in tab containers instead of accordion sections).

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx`
- Modify: `frontend/src/styles/detail-panel.css`
- Modify: `frontend/src/components/tree/PersonDetailPanel.test.tsx`

**Steps:**

1. Add persistent person header (name, years, gender) above the tab bar. Use heading font, accent color, 18px. Remove the current header that only shows person name.

2. Replace the 5 accordion toggle buttons with a tab bar. Each tab: icon + count badge. Use lucide-react icons: `User` (person), `GitFork` (relationships), `Circle` (trauma), `Square` (life events), `Triangle` (classifications). Active tab gets accent bottom border.

3. Replace section toggle state (`personOpen`, `relsOpen`, etc.) with a single `activeTab` state. Map `initialSection` prop to the correct tab.

4. Wrap each section's content in a conditional render based on `activeTab`. No accordion, no collapse; only the active tab's content renders.

5. Widen panel from 400px to 440px in CSS.

6. Add tab bar CSS: flex row, 32px height, icon + badge layout, accent bottom border for active tab.

7. Update tests: replace accordion toggle interactions (`click section header to expand`) with tab switching interactions (`click tab to switch`). The CRUD tests inside each section should still work; they just need a tab click before the section content is visible.

8. Run full test suite, fix any failures. Commit: `"Replace accordion with tabbed navigation in PersonDetailPanel"`.

---

## Phase 3: Richer Summaries

### Task 4: Event card summaries

Replace the minimal event list items (title + date) with richer cards showing category pill and severity/impact bar.

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx` (event list rendering, lines ~556-708)
- Modify: `frontend/src/styles/detail-panel.css` (event card styles)
- Modify: `frontend/src/components/tree/PersonDetailPanel.test.tsx`

**Steps:**

1. Create an `EventCard` inline component (or extract) that renders: badge shape (circle/square) in category color, title, date, category pill label, severity/impact mini-bar (10 small dots, filled up to the value).

2. Add CSS for `.detail-panel__event-card` (tertiary background, 8px border-radius, 12px padding), `.detail-panel__category-pill` (small inline label with category color at low opacity), `.detail-panel__severity-bar` (flex row of 10 small squares).

3. Apply the same card pattern to both trauma events and life events tabs.

4. Add tests verifying: category pill text renders, severity bar renders correct number of filled elements, card shows all expected info.

5. Run tests. Commit: `"Add richer event card summaries with category pills and severity bars"`.

### Task 5: Classification card summaries

Replace the minimal classification list items with cards showing status pill, period summary, and DSM names.

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx` (classification list, lines ~709-791)
- Modify: `frontend/src/styles/detail-panel.css`
- Modify: `frontend/src/components/tree/PersonDetailPanel.test.tsx`

**Steps:**

1. Render each classification as a card: triangle badge in status color, subcategory name (or category), status pill ("Suspected"/"Diagnosed"), category name, period summary ("2015, ongoing" or "2010-2018").

2. Add CSS for status pill (amber/blue background variants).

3. Add tests verifying: status pill renders, period summary shows, DSM names display correctly.

4. Run tests. Commit: `"Add richer classification card summaries with status pills and periods"`.

---

## Phase 4: Sub-Panel Editing

### Task 6: Wire EditSubPanel into event editing

Replace inline event form rendering with the sub-panel slide-over pattern.

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx`
- Modify: `frontend/src/components/tree/PersonDetailPanel.test.tsx`

**Steps:**

1. When user clicks an event card (or "New event"), set `editingEventId` (or `showNewEvent`) and render `EditSubPanel` instead of the event list.

2. Move `EventForm` content inside `EditSubPanel`. The sub-panel's `onBack` clears `editingEventId`/`showNewEvent`. The `onSave` and `onDelete` props wire through.

3. Replace inline person checkboxes with `PersonLinkField` at the top of the form.

4. Same pattern for `LifeEventForm`.

5. Update tests: verify sub-panel renders on card click, back button returns to list, save/delete still work.

6. Run tests. Commit: `"Use EditSubPanel slide-over for event editing"`.

### Task 7: Wire EditSubPanel into classification and relationship editing

Same sub-panel pattern for classifications and relationships.

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx`
- Modify: `frontend/src/components/tree/PersonDetailPanel.test.tsx`

**Steps:**

1. Classifications: click card opens `EditSubPanel` with `ClassificationForm`. Replace inline person checkboxes with `PersonLinkField`.

2. Relationships: click edit on a partner relationship opens `EditSubPanel` with `PartnerPeriodEditor`.

3. Update tests for both sections.

4. Run tests. Commit: `"Use EditSubPanel for classification and relationship editing"`.

---

## Phase 5: Extraction and Cleanup

### Task 8: Extract tab content into separate components

Extract each tab's content into its own file to reduce the main component from ~1,479 lines.

**Files:**
- Create: `frontend/src/components/tree/PersonTab.tsx`
- Create: `frontend/src/components/tree/RelationshipsTab.tsx`
- Create: `frontend/src/components/tree/TraumaEventsTab.tsx`
- Create: `frontend/src/components/tree/LifeEventsTab.tsx`
- Create: `frontend/src/components/tree/ClassificationsTab.tsx`
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx` (import and render extracted tabs)

**Steps:**

1. Extract each tab's JSX and state into its own component. The main `PersonDetailPanel` becomes a thin shell: person header, tab bar, and renders the active tab component.

2. Move the sub-form components (`EventForm`, `LifeEventForm`, `ClassificationForm`, `PartnerPeriodEditor`) into the tab files that use them, or into their own files if shared.

3. The main component should be under 200 lines after extraction.

4. Run all tests (they should still pass since the public API hasn't changed).

5. Commit: `"Extract tab content into separate components"`.

### Task 9: Final test update and quality check

**Steps:**

1. Run `docker compose exec frontend npx tsc --noEmit` to check types.
2. Run `docker compose exec frontend npx vitest run` to verify all tests pass.
3. Run `make complexity` to check cognitive complexity.
4. Run `make quality` to verify coverage gates.
5. Fix any issues. Commit: `"Clean up and verify PersonDetailPanel redesign"`.

---

## Verification

After all tasks:

- `docker compose exec frontend npx tsc --noEmit` (no type errors)
- `docker compose exec frontend npx vitest run` (all tests pass)
- `make complexity` (no functions above threshold)
- `make quality` (coverage gates pass)
- Manual: open a person in the tree canvas, verify tabs work, edit an event via sub-panel, link to multiple persons
