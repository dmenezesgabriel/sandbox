# Frontend target structure and migration guardrails

This document reflects the **final** state after Issues 01–08.
All compatibility shims have been removed. Import paths point directly to canonical locations.

## Migration completed (Issue 08)

### Shims removed

- `src/types.ts` (re-exported from `src/shared/types/index`)
- `src/utils.ts` (re-exported from `src/shared/utils/utils`)
- `src/icons.ts` (re-exported from `src/shared/utils/icons`)
- `src/db.ts` (re-exported from `src/infra/db/db`)
- `src/data-source-manager.ts` (re-exported from `src/infra/data-sources/data-source-manager`)
- `src/query-port.ts` (re-exported from `src/infra/query/query-port`)
- `src/styles.css` (CSS redirect to `src/shared/styles/styles.css`)
- 18 ask-model top-level shims (`src/catalog-builder.ts`, `src/ask-data.ts`, `src/ask-orchestrator.ts`, etc.)
- `src/question-config.ts`, `src/question-registry.ts`, `src/question-yaml.ts`
- `src/dashboard-config.ts`, `src/dashboard-registry.ts`, `src/dashboard-yaml.ts`
- 12 `src/components/*/index.ts` shims (dashboard-_, question-_, widget*, ask-* component shims)

### Directories removed

- `src/styles/` (superseded by `src/shared/styles/`)
- `src/components/dashboard-canvas/`, `src/components/dashboard-editor-header/`, `src/components/dashboard-editor/`, `src/components/dashboard-list/`, `src/components/dashboard-workspace/`, `src/components/dashboard/`
- `src/components/question-picker/`, `src/components/widget-editor/`, `src/components/widget/`
- `src/components/question-editor/`, `src/components/question-editor-panel/`, `src/components/question-list/`
- `src/components/ask-clarification/`, `src/components/ask-input/`, `src/components/ask-result/`

### Canonical import rules (post-Issue 08)

| What you need                       | Import from                                |
| ----------------------------------- | ------------------------------------------ |
| All shared types                    | `…/shared/types/index`                     |
| Utilities (formatValue, norm, etc.) | `…/shared/utils/utils`                     |
| Icon helper                         | `…/shared/utils/icons`                     |
| DuckDB manager                      | `…/infra/db/db`                            |
| Data source manager                 | `…/infra/data-sources/data-source-manager` |
| Query port type                     | `…/infra/query/query-port`                 |

## Remaining src/ root files (not shims)

These files live at `src/` root and were not moved in the 01-08 refactor:

- `src/app-config.ts` — default dashboard seed config, used by `features/dashboard/model/dashboard-config.ts`
- `src/grid-layout-engine.ts` + `src/grid-layout-engine.spec.ts` — grid layout utilities, used by dashboard UI
- `src/main.ts` — thin re-export of `src/app/main.ts`
- `src/env.d.ts` — Vite env type declaration

These are candidates for future relocation (app-config → app/, grid-layout-engine → features/dashboard/model/).

## Original validated constraints (now historical)

- `vite.config.ts` does not provide an `@` alias for runtime code.
- `vitest.config.ts` does provide `@ -> ./src`, so test-only imports must not be treated as runtime-safe.
- `.storybook/main.ts` loads stories from `../src/**/*.stories.*` and hard-codes shim aliases under `src/shims/**`.

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

## Current-to-target mapping guide (historical)

This section was used to plan migration in Issues 01–07. All moves are now complete.

## Final directory tree snapshot (post-Issue 08)

Generated 2026-05-14 from `find src -type f -name "*.ts" -o -name "*.css" | sort`:

```text
src/
  app-config.ts                        # seed config for default dashboard (future: src/app/)
  env.d.ts                             # Vite env types
  grid-layout-engine.spec.ts           # grid layout tests (future: src/features/dashboard/model/)
  grid-layout-engine.ts                # grid layout logic (future: src/features/dashboard/model/)
  main.ts                              # thin re-export of src/app/main.ts
  app/
    main.ts                            # browser entry point
    routing/
      hash-routes.ts
    shell/
      app-shell.ts
  components/                          # cross-feature shared UI components
    design-system.stories.ts
    skeleton-loader/
    spinner/
    top-nav/
    ui-button/
    ui-text-field/
  features/
    ask/
      index.ts
      model/                           # ask domain logic (18 files + specs)
        ask-data.ts, catalog-builder.ts, date-question-text.ts,
        date-range-parser.ts, diagnostic-runner.ts, field-search.ts,
        intent-cue-detector.ts, intent-describer.ts, month-catalog.ts,
        narrative-generator.ts, question-parser.ts, result-analysis.ts,
        result-analyzer.ts, semantic-field-matcher.ts, semantic-modeling.ts,
        sql-planner.ts, sql-renderer.ts, term-matcher.ts,
        value-filter-resolver.ts, vocabulary.ts
      orchestration/
        ask-orchestrator.ts, ask-orchestrator.spec.ts
        create-dashboard-orchestrator.ts
      ui/
        ask-clarification/, ask-input/, ask-result/
    dashboard/
      index.ts
      data/
        dashboard-registry.ts, dashboard-registry.spec.ts
      model/
        dashboard-config.ts, dashboard-config.spec.ts, dashboard-yaml.ts
      ui/
        dashboard/, dashboard-canvas/, dashboard-editor/,
        dashboard-editor-header/, dashboard-list/, dashboard-workspace/,
        question-picker/, widget/, widget-editor/
    question/
      index.ts
      data/
        question-registry.ts, question-registry.spec.ts
      model/
        question-config.ts, question-yaml.ts, question-yaml.spec.ts
      ui/
        question-editor/, question-editor-panel/, question-list/
  infra/
    data-sources/
      data-source-manager.ts, data-source-manager.spec.ts
    db/
      db.ts, db.spec.ts
    query/
      query-port.ts
    shims/
      chrono-node/en.ts, chrono-node/pt.ts
  shared/
    styles/
      styles.css (+ 11 partial CSS files)
    types/
      ask.ts, dashboard.ts, data-source.ts, question.ts, index.ts
    utils/
      icons.ts, utils.ts, utils.spec.ts
```
