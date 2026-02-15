# Frontend Code Coverage: 45% to 75%

## Goal

Raise TypeScript statement coverage from 45% (797/1771) to 75% (1329/1771) by covering 532 additional statements using a bottom-up approach: pure functions first, then small hooks and components, then medium-complexity hooks.

## Phase 1: Pure function tests (~300 statements, 45% -> 62%)

| File | Gap | Approach |
|------|-----|----------|
| `timelineHelpers.ts` | 130 stmts | Extend existing suite for lines 291-608 (axis/marker/strip rendering helpers) |
| `lib/api.ts` | 110 stmts | New test file; mock `fetch`; each API function is a thin wrapper |
| `relationshipEdgeHelpers.ts` | 42 stmts | Extend existing suite for lines 113, 145-238 |
| `treeLayoutHelpers.ts` | 18 stmts | Cover remaining branches |

## Phase 2: Small hooks and simple components (~117 statements, 62% -> 69%)

| File | Gap | Approach |
|------|-----|----------|
| `BranchDecoration.tsx` | 43 | Render SVG, assert structure |
| `useCanvasSettings.ts` | 16 | `renderHook` + localStorage mock |
| `useTheme.ts` | 13 | `renderHook` + matchMedia mock |
| `MentalHealthBanner.tsx` | 11 | Render, assert text |
| `MobileBanner.tsx` | 10 | Render, assert text |
| `useTreeId.ts` | 8 | `renderHook` + mocked useParams |
| `useLogout.ts` | 6 | `renderHook` + mocked navigate |
| `AppFooter.tsx` | 5 | Render, assert text |
| `ThemeToggle.tsx` | 3 | Render + click |
| `AuthHero.tsx` | 2 | Render |

## Phase 3: Medium-complexity tests (~124 statements, 69% -> 76%)

| File | Gap | Approach |
|------|-----|----------|
| `useTreeMutations.ts` | 95 | `renderHook` with mocked encryption context, tree data, and API |
| `RelationshipEdge.tsx` | 29 | Render with mocked React Flow edge props |

## Excluded (not needed for 75%)

- `SettingsPanel.tsx` (137 stmts) -- heavy mocking, save for 85%+
- `PersonDetailPanel.tsx` (164 stmts) -- already partially tested, complex
- `RelationshipDetailPanel.tsx` (51 stmts) -- component-level
- `TimelineView.tsx` (70 stmts) -- D3 DOM manipulation

## Verification

```bash
docker compose exec frontend npx vitest run --coverage
# Target: >= 75% statement coverage
```
