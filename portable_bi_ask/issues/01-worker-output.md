Implemented Issue 01 documentation and guardrail artifacts without moving production code or changing runtime behavior.

## What I changed

### 1. Added canonical refactor guide

Created `references/frontend-target-structure.md` to lock:

- the top-level target structure: `app`, `features`, `infra`, `shared`
- shallow-folder rules for feature internals
- ownership rules for each top-level boundary
- barrel and temporary re-export guidance
- story/spec colocation rules under `src/**`
- import guardrails, including the warning that `@` is not runtime-safe because only Vitest defines it
- required validation expectations for every later migration issue
- a current-to-target mapping for `src/main.ts`, `src/components/dashboard/dashboard.ts`, and representative flat `src/*.ts` files

### 2. Tightened `issues/01-frontend-target-structure.md`

Updated the issue so it now explicitly requires:

- publishing a repo-level reference document
- a repo artifact that records validated tooling constraints and migration rules
- `references/frontend-target-structure.md` as the deliverable to maintain for Issues 02-08

### 3. Updated backlog index guidance

Updated `issues/index.md` so later issues explicitly treat `references/frontend-target-structure.md` as the canonical migration guardrail document and re-validate Vite/Vitest/Storybook path assumptions on file moves.

## Validation against requested files

I validated the new documentation against:

- `vite.config.ts`: confirms there is no runtime `@` alias; only `chrono-node/*` aliases are defined
- `vitest.config.ts`: confirms Vitest alone defines `@ -> ./src`, plus `src/**` test globs and component coverage constraints
- `.storybook/main.ts`: confirms stories are discovered from `../src/**/*.stories.*` and shim aliases point into `src/shims/**`
- `src/main.ts`: confirms the app currently boots from the root entry and imports `./components/dashboard`
- `src/components/dashboard/dashboard.ts`: confirms this file currently owns app-shell and hash-routing behavior

I also verified the flat-layout pain point by listing top-level `src/*.ts` files, which include dashboard, question, ask, and infra/domain files mixed together.

## Files changed

- `references/frontend-target-structure.md` (new)
- `issues/01-frontend-target-structure.md`
- `issues/index.md`

## Runtime impact

None. No production files were moved and no runtime behavior was changed.
