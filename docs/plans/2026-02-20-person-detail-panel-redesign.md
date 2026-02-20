# PersonDetailPanel Redesign

## Problem

The current PersonDetailPanel crams 5 editing interfaces (person fields, relationships, trauma events, life events, classifications) into a single 400px accordion panel. This causes:

1. **Excessive scrolling**: all sections stacked vertically, users scroll constantly between sections
2. **Ambiguous edit mode**: inline forms appear inside accordion sections with no clear visual distinction between browsing and editing
3. **Sparse summaries**: event/classification lists show only title + date; category, severity, and periods are hidden until you open the edit form
4. **Buried multi-person linking**: person checkboxes at the bottom of long forms require extra scrolling for a rarely-used feature

## Design

### Panel Structure

Replace the accordion with a **tabbed panel**. The panel widens from 400px to 440px. Layout:

```
+-- Person Name Header (always visible) ------- [X] --+
|  Name (heading font), years, gender icon            |
+-- Tab Bar ---------------------------------------+
|  [Person] [Rels 3] [Trauma 5] [Life 2] [DSM 1]    |
+-- Tab Content (scrollable) ----------------------+
|                                                     |
|  (selected tab's content here)                      |
|                                                     |
+-----------------------------------------------------+
```

The **person name header** is persistent across all tabs, showing name in heading font, birth/death years, and gender. Clicking the name switches to the Person tab.

The **tab bar** uses compact icon-based tabs with count badges. Active tab uses accent color bottom border. Tabs without items show no badge; tabs with items show the count as a small number.

### Tab: Person

Compact card layout with grouped fields:

- **Identity**: name (large input), gender (inline pill selector: M/F/Other)
- **Dates**: birth year/month/day in one row, death year/month/day in one row. All three fields always visible (empty ones show placeholder). No cascade hiding.
- **Details**: adopted toggle, notes textarea
- **Actions**: Save (primary), Delete (danger, small text)

### Tab: Relationships

List of relationships, each row showing:

- Type-colored left border (solid = biological, dashed = step/adoptive, pink = partner)
- Relationship type label + direction
- Partner name
- For partners: period summary inline ("Together 2000, Married 2005")
- Edit button (opens sub-panel)

### Tabs: Trauma Events / Life Events

Same list pattern for both. Each event renders as a **card**:

- Badge (circle for trauma, square for life) in category color
- Title + date on first line
- Category as small pill label
- Severity (trauma) or impact (life) as a mini bar visualization
- Click card to edit (opens sub-panel)
- "New event" button at top of list

### Tab: Classifications

List of classifications, each as a card:

- Triangle badge in status color (amber suspected, blue diagnosed)
- DSM subcategory name (or category if no sub)
- Status pill
- Category name + period summary ("2015, ongoing")
- Click card to edit (opens sub-panel)
- "New classification" button at top

### Sub-Panel Edit Pattern

All edit forms (relationships, events, classifications) use the same **slide-over** pattern:

1. Current list slides left or fades out
2. Edit form slides in from the right
3. Header: `< Back` + entity title
4. Form fields
5. Save/Cancel buttons at bottom
6. Delete as small danger text below Save
7. Person linking near the top (see below)

This makes edit mode unmistakable vs. list browsing.

### Multi-Person Linking: Progressive Disclosure

Default state: a single line "Linked to: PersonName" near the top of the form, with a "+ Link to others" text button.

Clicking "+ Link to others" expands a checkbox list of all persons. The current person is pre-checked. Collapse with a "Done" button or on save.

This keeps the 95% single-person case clean (zero extra space) while the 5% multi-person case is one click away.

## Visual Treatment

All visuals follow the existing dark forest design system:

- **Tab bar**: accent-colored bottom border on active tab, secondary background, 32px height consistent with toolbar
- **Event cards**: subtle background tint (tertiary), 8px border-radius, 12px padding. Category pills use existing category color variables at low opacity
- **Severity/impact bar**: 10 small squares, filled squares use accent color, empty use border color
- **Sub-panel slide**: 0.2s ease-out transition, consistent with existing panel slide timing
- **Person header**: heading font (Playwrite NZ Basic) at weight 300, accent color, 18px size

## Files

### Modified

| File | Changes |
|------|---------|
| `PersonDetailPanel.tsx` | Replace accordion with tabs, extract sub-panel pattern, simplify forms |
| `detail-panel.css` | New tab bar styles, card styles, sub-panel transition, updated layout |

### Potentially Extracted

| File | Purpose |
|------|---------|
| `PersonTab.tsx` | Person fields card (extracted from monolith) |
| `RelationshipsTab.tsx` | Relationship list + sub-panel editing |
| `EventsTab.tsx` | Shared event list pattern (used by both trauma and life event tabs) |
| `ClassificationsTab.tsx` | Classification list + sub-panel editing |
| `EditSubPanel.tsx` | Shared slide-over edit container |
| `PersonLinkField.tsx` | Progressive disclosure person checkbox field |

## Testing

- Tab switching renders correct content
- Sub-panel slide opens on edit click, closes on back/cancel
- Person link field progressive disclosure (expand/collapse)
- Event card summary renders category pill, severity bar
- All existing CRUD flows still work (save, delete, create)

## Migration

The redesign replaces the existing PersonDetailPanel entirely. No backward compatibility needed since it is a single-use component. Existing tests will need updating to match the new tab-based navigation.
