# Sibling Groups Design

## Problem

Users want to indicate that a person has siblings without creating full Person nodes for each one. For example, a stepmother with 9 brothers and sisters: the user wants to show "she is one of 10 children" without cluttering the tree with 9 extra nodes.

## Solution

A new SiblingGroup entity that holds lightweight sibling records (name and optional birth year) alongside references to full Person nodes. Renders as a compact pill node on the canvas.

## Data Model

New encrypted entity following the existing pattern:

```typescript
interface SiblingGroupMember {
  name: string;              // empty string for unnamed siblings
  birth_year: number | null;
}

// Encrypted payload (client-side only, stored as encrypted_data on server)
interface SiblingGroupData {
  members: SiblingGroupMember[];
}

// Full decrypted entity
interface DecryptedSiblingGroup {
  id: string;
  person_ids: string[];           // full Person nodes in this sibling group
  members: SiblingGroupMember[];  // lightweight siblings not in the tree
}
```

Server stores: `{ id, tree_id, encrypted_data, person_ids[], created_at, updated_at }`.

**Constraint:** A person can belong to at most one SiblingGroup per tree. Backend validates on create/update; rejects with 409 if violated.

Total sibling count = `person_ids.length + members.length`.

When a SiblingGroup has zero members left (all promoted), it persists as long as it links 2+ persons, serving as an explicit sibling grouping.

## API

Same pattern as TraumaEvent, LifeEvent, Classification, etc.:

```
GET    /trees/{id}/sibling-groups
POST   /trees/{id}/sibling-groups
PUT    /trees/{id}/sibling-groups/{group_id}
DELETE /trees/{id}/sibling-groups/{group_id}
```

Request/response: `{ id, encrypted_data, person_ids }`.

Bulk sync (`POST /trees/{id}/sync`) gains a `sibling_groups` field so promotion (create person + update group + create relationships) happens atomically.

## Canvas Visualization

**Node appearance:** Compact pill-shaped React Flow node. Shows "siblings (9)" or, when 4 or fewer named members, a stacked name list. Muted style: lighter border, slightly transparent background, smaller text. No badges (no trauma/life events on the group).

**Positioning in Dagre layout:**
- If any person in `person_ids` has a parent node in the tree, the group node connects to that parent as a child (dashed edge). Appears alongside the real siblings.
- If no parent exists in the tree, the group node connects to the first person in `person_ids` with a horizontal sibling edge (dashed).

**Edge styling:** Dashed line, same color as biological sibling edges at reduced opacity.

**Interaction:** Click opens a detail panel listing all members by name and year.

## Editing UX

**Creating a group:** From the Relationships tab in PersonDetailPanel. "Add sibling group" button appears if the person doesn't belong to a group. Creates a new group with this person in `person_ids` and opens an inline editor.

**Adding members:** Repeating row form: name (text) + birth year (number, optional). "Add row" button appends entries. Empty names render as "unnamed sibling."

**Editing:** Click the group node on canvas or via the Relationships tab of any person in `person_ids`.

**Joining an existing group:** If a person's biological sibling already belongs to a group, the Relationships tab offers "Join existing sibling group" instead of "Add sibling group."

**Promoting a member:** Each member row has a "promote" action:
1. Creates a new Person with the member's name and birth_year
2. Adds biological sibling relationships to all persons in `person_ids`
3. Adds the new person to the group's `person_ids`
4. Removes them from `members`

All in a single bulk sync call.

## Testing

**Backend (pytest):**
- CRUD for sibling-groups
- Uniqueness constraint: person can't belong to two groups (409)
- Bulk sync with sibling_groups
- Ownership isolation
- Referential integrity (person_ids must exist in the tree)

**Frontend unit (Vitest):**
- SiblingGroupNode rendering: pill display, member count, name list
- Promotion flow: creates person, updates group, creates relationships
- Group editor: add/remove rows, save
- Layout logic: parent connection vs. sibling edge fallback
- useTreeData integration: groups load alongside other entities

**Integration (Playwright):**
- Create person, add sibling group, add members, verify node on canvas
- Promote member, verify new Person node and relationship edges
- Delete group, verify node removed
