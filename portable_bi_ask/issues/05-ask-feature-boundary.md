# Issue 05: Ask feature boundary

## Objective

Group ask UI, orchestration, parsing/planning/analysis logic, and dashboard-ask wiring into a single `ask` bounded context without changing runtime behavior.

## Why

Ask-related files are currently scattered across top-level modules and UI component folders. Consolidating them clarifies ownership and makes dependencies on dashboard/question types and infra explicit.

## Current-state findings

Candidate ask-owned files include:

- UI:
  - `src/components/ask-clarification/`
  - `src/components/ask-input/`
  - `src/components/ask-result/`
- Orchestration/wiring:
  - `src/ask-data.ts`
  - `src/ask-orchestrator.ts`
  - `src/create-dashboard-orchestrator.ts`
- Ask/domain helpers likely to move with the feature:
  - `src/catalog-builder.ts`
  - `src/date-question-text.ts`
  - `src/date-range-parser.ts`
  - `src/diagnostic-runner.ts`
  - `src/field-search.ts`
  - `src/intent-cue-detector.ts`
  - `src/intent-describer.ts`
  - `src/month-catalog.ts`
  - `src/narrative-generator.ts`
  - `src/result-analysis.ts`
  - `src/result-analyzer.ts`
  - `src/semantic-field-matcher.ts`
  - `src/semantic-modeling.ts`
  - `src/sql-planner.ts`
  - `src/sql-renderer.ts`
  - `src/term-matcher.ts`
  - `src/value-filter-resolver.ts`
  - `src/vocabulary.ts`
- These modules depend on dashboard config/types and DuckDB-related infra.

## Target-state snippet

```text
src/features/ask/
  ui/
    ask-input/
    ask-clarification/
    ask-result/
  orchestration/
    ask-orchestrator.ts
    create-dashboard-orchestrator.ts
  model/
    ask-data.ts
    sql-planner.ts
    sql-renderer.ts
    result-analysis.ts
    ...
  index.ts
```

## Dependencies

- Depends on: Issue 01.
- Recommended after: Issues 03 and 04 when dashboard/question import targets stabilize.

## Scope

- Move ask-owned code into `src/features/ask`.
- Keep internal structure shallow.
- Preserve current imports from dashboard/question modules and infra, using temporary re-exports where helpful.
- Keep runtime behavior unchanged.

## Non-goals

- Redesigning the ask engine.
- Changing result semantics, planner logic, or prompt behavior.
- Extracting infra in the same step unless already isolated by Issue 06.

## Step-by-step tasks

1. Confirm the ask file inventory and split it into `ui`, `orchestration`, and `model`.
2. Create `src/features/ask/` with shallow subfolders only.
3. Move ask UI component folders and keep their stories/specs colocated.
4. Move orchestrator files:
   - `src/ask-orchestrator.ts`
   - `src/create-dashboard-orchestrator.ts`
5. Move ask-model/helper files in small batches, preserving tests after each batch if possible.
6. Add `src/features/ask/index.ts` as the feature public surface.
7. Update dashboard/editor/workspace imports that render ask UI or create orchestrators.
8. If dashboard/question feature moves have not landed yet, use temporary re-exports instead of broad one-shot rewrites.
9. Validate ask unit specs and dashboard ask flows end to end.

## Acceptance criteria

- Ask-owned files live under one bounded context with shallow structure.
- Existing dashboard ask flows still initialize data sources and return results.
- Imports from dashboard/question modules and infra continue to work during migration.
- Stories/specs remain under `src/**` and pass after updates.

## Validation

- Run ask-related specs, including:
  - `src/ask-orchestrator.spec.ts`
  - `src/catalog-builder.spec.ts`
  - `src/date-question-text.spec.ts`
  - `src/date-range-parser.spec.ts`
  - `src/diagnostic-runner.spec.ts`
  - `src/intent-cue-detector.spec.ts`
  - `src/intent-describer.spec.ts`
  - `src/result-analysis.spec.ts`
  - `src/result-analyzer.spec.ts`
  - `src/sql-planner.spec.ts`
  - `src/sql-renderer.spec.ts`
  - related matcher/modeling specs
- Run ask component stories.
- Manual smoke test from a dashboard ask flow: initialize a dashboard, ask a question, confirm results and clarifications still render.

## Notes / risks

- This area has many tightly related files; move them in staged batches but keep the issue boundary focused.
- Dashboard-config and infra imports are the main source of churn; use temporary compatibility exports if needed.
- Do not mix logic changes with folder moves or debugging improvements.
