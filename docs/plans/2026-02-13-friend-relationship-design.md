# Friend Relationship Type

## Context

The tree currently models family relationships (parent, sibling, step/adoptive) and partnerships. Friends fall outside this hierarchy but are relevant to trauma mapping -- they can be witnesses to events, sources of support, or both. Adding a friend relationship type lets users capture these connections without distorting the family tree structure.

## Data Model

Add `Friend = "friend"` to the `RelationshipType` enum. Friend relationships use the existing `RelationshipData` structure with `type: "friend"`. No temporal periods or active_period -- friendships don't need partner-style temporal tracking.

A friend can connect to multiple family members via separate friend edges. A person can be both a family member and a friend to other members.

The backend requires no changes -- it stores opaque encrypted relationship data, so a new type value passes through transparently.

## Visual Style

Friend edges use a **short dotted line** (`strokeDasharray: "2 4"`) with a distinct warm color (`--color-edge-friend`), differentiating them from all existing edge styles:

| Relationship | Line style |
|---|---|
| Biological parent/sibling | Solid, default color |
| Step/adoptive | Dashed (6 3), muted color |
| Partner | Solid thick, partner color |
| Ex-partner | Dashed (6 3), partner color |
| Half-sibling | Dotted (4 4), half-sibling color |
| Friend | Dotted (2 4), friend color |

Friend-only persons (those with no family or partner edges) get a subtle node styling distinction via a `--color-node-friend` CSS variable on the border or background.

## Layout Strategy

Friend edges are excluded from the Dagre layout graph. The family tree is laid out first, then friend-only persons are positioned separately:

1. Identify "friend-only" persons -- those with zero family/partner relationships, only friend edges.
2. For each friend-only person, find all family members they connect to.
3. Calculate the centroid (average x, average y) of those connected family members.
4. Place the friend node offset to the right of the tree, at the centroid's y-level.
5. Stack multiple friends vertically if they cluster at the same position.

Persons who are both family members and have friend connections to others stay in the family tree as normal. Only their friend edges get the dotted styling.

This keeps friends visually near the people they relate to, forming a loose column to the right of the tree, without disrupting the generational rows.

## Files to Modify

| File | Change |
|---|---|
| `frontend/src/types/domain.ts` | Add `Friend` to `RelationshipType` enum |
| `frontend/src/hooks/useTreeLayout.ts` | Filter friend edges from Dagre, position friend-only nodes after layout |
| `frontend/src/components/tree/RelationshipEdge.tsx` | Add friend edge styling |
| `frontend/src/components/tree/RelationshipEdge.css` | Add `--color-edge-friend` variable |
| `frontend/src/components/tree/PersonNode.tsx` / `.css` | Subtle visual tint for friend-only nodes |
| `frontend/src/components/tree/PersonDetailPanel.tsx` | Add "Friend" to relationship type picker |
| `frontend/src/components/tree/RelationshipDetailPanel.tsx` | Handle friend type (no periods) |
| `frontend/src/locales/en/translation.json` | Add `relationship.type.friend` |
| `frontend/src/locales/nl/translation.json` | Add `relationship.type.friend` |

## Out of Scope

- No temporal periods for friends
- No active_period for friends
- No inferred friend relationships
- Friends do not participate in fork/junction parent-child display
- No backend migration needed
