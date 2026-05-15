Implemented issue 05 by moving all ask-owned UI, orchestration, and model files under `src/features/ask/` with shallow `model/`, `orchestration/`, and `ui/` folders, and adding compat re-export shims at all old paths that still had importers.

## What was implemented

### question-parser.ts ownership decision

`question-parser.ts` was confirmed as ask-infrastructure in Issue 04 (it imports `DateRangeParser`, `IntentCueDetector`, `TermMatcher`, `ValueFilterResolver`, and is consumed exclusively by `ask-data.ts`). It has been moved into `src/features/ask/model/question-parser.ts` as part of this issue since the ask model boundary is now being collected. A compat shim remains at `src/question-parser.ts` pointing to the new location.

### Directory created

```
src/features/ask/
  index.ts
  model/
    ask-data.ts + (no spec)
    catalog-builder.ts + catalog-builder.spec.ts
    date-question-text.ts + date-question-text.spec.ts
    date-range-parser.ts + date-range-parser.spec.ts
    diagnostic-runner.ts + diagnostic-runner.spec.ts
    field-search.ts + field-search.spec.ts
    intent-cue-detector.ts + intent-cue-detector.spec.ts
    intent-describer.ts + intent-describer.spec.ts
    month-catalog.ts + month-catalog.spec.ts
    narrative-generator.ts + narrative-generator.spec.ts
    question-parser.ts + question-parser.spec.ts
    result-analysis.ts + result-analysis.spec.ts
    result-analyzer.ts + result-analyzer.spec.ts
    semantic-field-matcher.ts + semantic-field-matcher.spec.ts
    semantic-modeling.ts + semantic-modeling.spec.ts
    sql-planner.ts + sql-planner.spec.ts
    sql-renderer.ts + sql-renderer.spec.ts
    term-matcher.ts + term-matcher.spec.ts
    value-filter-resolver.ts + value-filter-resolver.spec.ts
    vocabulary.ts + vocabulary.spec.ts
  orchestration/
    ask-orchestrator.ts + ask-orchestrator.spec.ts
    create-dashboard-orchestrator.ts
  ui/
    ask-input/
      ask-input.ts + ask-input.stories.ts + index.ts
    ask-clarification/
      ask-clarification.ts + ask-clarification.stories.ts + index.ts
    ask-result/
      ask-result.ts + ask-result-model.ts + ask-result-model.spec.ts + ask-result.stories.ts + index.ts
```

### Import path rewrites in moved files

- All intra-model imports (`./catalog-builder`, `./date-range-parser`, etc.) remain unchanged (correct within `model/`).
- External imports rewritten: `./types` → `../../../types`, `./utils` → `../../../utils`, `./query-port` → `../../../query-port`.
- `create-dashboard-orchestrator.ts`: `./ask-data` → `../model/ask-data`, `./data-source-manager` → `../../../data-source-manager`, `./db` → `../../../db`.
- UI components: `../../types` → `../../../../types`, `../../utils` → `../../../../utils`, `../../icons` → `../../../../icons`, `../ui-button` → `../../../../components/ui-button`, `../ui-text-field` → `../../../../components/ui-text-field`.

### Direct import updates (dashboard feature files)

- `src/features/dashboard/ui/dashboard-editor/dashboard-editor.ts`: updated side-effect imports of ask UI components and import of `AskOrchestrator` / `createDashboardOrchestrator` to point to new feature paths.
- `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts`: updated `AskDataEngine` import to new feature path.

### Compat shims created at old top-level paths

The following old `src/*.ts` files were replaced with one-line re-export shims pointing to `./features/ask/…`. These shims will be removed in Issue 08 cleanup.

- `src/ask-data.ts`
- `src/ask-orchestrator.ts`
- `src/create-dashboard-orchestrator.ts`
- `src/catalog-builder.ts`
- `src/date-question-text.ts`
- `src/date-range-parser.ts`
- `src/diagnostic-runner.ts`
- `src/field-search.ts`
- `src/intent-cue-detector.ts`
- `src/intent-describer.ts`
- `src/month-catalog.ts`
- `src/narrative-generator.ts`
- `src/question-parser.ts`
- `src/result-analysis.ts`
- `src/result-analyzer.ts`
- `src/semantic-field-matcher.ts`
- `src/semantic-modeling.ts`
- `src/sql-planner.ts`
- `src/sql-renderer.ts`
- `src/term-matcher.ts`
- `src/value-filter-resolver.ts`
- `src/vocabulary.ts`

### Old component files converted to shims

The `src/components/ask-input/ask-input.ts`, `src/components/ask-clarification/ask-clarification.ts`, `src/components/ask-result/ask-result.ts`, and `src/components/ask-result/ask-result-model.ts` were converted to shims pointing to `../../features/ask/ui/…`.

### Specs/stories relocated (old copies removed)

Old spec and story files were removed from their original locations once canonical copies were placed in the new feature tree:

- Removed: `src/ask-orchestrator.spec.ts` and 19 other top-level `*.spec.ts` files
- Removed: `src/components/ask-input/ask-input.stories.ts`
- Removed: `src/components/ask-clarification/ask-clarification.stories.ts`
- Removed: `src/components/ask-result/ask-result.stories.ts`
- Removed: `src/components/ask-result/ask-result-model.spec.ts`

### vitest.config.ts updates

- Coverage `include` added `src/features/ask/**/*.ts`.
- Unit project `exclude` added `src/features/ask/ui/**/*.spec.ts`.
- Components project `include` added `src/features/ask/ui/**/*.spec.ts`.

## Changed files list

**New files (features/ask):**

- `src/features/ask/index.ts`
- `src/features/ask/model/` — 21 source files + 20 spec files
- `src/features/ask/orchestration/ask-orchestrator.ts`
- `src/features/ask/orchestration/ask-orchestrator.spec.ts`
- `src/features/ask/orchestration/create-dashboard-orchestrator.ts`
- `src/features/ask/ui/ask-input/ask-input.ts`
- `src/features/ask/ui/ask-input/ask-input.stories.ts`
- `src/features/ask/ui/ask-input/index.ts`
- `src/features/ask/ui/ask-clarification/ask-clarification.ts`
- `src/features/ask/ui/ask-clarification/ask-clarification.stories.ts`
- `src/features/ask/ui/ask-clarification/index.ts`
- `src/features/ask/ui/ask-result/ask-result.ts`
- `src/features/ask/ui/ask-result/ask-result-model.ts`
- `src/features/ask/ui/ask-result/ask-result-model.spec.ts`
- `src/features/ask/ui/ask-result/ask-result.stories.ts`
- `src/features/ask/ui/ask-result/index.ts`

**Modified (shims or imports updated):**

- `src/ask-data.ts` — shim
- `src/ask-orchestrator.ts` — shim
- `src/create-dashboard-orchestrator.ts` — shim
- `src/catalog-builder.ts` … `src/vocabulary.ts` — 19 model shims
- `src/question-parser.ts` — shim (ownership moved here from Issue 04 holding position)
- `src/components/ask-input/ask-input.ts` — shim
- `src/components/ask-clarification/ask-clarification.ts` — shim
- `src/components/ask-result/ask-result.ts` — shim
- `src/components/ask-result/ask-result-model.ts` — shim
- `src/features/dashboard/ui/dashboard-editor/dashboard-editor.ts` — direct import update
- `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts` — direct import update
- `vitest.config.ts` — coverage + project globs updated

**Deleted:**

- `src/ask-orchestrator.spec.ts` + 19 other top-level `*.spec.ts` files
- `src/components/ask-input/ask-input.stories.ts`
- `src/components/ask-clarification/ask-clarification.stories.ts`
- `src/components/ask-result/ask-result.stories.ts`
- `src/components/ask-result/ask-result-model.spec.ts`

## Validation results

All commands run from `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask` on 2026-05-14.

| Command                                           | Result                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                               | PASS — no errors                                                                                         |
| `npm run lint`                                    | PASS — no errors                                                                                         |
| `npm run format:check`                            | PASS — only pre-existing `issues/reviewer-validation-after-issue-04.md` warning, unrelated to this issue |
| `npm run test:unit`                               | PASS — 28 test files, 565 tests                                                                          |
| `npm run test:components`                         | PASS — 5 test files, 43 tests                                                                            |
| `npm run test:storybook`                          | PASS — 14 passed, 4 skipped (18 total), 72 tests                                                         |
| `npm run build`                                   | PASS — 2113 modules transformed, built in 3.19s                                                          |
| `npx vitest run --project unit src/features/ask/` | PASS — 20 test files, 423 tests                                                                          |

## Ownership decision on question-parser.ts

`question-parser.ts` was moved into `src/features/ask/model/` in this issue. Rationale: it depends on `DateRangeParser`, `IntentCueDetector`, `TermMatcher`, `ValueFilterResolver`, and `ValueFilterResolver` — all ask-model concerns — and its only consumer is `ask-data.ts`. There is no meaningful dependency from the question feature to this parser. Moving it here collocates the complete parsing pipeline within the ask boundary. A compat shim remains at `src/question-parser.ts` for the transition period.

## Follow-up risks and open questions

1. **Shim cleanup (Issue 08):** 22 top-level shims plus 4 component shims will accumulate if not removed. Issue 08 must enumerate and sweep them.
2. **ask-data.ts size:** `ask-data.ts` is a large orchestration class (300+ lines) that also re-exports everything from the other model files. The re-export surface from `ask-data.ts` may conflict with the barrel in `index.ts` if callers import both. A follow-up issue should evaluate splitting `AskDataEngine` from the re-export surface.
3. **`create-dashboard-orchestrator.ts` in orchestration:** This file imports `duckDBManager` from `../../../db` — a direct infra dependency inside a feature. Issue 06 (infra boundary) should review whether this wiring should move to an infra adapter.
4. **No `orchestration/ask-orchestrator.spec.ts` coverage gap:** The spec was moved but the orchestration layer is excluded from the components project (correctly) and included in the unit project. Coverage shows no gap, but confirm that the spec at `src/features/ask/orchestration/ask-orchestrator.spec.ts` is included by the unit glob `src/**/*.spec.ts`.
5. **Storybook 4 skipped test files:** Pre-existing. Not introduced by this issue.

## Current date and working directory

- Date: 2026-05-14
- Working directory: `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask`
