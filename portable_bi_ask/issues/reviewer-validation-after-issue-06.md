## Review

- Correct: `src/infra/` exists with exactly the four shallow subfolders specified: `db/`, `data-sources/`, `query/`, `shims/chrono-node/`. No extra nesting introduced.
- Correct: Specs are colocated. `src/infra/db/db.spec.ts` sits beside `db.ts`; `src/infra/data-sources/data-source-manager.spec.ts` sits beside `data-source-manager.ts`. Git tracks both as renames from the old `src/` root specs (`R src/db.spec.ts -> src/infra/db/db.spec.ts`, `R src/data-source-manager.spec.ts -> src/infra/data-sources/data-source-manager.spec.ts`), preserving history.
- Correct: Old source files converted to re-export shims, not deleted. `src/db.ts` re-exports `DuckDBManager` and `duckDBManager` from `./infra/db/db`. `src/data-source-manager.ts` re-exports `DataSourceManager` (type) and `DuckDBDataSourceManager` from `./infra/data-sources/data-source-manager`. `src/query-port.ts` re-exports `QueryPort` (type) from `./infra/query/query-port`. All three carry the `// Temporary re-export shim — will be removed in Issue 08 cleanup.` comment.
- Correct: Old spec files removed from `src/` root. `src/db.spec.ts` and `src/data-source-manager.spec.ts` are both absent from the working tree; canonical copies are in `src/infra/`.
- Correct: All direct importers inside `src/features/` now use `src/infra/` paths. Confirmed by grep — no file under `src/features/` references the old bare paths (`../db`, `../data-source-manager`, `../query-port`). Specific verified files: `dashboard-workspace.ts` imports `duckDBManager` from `../../../../infra/db/db`; `question-editor-panel.ts` imports both `DuckDBDataSourceManager` and `duckDBManager` from `../../../../infra/data-sources/data-source-manager` and `../../../../infra/db/db`; `create-dashboard-orchestrator.ts` imports from `../../../infra/data-sources/data-source-manager` and `../../../infra/db/db`; `ask-orchestrator.ts` and its spec import `DataSourceManager` from `../../../infra/data-sources/data-source-manager`; `catalog-builder.ts` and its spec import `QueryPort` from `../../../infra/query/query-port`.
- Correct: `.storybook/main.ts` chrono-node alias paths correctly point at `../src/infra/shims/chrono-node/en.ts` and `../src/infra/shims/chrono-node/pt.ts`. The `viteFinal` alias array at lines 24–25 was updated from the old `../src/shims/chrono-node/` paths.
- Correct: `vite.config.ts` was not modified. Its `chrono-node/en` and `chrono-node/pt` aliases resolve directly to `node_modules/chrono-node/dist/esm/locales/…`, not to the shim files, so no change was needed. This is the correct call.
- Correct: `vitest.config.ts` adds `src/infra/**/*.ts` to the coverage `include` array (line 26). The existing `src/**/*.spec.ts` glob in the `unit` project already picks up `src/infra/**/*.spec.ts` with no additional change required.
- Correct: No runtime `@` alias imports introduced. Grep across `src/infra/` returns zero results for `from '@/'`. All imports inside infra files use relative paths (`../../types`, `../../utils`, `../query/query-port`).
- Correct: `create-dashboard-orchestrator.ts` infra import is now resolved via `../../../infra/db/db` — the `../../../db` path that pre-existed inside the features tree (noted as a risk in the Issue 05 review) has been corrected by this issue as part of the broader infra migration.
- Note: `format:check` initially failed on `issues/06-worker-output.md` (unformatted doc file from the worker). `prettier --write` was applied and the file re-staged before the final `format:check` pass. No implementation file was reformatted. This is the same class of doc-formatting issue that occurred in Issue 05.
- Note: `src/shims/chrono-node/` (old shim location) still exists in the working tree with `en.ts` and `pt.ts`. These files are no longer referenced by any alias config (`.storybook/main.ts` now points at `src/infra/shims/chrono-node/`), but they were intentionally left in place for Issue 08 cleanup as stated in the worker output. No functional impact since the Storybook alias override takes precedence. Issue 08 must remove `src/shims/` entirely.
- Note: Three top-level shims (`src/db.ts`, `src/data-source-manager.ts`, `src/query-port.ts`) remain. Grep confirms no feature-tree or app-tree file imports from these old paths, so they are purely transitional compatibility exports. Issue 08 must remove them once all call-sites are confirmed clean.
- Note: Coverage config now has five separate `include` globs: `src/components/**/*.ts`, `src/features/dashboard/**/*.ts`, `src/features/question/**/*.ts`, `src/features/ask/**/*.ts`, and `src/infra/**/*.ts`. Each new feature folder or infra subfolder must be added manually. For Issue 07 (shared types), if any files land outside these patterns they will be invisible to coverage. Consider whether a unified `src/**/*.ts` with targeted exclusions would be more maintainable going forward.
- Note: Chunk size warnings (pre-existing). Build warns about two chunks larger than 500 kB (`transformers.web` at 567 kB, `index` at 808 kB). Not introduced by this issue.
- Note: 4 skipped Storybook test files — pre-existing, not caused by any path change here.

## Commands run

| Command                    | Result                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`        | PASS — no errors                                                                                                             |
| `npm run lint`             | PASS — no errors                                                                                                             |
| `npm run format:check`     | Initial FAIL (1 unformatted doc file: `issues/06-worker-output.md`); PASS after `prettier --write` on that file and re-stage |
| `npm run test:unit`        | PASS — 28 files, 565 tests                                                                                                   |
| `npm run test:components`  | PASS — 5 files, 43 tests                                                                                                     |
| `npm run test:storybook`   | PASS — 14 passed, 4 skipped (18 total), 72 tests                                                                             |
| `npm run test:integration` | PASS — 18 scenarios, 74 steps                                                                                                |
| `npm run test:e2e`         | PASS — 8 scenarios, 47 steps                                                                                                 |
| `npm run build`            | PASS — 2113 modules transformed, built in 3.27s                                                                              |
| `npm run build-storybook`  | PASS — Storybook build completed successfully                                                                                |

## Blockers

None. All validation commands pass clean. The `format:check` failure was in a doc file outside the implementation scope and was remediated before recording the final result. All infra structure, shim conversions, spec colocation, alias config updates, and direct-import rewrites are correct and complete.

## Risks and drift for future issues

- **Issue 07 (shared types):** If new types land outside `src/types.ts` or `src/features/*/`, they will not appear in coverage unless the `vitest.config.ts` include list is updated. The coverage config's piecemeal glob growth is the main drift risk for this issue.
- **Issue 08 (cleanup):** Must remove `src/shims/chrono-node/` (old, now orphaned shim directory) and the three top-level shims (`src/db.ts`, `src/data-source-manager.ts`, `src/query-port.ts`). Removing the shims without first confirming no external callers (e.g., test helpers, scripts, future files) would be a breaking change. A grep sweep before deletion is strongly recommended.
- **Issue 08 (cleanup):** `src/infra/shims/chrono-node/` and `vite.config.ts` use different resolution strategies for `chrono-node`. The Storybook override resolves to shim stubs; Vite resolves to the real `node_modules` ESM build. This split is intentional and correct, but must not be accidentally collapsed or reversed during cleanup.
