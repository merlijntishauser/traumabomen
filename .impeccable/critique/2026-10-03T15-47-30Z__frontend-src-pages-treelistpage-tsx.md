---
target: tree list + first run
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/Users/merlijn/Development/personal/traumabomen/frontend/src/pages/TreeListPage.tsx"
target_fingerprint: "sha256:2357a934b1855974a442933490cd6965409d98e4cb5a1217439d8a099996cb6a"
target_path: /Users/merlijn/Development/personal/traumabomen/frontend/src/pages/TreeListPage.tsx
timestamp: 2026-10-03T15-47-30Z
slug: frontend-src-pages-treelistpage-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Meta line is excellent; empty trees read "Not started yet · updated this minute" |
| 2 | Match System / Real World | 2 | "Tree" never explained; "encryption key" vs "passphrase"; "Sandbox" on demo |
| 3 | User Control and Freedom | 3 | Cancel everywhere; welcome card vanishes on create; edit+delete open on two rows at once |
| 4 | Consistency and Standards | 1 | Create/rename input is unstyled UA Arial with inset border, white in dark; UA-blue focus ring; banned left-border callout |
| 5 | Error Prevention | 2 | Always-visible red Delete per row; confirm never names the tree or mentions export |
| 6 | Recognition Rather Than Recall | 3 | Continue card + meta line good; icon-only import |
| 7 | Flexibility and Efficiency | 2 | No sort/search; list not sorted by recency though hero is |
| 8 | Aesthetic and Minimalist Design | 2 | 8 controls in empty state, two duplicated pairs; same tree twice; stale welcome copy |
| 9 | Error Recovery | 1 | "Registration failed" for a field-specific 422; decrypt failure rendered as tree name; raw import err.message |
| 10 | Help and Documentation | 2 | Gate recommends demo data with no button; no guidance on starting a tree |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict
Surface is product-specific (forest photography, Playwrite wordmark, toolbar hairline, the Continue card with a rotating open question); composition is generic (bordered project list with always-visible Edit/Delete, beta banner with three equal buttons, one-line empty state). The most important moment, naming a first family tree, gets the least design. Detector: CLI 0 findings on TreeListPage/OnboardingGate/UnlockPage (problems live in CSS/computed styles). Browser overlay: onboarding 5, empty list 16, populated 15 findings; side-tab on .welcome-card (real), side-tab on toolbar ::after (false positive, documented accent line), overused-font Lato (false positive), buried-raster welcome-dark.jpg at opacity 0 in light (real), 10px footer text x8 (real), low-contrast hits (real).

## Priority Issues
1. [P1] First-run empty state inverts hierarchy: accent button is "Send us a message" (TreeListPage.tsx:185-191), first-tree action is default grey and duplicated, Demo duplicated, copy opens with "This is an early version of the app", real empty line is 14px muted below the card. Fix: one composed empty state when trees.length === 0 (voice line, what a tree is, one primary create, quiet "explore a fictional family"); hide toolbar create/demo; feedback to footer; drop left border. -> /impeccable onboard
2. [P1] Safety gate can be skipped and hides support: OnboardingGuard (App.tsx:124-141) only re-syncs false->true; register() sets flag false (lib/api.ts:231) but a guard already holding true in the same tab never re-arms, so logout -> register in one tab skips the gate (observed by B, explained by code). Gate also renders without the app footer, so the support link is off-screen at "What this may bring up", and "Try it with demo data" has no button. Fix: sync both directions (key state on account/user id), add support link and demo action to the gate. -> /impeccable harden
3. [P1] Accessibility on the one surface that could be fully accessible: light-theme meta/eyebrow/prompt #9aa5b2 on linen 2.2-2.5:1; #6b7a8d body/buttons 4.4:1 on white, 3.9:1 on linen; dark continue name #2d8a5e 3.74:1; focus drops to BODY after Create/Edit; no h1 ("My trees" is a span, TreeListPage.tsx:344); bare "Edit"/"Delete" names; UA-blue focus ring; 10px footer text. Fix: autoFocus inputs and restore focus, h1, named aria-labels, on-palette :focus-visible, lift muted text tokens on light. -> /impeccable audit
4. [P1] Create/rename input is a browser default (tree-list.css:142-146): Arial 14px, 2px inset, radius 0, white even in dark; 12px buttons 24.5px tall. Fix: system input token and button tiers, label "Name this tree", example placeholder, rename hint. -> /impeccable polish
5. [P2] Destructive actions over-exposed: red Delete always visible on every row; confirm "Delete this tree and all its data?" never names the tree or says it cannot be undone; long names wrap one word per line on mobile. Fix: per-row overflow menu, named irreversible confirm with export suggestion, one open row state at a time. -> /impeccable distill

## Persona Red Flags
Jordan: gate says try demo data with no button; "Create tree" vs "Create your first tree"; placeholder only "Tree name"; "Sandbox" jargon. Casey (390px): title truncates to "My ..."; toolbar buttons wrap inside 32px; red Verwijderen beside the row link; long names one word per line. Sam: no h1; focus lost after Create/Edit; repeated unlabeled Edit/Delete; UA-blue ring; five toolbar controls before content, no skip link; Escape on gate silently does nothing. Noor (evening after therapy, asked to map her mother's side): first sentence is the beta disclaimer, brightest button is feedback, light-theme muted text ~2.2:1, no support link at the gate, blank canvas after create with no "start with yourself".

## Minor Observations
Same tree in hero and list with one tree; welcome card persists with "Start by creating your first tree" after trees exist; list not sorted by updated_at; "Not started yet · updated..." contradiction; Lato weight 500 not loaded; welcome img 0.4s opacity transition breaks motion rule; hand-rolled 11px eyebrow vs 10px token; ASCII "..." vs "…"; hardcoded "Admin" string (TreeListPage.tsx:381-383); NL demo meta truncates; light-theme modal shadow keeps green tint; welcome-dark.jpg downloaded but invisible in light; 404 /api/auth/key-ring on first run; registration 422 surfaces only as "Registration failed" on step 3.

## Questions to Consider
- Why does the safety gate, the product's most important emotional moment, get a flat background and no support link while registration gets photography and fireflies?
- Should a first-time user ever see a list with zero items, or should "name your tree, then add yourself" be one guided step ending on a canvas with one person on it?
- Who is the "Send us a message" emphasis serving, for someone who has made nothing yet?
- Opening a tree is constant; rename and delete are rare and dangerous. Why equal, always-visible weight?
