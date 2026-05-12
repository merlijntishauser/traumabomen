# Repo patch — `--color-action` token split

This folder is a self-contained patch package for `merlijntishauser/traumabomen` that introduces the **`--color-action`** interactive-accent token (indigo in light theme, green in dark) while keeping `--color-accent` as the brand color (green in both themes).

## Contents

```
repo-patches/
├── README.md                                       (this file)
├── MIGRATION.md                                    (component-file rewire guide)
├── 0001-design-tokens-add-color-action.patch       (unified diff vs main)
├── frontend/src/styles/theme.css                   (full updated file)
└── docs/design-system/                             (documentation drop-in)
    ├── README.md                                   (system: voice, visuals, content)
    ├── SKILL.md                                    (AI-handoff guide)
    ├── colors_and_type.css                         (mirror of theme.css w/ doc comments)
    └── preview/                                    (HTML preview cards for every token)
```

## How to apply

**Option A — apply the diff** (clean history):

```bash
cd traumabomen
git checkout -b feat/action-accent-light-indigo
git apply path/to/repo-patches/0001-design-tokens-add-color-action.patch
```

**Option B — drop in the updated file** (faster):

```bash
cp path/to/repo-patches/frontend/src/styles/theme.css \
   traumabomen/frontend/src/styles/theme.css
```

Either way, then follow `MIGRATION.md` to rewire the component CSS files. Commit, push, open the PR.

## What this does

- Adds a `--color-action*` family (`-hover`, `-subtle`, `-focus-ring`, `-border`) in `:root` (green) and `[data-theme="light"]` (indigo `#4f46e5`).
- Rewires `theme.css`'s own base layer — anchor links, focused inputs, `.btn--primary` — to use the new tokens.
- Changes `--color-node-selected` in light theme to indigo so the SELECTED-node ring stays consistent.
- Leaves the brand color (`--color-accent`) untouched in both themes. Logo, leaf, tree edges keep their green identity.

## Why split the token

On warm cream (`#f7f5f2`), a green primary button reads as a generic wellness-app pattern. Indigo on cream reads editorial and literary — closer to the *"reflection tool, not therapy"* voice in the product copy. Splitting the role means the *forest stays the forest* (brand) while *actions* feel calm and considered (interaction). Dark theme keeps green for both because the dark forest carries the editorial register on its own.
