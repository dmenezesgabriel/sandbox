## Review

- Correct: All top-level shims in category a (`src/types.ts`, `src/utils.ts`, `src/icons.ts`) are deleted. Confirmed absent from the filesystem.
- Correct: All top-level shims in category b (`src/db.ts`, `src/data-source-manager.ts`, `src/query-port.ts`) are deleted. Worker reported zero importers for all three (already on canonical paths), and the filesystem confirms all three are gone.
- Correct: All 22 ask-model top-level shims (category c) are deleted: `src/ask-data.ts`, `src/ask-orchestrator.ts`, `src/catalog-builder.ts`, `src/create-dashboard-orchestrator.ts`, `src/date-question-text.ts`, `src/date-range-parser.ts`, `src/diagnostic-runner.ts`, `src/field-search.ts`, `src/intent-cue-detector.ts`, `src/intent-describer.ts`, `src/month-catalog.ts`, `src/narrative-generator.ts`, `src/question-parser.ts`, `src/result-analysis.ts`, `src/result-analyzer.ts`, `src/semantic-field-matcher.ts`, `src/semantic-modeling.ts`, `src/sql-planner.ts`, `src/sql-renderer.ts`, `src/term-matcher.ts`, `src/value-filter-resolver.ts`, `src/vocabulary.ts`. All absent from the filesystem.
- Correct: All 6 question and dashboard shims (category d) are deleted: `src/question-config.ts`, `src/question-registry.ts`, `src/question-yaml.ts`, `src/dashboard-config.ts`, `src/dashboard-registry.ts`, `src/dashboard-yaml.ts`. All absent from the filesystem.
- Correct: All 15 component shim folders (category e) are deleted: `src/components/dashboard-canvas/`, `src/components/dashboard-editor-header/`, `src/components/dashboard-editor/`, `src/components/dashboard-list/`, `src/components/dashboard-workspace/`, `src/components/dashboard/`, `src/components/question-picker/`, `src/components/widget-editor/`, `src/components/widget/`, `src/components/question-editor/`, `src/components/question-editor-panel/`, `src/components/question-list/`, `src/components/ask-clarification/`, `src/components/ask-input/`, `src/components/ask-result/`. None remain under `src/components/`.
- Correct: `src/styles/` directory is deleted and `src/styles.css` CSS shim is deleted. Both confirmed absent from the filesystem.
- Correct: All five grep checks for stale imports return zero results. No file inside `src/features/`, `src/infra/`, `src/app/`, or `src/shared/` imports from a deleted shim path.
- Correct: The two side-effect importer rewrites in category e are confirmed. `src/features/dashboard/ui/widget-editor/widget-editor.ts` uses `../../../question/ui/question-editor-panel` and `src/features/question/ui/question-editor-panel/question-editor-panel.ts` uses `../../../dashboard/ui/widget` — both canonical, not shim paths.
- Correct: Four `src/` root files survive as real implementations: `src/app-config.ts` imports from `./shared/types/index` (canonical); `src/grid-layout-engine.ts` imports from `./shared/types/index` (canonical); `src/grid-layout-engine.spec.ts` exists; `src/main.ts` is a single-line side-effect import `import './app/main'` (not a shim — it is the Vite entry point). `src/env.d.ts` also remains as a Vite env type declaration.
- Correct: No other unexpected files remain at `src/` root. The full `src/` root listing is: `app-config.ts`, `env.d.ts`, `grid-layout-engine.spec.ts`, `grid-layout-engine.ts`, `main.ts` — five files, matching the worker's documented final state.
- Correct: `references/frontend-target-structure.md` has been updated to reflect the final post-Issue-08 state. It documents the removed shims, deleted directories, canonical import table, remaining `src/` root files, and the final directory tree snapshot. The file is accurate with respect to what is actually on disk.
- Correct: Story/spec colocation is intact. All stories and specs are colocated under `src/**` beside their implementation files. `src/components/` retains only the 5 non-shim component folders (`skeleton-loader`, `spinner`, `top-nav`, `ui-button`, `ui-text-field`) plus `design-system.stories.ts`. The `.storybook/main.ts` glob `../src/**/*.stories.*` and vitest glob `src/**/*.spec.ts` continue to discover all tests.
- Blocker (remediated): The worker output states that tests in `tests/` were out of scope for Issue 08, but three test helper/step files still imported from deleted shim paths: `tests/helpers/fixtures.ts` imported `DASHBOARD_CONFIG` from `../../src/dashboard-config.ts` and `DashboardConfig` from `../../src/types.ts`; `tests/integration/steps/world.ts` imported `AskDataEngine` from `../../../src/ask-data.ts` and types from `../../../src/types.ts`; `tests/integration/steps/steps.ts` imported `AskSuccessResult` from `../../../src/types.ts`. These caused `test:integration` to fail with `ERR_MODULE_NOT_FOUND`. All three files were updated to canonical paths (`src/features/dashboard/model/dashboard-config.ts`, `src/features/ask/model/ask-data.ts`, `src/shared/types/index.ts`) and re-staged. Integration tests pass after the fix.
- Note: `format:check` passed cleanly on the first run, including on `issues/08-worker-output.md`. No reformatting was needed, unlike the pattern seen in Issues 05–07.
- Note: Chunk size warnings (pre-existing) remain — `transformers.web` at 567 kB and `index` at 808 kB. Not introduced by this issue.
- Note: 4 skipped Storybook test files — pre-existing, unchanged.
- Note: The worker report counted "22 top-level ask-model shims" in category c but listed 22 files. The `src/field-search.ts` file is in the list despite not having `field-search` in the category c entry (the count is correct). The discrepancy is cosmetic.

## Commands run

| Command                    | Result                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`        | PASS — no errors                                                                                              |
| `npm run lint`             | PASS — no errors                                                                                              |
| `npm run format:check`     | PASS — all files use Prettier code style (no reformatting required)                                           |
| `npm run test:unit`        | PASS — 28 files, 565 tests                                                                                    |
| `npm run test:components`  | PASS — 5 files, 43 tests                                                                                      |
| `npm run test:storybook`   | PASS — 14 passed, 4 skipped (18 total), 72 tests                                                              |
| `npm run test:integration` | Initial FAIL (3 test helper/step files importing deleted shim paths); PASS after fix — 18 scenarios, 74 steps |
| `npm run test:e2e`         | PASS — 8 scenarios, 47 steps                                                                                  |
| `npm run build`            | PASS — 2111 modules transformed, built in 3.27s                                                               |
| `npm run build-storybook`  | PASS — Storybook build completed successfully                                                                 |

## Blockers

One blocker was found and remediated during review:

**Stale shim imports in `tests/` files** — Three files outside `src/` still imported from deleted shim paths (`src/ask-data.ts`, `src/dashboard-config.ts`, `src/types.ts`), causing `test:integration` to fail with `ERR_MODULE_NOT_FOUND`. The worker's scope definition excluded `tests/`, but the shim deletion made the integration suite non-runnable. All three files were updated to canonical paths and re-staged before the final validation pass.

Files fixed:

- `tests/helpers/fixtures.ts` — `src/dashboard-config.ts` → `src/features/dashboard/model/dashboard-config.ts`; `src/types.ts` → `src/shared/types/index.ts`
- `tests/integration/steps/world.ts` — `src/ask-data.ts` → `src/features/ask/model/ask-data.ts`; `src/types.ts` → `src/shared/types/index.ts`
- `tests/integration/steps/steps.ts` — `src/types.ts` → `src/shared/types/index.ts`

All commands pass after remediation. No further blockers.

## Final state summary

### `src/` root

Five files remain — none are shims:

- `src/app-config.ts` — default dashboard seed config, imported by `src/features/dashboard/model/dashboard-config.ts`
- `src/env.d.ts` — Vite env type declaration
- `src/grid-layout-engine.ts` — grid layout utilities, imported by 3 dashboard UI files
- `src/grid-layout-engine.spec.ts` — spec for `grid-layout-engine.ts`
- `src/main.ts` — Vite browser entry point (side-effect import of `./app/main`)

### `src/components/`

Six entries remain — all are legitimate non-shim components:

- `design-system.stories.ts` — Storybook design system story
- `skeleton-loader/` — skeleton loader component (index, implementation, stories)
- `spinner/` — spinner component (index, implementation, stories)
- `top-nav/` — top-nav component (index, implementation, stories)
- `ui-button/` — shared button primitive (index, implementation, stories)
- `ui-text-field/` — shared text field primitive (index, implementation, stories)

All 15 shim-only component folders have been removed.

### Recommended follow-up work (outside Issues 01–08 scope)

- Relocate `src/app-config.ts` to `src/app/` and update the one importer in `src/features/dashboard/model/dashboard-config.ts`.
- Relocate `src/grid-layout-engine.ts` and `src/grid-layout-engine.spec.ts` to `src/features/dashboard/model/` and update the three dashboard UI importers.
- Evaluate whether `src/components/skeleton-loader/` and `src/components/spinner/` (dashboard-exclusive consumers) should move to `src/features/dashboard/ui/`.
- Evaluate whether `src/components/ui-button/` and `src/components/ui-text-field/` (cross-feature consumers) should move to `src/shared/ui/`.
- Address pre-existing chunk size warnings (`transformers.web` 567 kB, `index` 808 kB) via code splitting or manual chunk configuration.
- Ensure future changes to `tests/helpers/` and `tests/integration/steps/` keep import paths up to date when canonical locations change — these files were not in the worker's issue scope and missed the shim-removal sweep.
