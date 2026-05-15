Implemented Issue 06 by moving all infra/runtime files into `src/infra/` with a shallow subfolder layout, updating all direct importers inside `src/features/`, converting old source files to re-export shims, and updating the Storybook chrono-node alias paths.

## What was implemented

### Directory created

```
src/infra/
  db/
    db.ts          — moved from src/db.ts (internal import updated: ./query-port → ../query/query-port)
    db.spec.ts     — moved from src/db.spec.ts (import updated to new sibling paths)
  data-sources/
    data-source-manager.ts   — moved from src/data-source-manager.ts (imports updated)
    data-source-manager.spec.ts — moved from src/data-source-manager.spec.ts (imports updated)
  query/
    query-port.ts  — moved from src/query-port.ts (no internal imports; unchanged)
  shims/
    chrono-node/
      en.ts        — moved from src/shims/chrono-node/en.ts (content unchanged)
      pt.ts        — moved from src/shims/chrono-node/pt.ts (content unchanged)
```

### Direct import updates in feature files

All active importers inside `src/features/` were rewritten to point at the new `src/infra/` paths:

- `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts`:
  - `../../../../db` → `../../../../infra/db/db`
- `src/features/question/ui/question-editor-panel/question-editor-panel.ts`:
  - `../../../../data-source-manager` → `../../../../infra/data-sources/data-source-manager`
  - `../../../../db` → `../../../../infra/db/db`
- `src/features/ask/orchestration/create-dashboard-orchestrator.ts`:
  - `../../../data-source-manager` → `../../../infra/data-sources/data-source-manager`
  - `../../../db` → `../../../infra/db/db`
- `src/features/ask/orchestration/ask-orchestrator.ts`:
  - `../../../data-source-manager` → `../../../infra/data-sources/data-source-manager`
- `src/features/ask/orchestration/ask-orchestrator.spec.ts`:
  - `../../../data-source-manager` → `../../../infra/data-sources/data-source-manager`
- `src/features/ask/model/catalog-builder.ts`:
  - `../../../query-port` → `../../../infra/query/query-port`
- `src/features/ask/model/catalog-builder.spec.ts`:
  - `../../../query-port` → `../../../infra/query/query-port`

### Compat re-export shims at old paths

The following old top-level files were replaced with one-line shims. These will be removed in Issue 08 cleanup.

- `src/db.ts` — re-exports `DuckDBManager`, `duckDBManager` from `./infra/db/db`
- `src/data-source-manager.ts` — re-exports `DataSourceManager`, `DuckDBDataSourceManager` from `./infra/data-sources/data-source-manager`
- `src/query-port.ts` — re-exports `QueryPort` from `./infra/query/query-port`

Note: the old `src/shims/` directory remains in place untouched; its files are no longer canonical but are also not removed yet (Issue 08 cleanup).

### Old spec files removed

Canonical spec copies now live in `src/infra/`. The old top-level spec files were removed:

- `src/db.spec.ts` — removed (canonical: `src/infra/db/db.spec.ts`)
- `src/data-source-manager.spec.ts` — removed (canonical: `src/infra/data-sources/data-source-manager.spec.ts`)

### Shim alias config updates

**`.storybook/main.ts`**: Updated chrono-node alias paths from the old shim location to the new infra location:

```
Before: root('../src/shims/chrono-node/en.ts')
After:  root('../src/infra/shims/chrono-node/en.ts')

Before: root('../src/shims/chrono-node/pt.ts')
After:  root('../src/infra/shims/chrono-node/pt.ts')
```

**`vite.config.ts`**: No change needed. The Vite alias for `chrono-node/en` and `chrono-node/pt` points directly at `node_modules/chrono-node/dist/esm/…`, not at the shim files.

### vitest.config.ts update

Added `src/infra/**/*.ts` to the coverage `include` array so infra files appear in coverage reports. The unit project glob `src/**/*.spec.ts` already picks up `src/infra/**/*.spec.ts` without any change.

## Changed files list

**New files (infra):**

- `src/infra/db/db.ts`
- `src/infra/db/db.spec.ts`
- `src/infra/data-sources/data-source-manager.ts`
- `src/infra/data-sources/data-source-manager.spec.ts`
- `src/infra/query/query-port.ts`
- `src/infra/shims/chrono-node/en.ts`
- `src/infra/shims/chrono-node/pt.ts`

**Modified (shims or direct import updates):**

- `src/db.ts` — converted to shim
- `src/data-source-manager.ts` — converted to shim
- `src/query-port.ts` — converted to shim
- `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts` — direct import updated
- `src/features/question/ui/question-editor-panel/question-editor-panel.ts` — direct imports updated
- `src/features/ask/orchestration/create-dashboard-orchestrator.ts` — direct imports updated
- `src/features/ask/orchestration/ask-orchestrator.ts` — direct import updated
- `src/features/ask/orchestration/ask-orchestrator.spec.ts` — direct import updated
- `src/features/ask/model/catalog-builder.ts` — direct import updated
- `src/features/ask/model/catalog-builder.spec.ts` — direct import updated
- `.storybook/main.ts` — chrono-node alias paths updated
- `vitest.config.ts` — coverage include updated

**Deleted:**

- `src/db.spec.ts`
- `src/data-source-manager.spec.ts`

## Validation results

All commands run from `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask` on 2026-05-14.

| Command                                                                            | Result                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm run typecheck`                                                                | PASS — no errors                                 |
| `npm run lint`                                                                     | PASS — no errors                                 |
| `npm run format:check`                                                             | PASS — all files use Prettier code style         |
| `npm run test:unit`                                                                | PASS — 28 test files, 565 tests                  |
| `npm run test:components`                                                          | PASS — 5 test files, 43 tests                    |
| `npm run test:storybook`                                                           | PASS — 14 passed, 4 skipped (18 total), 72 tests |
| `npm run build`                                                                    | PASS — 2113 modules transformed, built in 3.30s  |
| `npm run build-storybook`                                                          | PASS — Storybook build completed successfully    |
| `npx vitest run --project unit src/infra/db/db.spec.ts`                            | PASS — 1 test file, 2 tests                      |
| `npx vitest run --project unit src/infra/data-sources/data-source-manager.spec.ts` | PASS — 1 test file, 4 tests                      |

Storybook chrono-node shim alias resolution confirmed working: `build-storybook` completed with 2338 modules transformed and no alias resolution errors.

## Importers still using old paths (via shims)

No feature-tree files use the old shim paths. All direct importers inside `src/features/` were rewritten to the new `src/infra/` locations. The three shims at `src/db.ts`, `src/data-source-manager.ts`, and `src/query-port.ts` exist as transitional compatibility exports only and have no known active callers inside `src/features/` or `src/app/`.

## How the shim alias config was updated

Only `.storybook/main.ts` needed updating. The two `viteFinal` alias entries were changed from `../src/shims/chrono-node/{en,pt}.ts` to `../src/infra/shims/chrono-node/{en,pt}.ts`. `vite.config.ts` was not changed because its chrono-node aliases point directly at `node_modules`, not the shim files.

## Follow-up risks and open questions

1. **`src/shims/` not removed yet:** The old `src/shims/chrono-node/` directory still exists alongside the new canonical copies in `src/infra/shims/`. Issue 08 cleanup should remove `src/shims/` once the transitional period is over.
2. **Three top-level shims remain:** `src/db.ts`, `src/data-source-manager.ts`, and `src/query-port.ts` are shims. They will be removed in Issue 08. Any future file that imports from these old paths will still resolve correctly until then.
3. **No runtime `@` imports introduced:** Confirmed by grep — none of the moved infra files use `@/` imports.
4. **Chunk size warnings (pre-existing):** Build warns about chunks larger than 500 kB. Not introduced by this issue.
5. **4 skipped Storybook tests (pre-existing):** Present before this issue; not caused by any path change here.

## Current date and working directory

- Date: 2026-05-14
- Working directory: `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask`
