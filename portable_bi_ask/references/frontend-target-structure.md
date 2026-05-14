# Frontend target structure and migration guardrails

This document locks the frontend target structure for the refactor backlog in `issues/`.

## Validated current-state constraints

- `src/main.ts` is the browser entry and currently imports `./styles.css` plus `./components/dashboard`.
- `src/components/dashboard/dashboard.ts` is the current app shell and hash router, even though it sits under `components/dashboard`.
- `vite.config.ts` does not provide an `@` alias for runtime code.
- `vitest.config.ts` does provide `@ -> ./src`, so test-only imports must not be treated as runtime-safe.
- `.storybook/main.ts` loads stories from `../src/**/*.stories.*` and hard-codes shim aliases under `src/shims/**`.
- The repo still has many flat top-level `src/*.ts` domain files, so migration work must allow staged moves with temporary compatibility exports.

## Locked top-level structure

```text
src/
  app/
    main.ts
    shell/
    routing/
  features/
    dashboard/
    question/
    ask/
  infra/
    db/
    data-sources/
    query/
    shims/
  shared/
    types/
    ui/
    utils/
    styles/
```

## Ownership rules

### `app/`

Owns app bootstrap and app-wide composition only.

Allowed examples:

- browser entry (`main.ts`)
- app shell custom element
- hash route parsing and route-to-view selection

Must not become the home for dashboard/question/ask business logic.

### `features/`

Owns bounded frontend capabilities.

Locked feature roots for this backlog:

- `features/dashboard`
- `features/question`
- `features/ask`

Default shallow internal shape:

- `ui/`
- `model/`
- `data/`
- `orchestration/` only when needed

Do not add deeper taxonomies like `feature/domain/services/parsers/helpers/...` unless a later issue explicitly approves that structure.

### `infra/`

Owns runtime/adapter concerns shared across features.

Examples:

- DuckDB access
- data source management
- query ports
- shims currently referenced by Vite/Storybook

### `shared/`

Owns code reused across multiple bounded contexts when feature ownership is no longer primary.

Examples:

- shared types
- generic UI primitives
- cross-feature utilities
- global styles

Do not split `src/types.ts` early; that is deferred to Issue 07.

## Shallow-structure rules

- Prefer one descriptive folder over multiple nested abstractions.
- Add a subfolder only when it groups multiple files with a clear shared role.
- A feature may use only the folders it needs; empty symmetry is not required.
- If a move would require a deeper tree to feel organized, stop and capture that as an explicit follow-up decision.

## Barrel and compatibility-export rules

Allowed:

- `index.ts` at feature roots
- `index.ts` at component roots
- temporary re-export files at old paths during migration

Required:

- transitional barrels must be clearly temporary and exist only to reduce import churn during staged moves
- final cleanup happens in Issue 08, not opportunistically in earlier move issues

Avoid:

- deep barrel chains that hide ownership
- introducing broad wildcard public APIs when only a narrow surface is needed

## Story/spec colocation rule

Keep stories and tests under `src/**` beside the code they exercise.

Why this is locked:

- `.storybook/main.ts` uses `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)`
- `vitest.config.ts` includes `src/**/*.spec.ts` and `src/components/**/*.spec.ts`

During moves:

- move stories/specs with their code
- update direct imports if paths change
- do not relocate them to a separate docs or test tree

## Import and path guardrails

- Preserve working relative imports during staged moves.
- Do not introduce runtime imports that assume `@` works in Vite/browser code.
- Treat the Vitest `@` alias as test-only unless a future issue explicitly changes runtime config.
- When moving files that affect shims or entry paths, validate all of:
  - `vite.config.ts`
  - `vitest.config.ts`
  - `.storybook/main.ts`

## Locked backlog conventions

- Issue filenames must use `NN-short-slug.md`.
- The ordered backlog is authoritative; do not skip cleanup dependencies casually.
- File-move issues should stay scoped to one boundary at a time: app, one feature, infra, shared, then cleanup.

## Required validation for every later migration issue

Each later issue must include repo-level validation that matches the paths it changes.

Minimum expectations:

- verify Vite boot still points at the correct app entry
- verify Vitest globs/coverage still include moved files as intended
- verify Storybook story discovery and shim aliases still resolve
- verify stories/specs remain colocated under `src/**`
- grep or inspect moved imports for accidental runtime `@` usage
- run the most relevant targeted tests for the boundary being moved

## Current-to-target mapping guide

These current files anchor the first migration steps:

- `src/main.ts` -> future `src/app/main.ts`
- `src/components/dashboard/dashboard.ts` -> app shell/routing first, then dashboard feature internals later
- flat top-level files such as `src/dashboard-registry.ts`, `src/question-registry.ts`, `src/ask-orchestrator.ts`, `src/db.ts`, and `src/query-port.ts` -> future `features/*`, `infra/*`, or `shared/*` homes depending on ownership

Use this guide to stage moves without changing runtime behavior before Issue 08 cleanup.
