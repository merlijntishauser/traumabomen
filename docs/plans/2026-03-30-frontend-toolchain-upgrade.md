# Frontend Toolchain Upgrade Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Vite 7 to 8, @vitejs/plugin-react 5 to 6, and TypeScript 5.9 to 6.0 in a single coordinated migration.

**Architecture:** All three upgrades must land together because @vitejs/plugin-react 6 requires Vite 8 as a peer dependency, and TypeScript 6 is most cleanly tested against the final toolchain. The migration happens in the `frontend/` directory. Two unused Vite plugins are removed as part of cleanup. The vite config migrates from Rollup options to Rolldown equivalents (Vite 8's new bundler). TypeScript config needs minimal changes since explicit values already cover most TS 6 default changes.

**Tech Stack:** Vite 8 (Rolldown bundler), @vitejs/plugin-react 6 (Babel-free), TypeScript 6.0, Vitest 4, React 19

---

## Breaking Changes Summary

### Vite 8 (affects this project)

| Change | Impact | Action |
|--------|--------|--------|
| `build.rollupOptions` renamed to `build.rolldownOptions` | `vite.config.ts:57` uses `rollupOptions` | Rename config key |
| Object form of `manualChunks` removed | `vite.config.ts:59-64` uses object form | Convert to function form |
| Bundler changed from Rollup to Rolldown | Implicit | Verify build output |
| CSS minification now uses Lightning CSS | Implicit | Verify CSS output |
| Min browser targets: Chrome 111, Firefox 114, Safari 16.4 | Implicit | Acceptable for this project |

### Vite 8 (does NOT affect this project)

- `esbuild` config option deprecated (not used)
- `optimizeDeps.esbuildOptions` deprecated (not used)
- CommonJS interop changes (no CJS imports in app code)
- Removed plugin hooks: `shouldTransformCachedModule`, `resolveImportMeta`, `resolveFileUrl` (not used)
- `import.meta.hot.accept()` URL form removed (not used)

### @vitejs/plugin-react 6

| Change | Impact | Action |
|--------|--------|--------|
| Requires `peer vite@"^8.0.0"` | Cannot install without Vite 8 | Upgrade together |
| Babel removed as dependency | Project uses no Babel config | No action needed |
| React Compiler support via optional `@rolldown/plugin-babel` | Not using React Compiler | No action needed |

### TypeScript 6.0 (affects this project)

| Change | Impact | Action |
|--------|--------|--------|
| `types` defaults to `[]` (was: auto-include all `@types/*`) | Could break ambient type resolution | Verify with `tsc --noEmit`; add explicit `types` if needed |
| `strict` defaults to `true` | Already set explicitly | No action |
| `noUncheckedSideEffectImports` defaults to `true` | Already set explicitly | No action |
| `module` defaults to `esnext` | Already set explicitly to `ESNext` | No action |
| `target` defaults to `es2025` | Already set explicitly to `ES2020`/`ES2022` | No action |
| `rootDir` defaults to `.` | Using `noEmit: true`, no output structure affected | No action |

### TypeScript 6.0 (does NOT affect this project)

- `target: es5` deprecated (using ES2020)
- `moduleResolution: node` / `classic` removed (using `bundler`)
- `module: amd/umd/systemjs` removed (using `ESNext`)
- `import ... assert` deprecated (not used in codebase)
- `--esModuleInterop false` disallowed (not set to false)
- `--outFile` removed (using `noEmit: true`)

---

## Task 1: Create feature branch

**Files:** None (git operation)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b chore/frontend-toolchain-upgrade
```

- [ ] **Step 2: Verify clean state**

```bash
git status
```

Expected: clean working tree on `chore/frontend-toolchain-upgrade`

---

## Task 2: Remove unused Vite plugins

The `vite-plugin-top-level-await` and `vite-plugin-wasm` packages are in devDependencies but not imported anywhere in the codebase. Argon2 WASM is loaded via a script tag in `index.html`, not through Vite plugins. Removing them prevents peer dependency conflicts with Vite 8.

**Files:**
- Modify: `frontend/package.json:58-59`

- [ ] **Step 1: Verify plugins are unused**

```bash
cd frontend && grep -r "vite-plugin-top-level-await\|vite-plugin-wasm" src/ vite.config.ts vitest.config.ts
```

Expected: no matches

- [ ] **Step 2: Remove unused plugins from package.json**

In `frontend/package.json`, remove these two lines from `devDependencies`:

```diff
-    "vite-plugin-top-level-await": "^1.6.0",
-    "vite-plugin-wasm": "^3.6.0",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json
git commit -m "chore: remove unused vite-plugin-top-level-await and vite-plugin-wasm"
```

---

## Task 3: Update package versions

Update all three packages in a single edit to avoid intermediate broken states.

**Files:**
- Modify: `frontend/package.json:50,55,57`

- [ ] **Step 1: Update versions in package.json**

In `frontend/package.json`, make these changes in `devDependencies`:

```diff
-    "@vitejs/plugin-react": "^5.1.4",
+    "@vitejs/plugin-react": "^6.0.1",
```

```diff
-    "typescript": "~5.9.3",
+    "typescript": "~6.0.2",
```

```diff
-    "vite": "^7.3.1",
+    "vite": "^8.0.0",
```

- [ ] **Step 2: Commit package.json change**

```bash
git add frontend/package.json
git commit -m "chore: bump vite 8, plugin-react 6, typescript 6 in package.json"
```

---

## Task 4: Migrate vite.config.ts for Vite 8

Vite 8 replaces Rollup with Rolldown as the bundler. Two changes required: rename the config key and convert `manualChunks` from object form (removed) to function form.

**Files:**
- Modify: `frontend/vite.config.ts:55-67`

- [ ] **Step 1: Rename rollupOptions and convert manualChunks**

Replace the entire `build` block in `frontend/vite.config.ts:55-67`:

```typescript
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]@xyflow[\\/]/.test(id) || /[\\/]dagre[\\/]/.test(id))
            return "vendor-reactflow";
          if (/[\\/]@tanstack[\\/]/.test(id)) return "vendor-query";
          if (/[\\/]d3(-[^\\/]*)?[\\/]/.test(id)) return "vendor-d3";
          if (/[\\/](react-dom|react-router-dom|react)[\\/]/.test(id))
            return "vendor-react";
        },
      },
    },
  },
```

Note: `@xyflow` and `@tanstack` scoped packages are matched before `react` to prevent `@xyflow/react` from matching the `react` pattern. The `react-dom` and `react-router-dom` alternatives are listed before `react` in the regex to ensure longest-match-first behavior.

- [ ] **Step 2: Verify the config file is valid TypeScript**

Read the full file and confirm the structure is correct. The `Plugin` type import from `"vite"` remains valid in Vite 8.

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "chore: migrate vite config from rollupOptions to rolldownOptions

Convert manualChunks from object form (removed in Vite 8) to function
form with Rolldown bundler."
```

---

## Task 5: Regenerate lockfile

Install dependencies to regenerate `package-lock.json` with the new versions. This must happen after all package.json changes.

**Files:**
- Regenerate: `frontend/package-lock.json`

- [ ] **Step 1: Rebuild containers with new dependencies**

```bash
docker compose build frontend
```

Expected: successful build with no peer dependency errors.

If peer dependency errors occur with `@sentry/vite-plugin`, check if a newer version is needed. If `eslint` or `typescript-eslint` errors occur, check compatibility with TS 6.

- [ ] **Step 2: Regenerate lockfile by running npm install on host**

```bash
cd frontend && npm install
```

Expected: clean install, no ERESOLVE errors. The lockfile is updated.

- [ ] **Step 3: Start containers**

```bash
docker compose up -d
```

- [ ] **Step 4: Verify versions installed**

```bash
docker compose exec frontend npx tsc --version
docker compose exec frontend npx vite --version
```

Expected: TypeScript 6.0.x, Vite 8.x.x

- [ ] **Step 5: Commit lockfile**

```bash
git add frontend/package-lock.json
git commit -m "chore: regenerate lockfile for vite 8, plugin-react 6, typescript 6"
```

---

## Task 6: Fix TypeScript errors

TS 6 changes several defaults. The project's tsconfigs already set most values explicitly, but the `types` default change (from auto-include to `[]`) could surface missing ambient types.

**Files:**
- Possibly modify: `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`

- [ ] **Step 1: Run type checker for app code**

```bash
docker compose exec frontend npx tsc --noEmit --project tsconfig.app.json
```

If errors reference missing global types (e.g., `NodeJS`, `process`, `Buffer`), add an explicit `types` field to `tsconfig.app.json`:

```json
"types": ["node"]
```

If errors reference unknown type augmentations, the specific `@types/*` package needs to be listed.

- [ ] **Step 2: Run type checker for node/config code**

```bash
docker compose exec frontend npx tsc --noEmit --project tsconfig.node.json
```

If errors about missing `process` or Node.js globals, add to `tsconfig.node.json`:

```json
"types": ["node"]
```

- [ ] **Step 3: Run composite type check (same as CI)**

```bash
docker compose exec frontend npx tsc -b
```

Expected: no errors. This is what the CI `build` script runs (`tsc -b && vite build`).

- [ ] **Step 4: Fix any remaining type errors**

Common TS 6 issues to look for:
- `module Foo {}` syntax (must become `namespace Foo {}`) -- unlikely in this codebase
- Generic inference changes requiring explicit type arguments -- fix case by case
- Missing type imports from `@types/*` packages -- add to `types` field

- [ ] **Step 5: Commit any tsconfig changes**

```bash
git add frontend/tsconfig.app.json frontend/tsconfig.node.json
git commit -m "chore: update tsconfig for TypeScript 6 compatibility"
```

Skip this step if no changes were needed.

---

## Task 7: Verify build

**Files:** None (verification only)

- [ ] **Step 1: Run development build**

```bash
docker compose exec frontend npx vite build
```

Expected: successful build with chunk output. Verify the vendor chunks appear:
- `vendor-react-[hash].js`
- `vendor-reactflow-[hash].js`
- `vendor-d3-[hash].js`
- `vendor-query-[hash].js`

- [ ] **Step 2: Check for Rolldown-specific warnings**

Review the build output for any deprecation warnings or Rolldown compatibility warnings. Common issues:
- Plugin compatibility warnings (check `@sentry/vite-plugin`)
- CSS processing changes (Lightning CSS is now default)

- [ ] **Step 3: Verify dev server starts**

```bash
docker compose restart frontend
docker compose logs frontend --tail=20
```

Expected: Vite dev server starts without errors on port 5173.

---

## Task 8: Run tests and linter

**Files:** Possibly test files if assertions need updating

- [ ] **Step 1: Run unit tests**

```bash
docker compose exec frontend npx vitest run --project unit
```

Expected: all unit tests pass.

- [ ] **Step 2: Run integration tests**

```bash
docker compose exec frontend npx vitest run --project integration
```

Expected: all integration tests pass. If jsdom environment has issues with Vite 8, check vitest compatibility.

- [ ] **Step 3: Run linter**

```bash
docker compose exec frontend npx @biomejs/biome check --diagnostic-level=error src/
```

Expected: no errors.

- [ ] **Step 4: Fix any test or lint failures**

If tests fail due to Rolldown bundler differences (e.g., different module resolution in test environment), check vitest config. Vitest 4 supports Vite 8 via its `peerOptional` dependency on `vite@^8.0.0-0`.

- [ ] **Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "fix: update tests for vite 8 compatibility"
```

Skip this step if no changes were needed.

---

## Task 9: Full quality gate

Run the same checks CI runs to ensure the PR will pass.

**Files:** None (verification only)

- [ ] **Step 1: Run full frontend quality check**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
docker compose exec frontend npx @biomejs/biome check --diagnostic-level=error src/
```

All three must pass.

- [ ] **Step 2: Run backend tests (sanity check)**

```bash
docker compose exec api uv run pytest
```

Expected: all pass (backend is unaffected, but verify no Docker-level regressions).

- [ ] **Step 3: Check for security issues in new dependencies**

```bash
docker compose exec frontend npm audit
docker compose exec frontend npm outdated
```

Review any new vulnerabilities introduced by the upgrade. `npm outdated` should show the three upgraded packages at their latest versions.

- [ ] **Step 4: Run complexity check**

```bash
make complexity
```

Expected: no degradation.

---

## Task 10: Create pull request and close Dependabot PRs

**Files:** None (git/GitHub operations)

- [ ] **Step 1: Push branch**

```bash
git push -u origin chore/frontend-toolchain-upgrade
```

- [ ] **Step 2: Create pull request**

```bash
gh pr create --title "chore: upgrade Vite 8, plugin-react 6, TypeScript 6" --body "$(cat <<'EOF'
## Summary

Coordinated frontend toolchain upgrade:
- **Vite** 7.3 to 8.x (Rolldown bundler replaces Rollup)
- **@vitejs/plugin-react** 5.1 to 6.x (Babel removed, uses Oxc)
- **TypeScript** 5.9 to 6.0

Also removes unused `vite-plugin-top-level-await` and `vite-plugin-wasm` devDependencies.

### Migration details
- `build.rollupOptions` renamed to `build.rolldownOptions`
- `manualChunks` converted from object form (removed in Vite 8) to function form
- tsconfig updated for TS 6 default changes (if applicable)

Supersedes #72, #73. Closes the peer dependency conflicts those PRs had.

## Test plan
- [ ] `tsc --noEmit` passes
- [ ] `vitest run` passes (unit + integration)
- [ ] `vite build` produces correct vendor chunks
- [ ] Dev server starts and proxies API correctly
- [ ] Biome lint passes
- [ ] No new npm audit vulnerabilities
EOF
)"
```

- [ ] **Step 3: Close superseded Dependabot PRs**

```bash
gh pr close 72 --repo merlijntishauser/traumabomen --comment "Superseded by the coordinated toolchain upgrade PR"
gh pr close 73 --repo merlijntishauser/traumabomen --comment "Superseded by the coordinated toolchain upgrade PR"
```

Note: PR #69 (react-i18next 17) is NOT closed here. It requires a separate `i18next` 25 to 26 upgrade and is independent of this toolchain upgrade.

---

## Rollback Plan

If the upgrade causes issues that cannot be resolved quickly:

```bash
git checkout main
git branch -D chore/frontend-toolchain-upgrade
```

The Dependabot PRs remain open as reference for future individual upgrade attempts.
