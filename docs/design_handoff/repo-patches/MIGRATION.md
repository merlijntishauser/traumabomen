# Migration: `--color-accent` → `--color-action` for interactive elements

The patch in `0001-design-tokens-add-color-action.patch` updates `theme.css` only — it adds the new `--color-action*` token family and rewires the base layer (anchor links, focused inputs, `.btn--primary`).

**You still need to rewire any component CSS / inline styles that use `--color-accent*` for interactive purposes.** This is a one-shot manual pass — the heuristic is simple and there aren't many call sites.

## The rule

| Use `--color-action*` for… | Keep `--color-accent*` for… |
|---|---|
| Primary buttons (`.btn--primary` already done) | The logomark stroke & dots |
| Links (`a`, already done in base) | The leaf icon (`leaf-motif.svg`, `<IconLeaf>`) |
| Focused input borders & focus rings (base done) | Tree-edge "default" line color |
| Checkbox checked state | Workspace canvas ambient gradient (`--color-accent-subtle` radial) |
| Segmented-toggle / tab active state | Lifebar fill/stroke (it's the *tree's* timeline) |
| The SELECTED node ring (`box-shadow` on a focused node) | Scrollbar thumb hover |
| Active nav item background | "Demo tree" badge background |

## Find the call sites

From `frontend/` run:

```bash
grep -rn "color-accent" src --include="*.css" --include="*.tsx" --include="*.ts"
```

For each hit, ask: **does it represent an action, or the brand/a tree?**

- Action → rename `--color-accent` → `--color-action` (and `-hover`, `-subtle`, `-focus-ring`, `-border` likewise)
- Brand/tree → leave it alone

## Likely files to touch (based on names)

These will probably contain interactive-role uses:

- `components/AuthModal.css` — primary submit, focus rings, segmented login/register toggle
- `components/LockScreen.css` — unlock button, focus on passphrase
- `components/ConfirmDeleteButton.css` — focus ring
- `components/PasswordInput.css` — focus ring
- `components/OnboardingGate.css` — primary CTA, link colors
- `components/FeedbackModal.tsx`/`.css` — submit button, focused textarea
- Anything with `is-active`, `is-selected`, `is-checked`, `--active`, `--selected` class modifiers
- Sidebar / tree-list-item `:hover` text color, "selected tree" highlight
- Tab strip in the workspace toolbar

These should **stay** on `--color-accent`:

- `components/Logomark.tsx` — the brand mark
- Anything drawing tree edges (`--color-edge-*` already exists; check anything still using `--color-accent` directly here)
- `MentalHealthBanner.css` — content tint, not an action
- Workspace canvas background gradient

## Sanity check

After the rewire, toggle `[data-theme="light"]`. You should see:

- ✅ Primary CTAs, focused inputs, checked checkboxes, the segmented login/register toggle, active tabs, the SELECTED node ring → **indigo**
- ✅ The wordmark, leaf icon, tree edges, ambient canvas glow → **still green**
- ✅ The unlock-passphrase focus ring → **indigo**

If a button comes out green on cream, that hit got missed. If the leaf icon goes indigo, you rewired one too many.

## Applying the patch

```bash
cd traumabomen
git checkout -b feat/action-accent-light-indigo
git apply path/to/0001-design-tokens-add-color-action.patch
# … then do the component CSS rewires per the table above
git add -A && git commit -m "design: light theme uses indigo for actions; brand stays green"
git push -u origin feat/action-accent-light-indigo
gh pr create --fill
```

The updated `theme.css` (full file, post-patch) is also included in this folder at `frontend/src/styles/theme.css` if you'd rather drop it in than apply the diff.
