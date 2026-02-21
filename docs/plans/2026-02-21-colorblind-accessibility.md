# Colorblind Accessibility Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the app usable for red-green colorblind users by adjusting category palettes and adding badge initials for disambiguation.

**Architecture:** Two targeted changes: (1) shift CSS color variables for trauma and life event categories so they remain distinguishable under protanopia/deuteranopia simulation, (2) render a category initial inside person-node badges when multiple badges of the same shape exist.

**Tech Stack:** CSS custom properties (theme.css), React (PersonNode.tsx), i18n translation keys.

---

## Context

The app encodes entity types with shapes (circle = trauma, square = life event, triangle = classification). Within each shape, category is distinguished by color only. For red-green colorblind users (~8% of men), several color pairs become indistinguishable:

- Trauma: Abuse (red) vs Addiction (orange), Illness (green) vs app accent (green)
- Life events: Health (pink) vs Career (orange)
- Trauma Loss (indigo) vs Poverty (purple) are close but passable

The app is a personal reflection tool, not a dashboarding tool, so scanning color at a glance is nice-to-have. The real requirement is that nothing is invisible or broken.

## Design decisions

- No new theme toggle or settings; adjust existing palettes in-place
- Badge initials only appear when 2+ badges of the same shape exist on a node
- Initials use the first letter of the translated category name (locale-aware)
- Badges grow from 10px to 12px when showing initials

---

### Task 1: Adjust trauma category palette for red-green distinguishability

**Files:**
- Modify: `frontend/src/styles/theme.css` (lines 48-54, 147-153)
- Modify: `frontend/src/lib/traumaColors.ts` (lines 37-45)

**Step 1: Update dark theme trauma colors in theme.css**

Change lines 48-54 from:
```css
--color-trauma-loss: #818cf8;
--color-trauma-abuse: #f87171;
--color-trauma-addiction: #fb923c;
--color-trauma-war: #a8a29e;
--color-trauma-displacement: #facc15;
--color-trauma-illness: #4ade80;
--color-trauma-poverty: #a78bfa;
```

To:
```css
--color-trauma-loss: #818cf8;
--color-trauma-abuse: #f87171;
--color-trauma-addiction: #fbbf24;
--color-trauma-war: #a8a29e;
--color-trauma-displacement: #e879f9;
--color-trauma-illness: #22d3ee;
--color-trauma-poverty: #a78bfa;
```

Changes:
- Addiction: orange (#fb923c) to amber (#fbbf24) - separates from red Abuse under deuteranopia
- Illness: green (#4ade80) to cyan (#22d3ee) - avoids green/accent confusion
- Displacement: yellow (#facc15) to fuchsia (#e879f9) - yellow was close to new amber Addiction

**Step 2: Update light theme trauma colors in theme.css**

Change lines 147-153 from:
```css
--color-trauma-loss: #6366f1;
--color-trauma-abuse: #ef4444;
--color-trauma-addiction: #f97316;
--color-trauma-war: #78716c;
--color-trauma-displacement: #ca8a04;
--color-trauma-illness: #16a34a;
--color-trauma-poverty: #7c3aed;
```

To:
```css
--color-trauma-loss: #6366f1;
--color-trauma-abuse: #ef4444;
--color-trauma-addiction: #d97706;
--color-trauma-war: #78716c;
--color-trauma-displacement: #c026d3;
--color-trauma-illness: #0891b2;
--color-trauma-poverty: #7c3aed;
```

**Step 3: Update static fallback map in traumaColors.ts**

Change the TRAUMA_COLORS object to match the new dark theme defaults:
```typescript
export const TRAUMA_COLORS: Record<TraumaCategory, string> = {
  [TraumaCategory.Loss]: "#818cf8",
  [TraumaCategory.Abuse]: "#f87171",
  [TraumaCategory.Addiction]: "#fbbf24",
  [TraumaCategory.War]: "#a8a29e",
  [TraumaCategory.Displacement]: "#e879f9",
  [TraumaCategory.Illness]: "#22d3ee",
  [TraumaCategory.Poverty]: "#a78bfa",
};
```

**Step 4: Run tests**

Run: `docker compose exec frontend npx vitest run`
Expected: All tests pass (color fallbacks changed but tests reference TRAUMA_COLORS export directly).

**Step 5: Commit**

```
git add frontend/src/styles/theme.css frontend/src/lib/traumaColors.ts
git commit -m "Adjust trauma palette for red-green colorblind distinguishability"
```

---

### Task 2: Adjust life event category palette

**Files:**
- Modify: `frontend/src/styles/theme.css` (lines 61-67, 158-164)
- Modify: `frontend/src/lib/lifeEventColors.ts` (lines 37-45)

**Step 1: Update dark theme life event colors in theme.css**

Change lines 61-67 from:
```css
--color-life-family: #60a5fa;
--color-life-education: #a78bfa;
--color-life-career: #f59e0b;
--color-life-relocation: #34d399;
--color-life-health: #f472b6;
--color-life-medication: #2dd4bf;
--color-life-other: #94a3b8;
```

To:
```css
--color-life-family: #60a5fa;
--color-life-education: #a78bfa;
--color-life-career: #fbbf24;
--color-life-relocation: #2dd4bf;
--color-life-health: #f472b6;
--color-life-medication: #22d3ee;
--color-life-other: #94a3b8;
```

Changes:
- Career: orange (#f59e0b) to amber (#fbbf24) - separates from pink Health under deuteranopia
- Relocation: green (#34d399) to teal (#2dd4bf) - was the old Medication value, avoids green confusion
- Medication: teal (#2dd4bf) to cyan (#22d3ee) - shifts bluer to separate from new Relocation

**Step 2: Update light theme life event colors**

Change lines 158-164 from:
```css
--color-life-family: #3b82f6;
--color-life-education: #7c3aed;
--color-life-career: #d97706;
--color-life-relocation: #059669;
--color-life-health: #db2777;
--color-life-medication: #0d9488;
--color-life-other: #64748b;
```

To:
```css
--color-life-family: #3b82f6;
--color-life-education: #7c3aed;
--color-life-career: #d97706;
--color-life-relocation: #0d9488;
--color-life-health: #db2777;
--color-life-medication: #0891b2;
--color-life-other: #64748b;
```

**Step 3: Update static fallback map in lifeEventColors.ts**

```typescript
export const LIFE_EVENT_COLORS: Record<LifeEventCategory, string> = {
  [LifeEventCategory.Family]: "#60a5fa",
  [LifeEventCategory.Education]: "#a78bfa",
  [LifeEventCategory.Career]: "#fbbf24",
  [LifeEventCategory.Relocation]: "#2dd4bf",
  [LifeEventCategory.Health]: "#f472b6",
  [LifeEventCategory.Medication]: "#22d3ee",
  [LifeEventCategory.Other]: "#94a3b8",
};
```

**Step 4: Run tests**

Run: `docker compose exec frontend npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```
git add frontend/src/styles/theme.css frontend/src/lib/lifeEventColors.ts
git commit -m "Adjust life event palette for red-green colorblind distinguishability"
```

---

### Task 3: Add badge initials to PersonNode when multiple same-shape badges exist

**Files:**
- Modify: `frontend/src/components/tree/PersonNode.tsx`
- Modify: `frontend/src/components/tree/PersonNode.css`
- Modify: `frontend/src/components/tree/PersonNode.test.tsx`

**Step 1: Write failing tests**

Add to `PersonNode.test.tsx`:

```typescript
it("shows category initial on trauma badges when multiple trauma events exist", () => {
  const events = [
    makeEvent({ id: "e1", category: TraumaCategory.Loss, title: "E1" }),
    makeEvent({ id: "e2", category: TraumaCategory.Abuse, title: "E2" }),
  ];
  const { container } = renderNode(makePerson(), { events });

  const badges = container.querySelectorAll(".person-node__badge");
  // "L" for Loss (from t("trauma.category.loss") which returns "trauma.category.loss", first char "t")
  // In test mock, t() returns the key, so first char of "trauma.category.loss" is "t"
  // We check that badges have text content (initials rendered)
  expect(badges[0].textContent).toBeTruthy();
  expect(badges[1].textContent).toBeTruthy();
});

it("does not show initial on trauma badge when only one trauma event exists", () => {
  const events = [makeEvent({ id: "e1", category: TraumaCategory.Loss })];
  const { container } = renderNode(makePerson(), { events });

  const badge = container.querySelector(".person-node__badge");
  expect(badge?.textContent).toBe("");
});

it("shows initial on life event badges when multiple life events exist", () => {
  const lifeEvents = [
    makeLifeEvent({ id: "le1", category: LifeEventCategory.Family }),
    makeLifeEvent({ id: "le2", category: LifeEventCategory.Career }),
  ];
  const { container } = renderNode(makePerson(), { lifeEvents });

  const badges = container.querySelectorAll(".person-node__badge--life");
  expect(badges[0].textContent).toBeTruthy();
  expect(badges[1].textContent).toBeTruthy();
});

it("does not show initial when only one life event badge exists", () => {
  const lifeEvents = [makeLifeEvent({ id: "le1" })];
  const { container } = renderNode(makePerson(), { lifeEvents });

  const badge = container.querySelector(".person-node__badge--life");
  expect(badge?.textContent).toBe("");
});

it("shows initial on classification badges when multiple exist", () => {
  const classifications = [
    makeClassification({ id: "c1", status: "diagnosed" }),
    makeClassification({ id: "c2", status: "suspected" }),
  ];
  const { container } = renderNode(makePerson(), { classifications });

  const badges = container.querySelectorAll(".person-node__badge--classification");
  expect(badges[0].textContent).toBeTruthy();
  expect(badges[1].textContent).toBeTruthy();
});
```

**Step 2: Run tests to verify they fail**

Run: `docker compose exec frontend npx vitest run -- PersonNode.test`
Expected: 5 new tests fail (badges have no text content yet).

**Step 3: Implement badge initials in PersonNode.tsx**

Add a helper function before the component:

```typescript
function badgeInitial(label: string): string {
  return label.charAt(0).toUpperCase();
}
```

In the component, compute whether initials are needed:

```typescript
const showTraumaInitials = events.length > 1;
const showLifeInitials = lifeEvents.length > 1;
const showClassInitials = classifications.length > 1;
```

Update trauma badge rendering (the `<span className="person-node__badge">` element):

```tsx
<span
  className={`person-node__badge${showTraumaInitials ? " person-node__badge--with-initial" : ""}`}
  style={{ backgroundColor: getTraumaColor(event.category) }}
>
  {showTraumaInitials && badgeInitial(t(`trauma.category.${event.category}`))}
</span>
```

Apply same pattern for life event badges and classification badges:

Life events:
```tsx
<span
  className={`person-node__badge person-node__badge--life${showLifeInitials ? " person-node__badge--with-initial" : ""}`}
  style={{ backgroundColor: getLifeEventColor(event.category) }}
>
  {showLifeInitials && badgeInitial(t(`lifeEvent.category.${event.category}`))}
</span>
```

Classifications:
```tsx
<span
  className={`person-node__badge person-node__badge--classification${showClassInitials ? " person-node__badge--with-initial" : ""}`}
  style={{ backgroundColor: getClassificationColor(cls.status) }}
>
  {showClassInitials && badgeInitial(t(`classification.status.${cls.status}`))}
</span>
```

**Step 4: Add CSS for badge-with-initial**

Add to `PersonNode.css` after the existing badge styles (after line 75):

```css
.person-node__badge--with-initial {
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-inverse);
}

.person-node__badge--classification.person-node__badge--with-initial {
  width: 14px;
  height: 14px;
  font-size: 6px;
  padding-top: 3px;
}
```

The classification triangle needs to be slightly larger because the clip-path cuts away space at the top, so the initial needs padding-top to sit in the visible area.

**Step 5: Run tests to verify they pass**

Run: `docker compose exec frontend npx vitest run -- PersonNode.test`
Expected: All tests pass.

**Step 6: Run full test suite and type check**

Run: `docker compose exec frontend npx tsc --noEmit && docker compose exec frontend npx vitest run`
Expected: 0 type errors, all tests pass.

**Step 7: Commit**

```
git add frontend/src/components/tree/PersonNode.tsx frontend/src/components/tree/PersonNode.css frontend/src/components/tree/PersonNode.test.tsx
git commit -m "Add category initials to badges when multiple same-shape badges exist"
```

---

## What stays the same

- Shape encoding (circle/square/triangle) is unchanged
- Tooltip content and behavior is unchanged
- Badge click to open detail panel is unchanged
- Detail panel pills, status labels, and text always accompany color
- Relationship edge colors and dash patterns are unchanged (already use pattern + color)
- Classification colors (amber/cyan) are unchanged (already well-separated for colorblind)
- Pattern colors are unchanged (user-chosen)
