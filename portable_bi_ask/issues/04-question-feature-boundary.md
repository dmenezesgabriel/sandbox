# Issue 04: Question feature boundary

## Objective

Consolidate question UI, config, registry, YAML parsing, and seed assets into a single `question` bounded context parallel to the dashboard feature layout.

## Why

Question files currently follow the same split pattern as dashboards: UI under `src/components/question-*` and core behavior in flat top-level files. Aligning question ownership with the dashboard feature makes future maintenance and import cleanup much easier.

## Current-state findings

Question-related files are currently spread across:

- UI:
  - `src/components/question-list/`
  - `src/components/question-editor/`
  - `src/components/question-editor-panel/`
- Model/data files:
  - `src/question-config.ts`
  - `src/question-registry.ts`
  - `src/question-yaml.ts`
  - `src/question-parser.ts` (question-specific parsing dependency to review during move)
- Seed content:
  - `src/questions/*.yaml`
- Persistence uses localStorage key `persisted_questions_v1`.
- The UI currently writes directly to the registry; this move should preserve that behavior before any deeper design cleanup.

## Target-state snippet

```text
src/features/question/
  ui/
    question-list/
    question-editor/
    question-editor-panel/
  model/
    question-config.ts
    question-yaml.ts
    question-parser.ts
  data/
    question-registry.ts
    questions/
      sales-by-region.yaml
      top-products.yaml
  index.ts
```

## Dependencies

- Depends on: Issue 01.
- Prefer after: Issue 02, because app routing currently references question UI directly.

## Scope

- Move question-owned files into `src/features/question`.
- Mirror the shallow-structure rules established for dashboards.
- Preserve seed loading, parsing, persistence, and direct-registry UI behavior.

## Non-goals

- Redesigning question editing architecture.
- Introducing service layers between UI and registry.
- Splitting shared types yet.

## Step-by-step tasks

1. Inventory question-owned files and categorize them into `ui`, `model`, and `data`.
2. Create `src/features/question/` with shallow subfolders only.
3. Move question model/parsing files:
   - `src/question-config.ts`
   - `src/question-yaml.ts`
   - `src/question-parser.ts` if ownership is confirmed as question-specific.
4. Move question data ownership:
   - `src/question-registry.ts`
   - `src/questions/*.yaml`
5. Move question UI folders while preserving colocated stories/specs.
6. Add `src/features/question/index.ts` as the feature public surface.
7. Keep direct registry writes working from the editor UI; do not redesign data flow in this issue.
8. Add temporary re-exports from old paths if they reduce import churn safely.
9. Update imports in app routing, tests, and stories.
10. Validate create/update/delete and list/edit navigation flows.

## Acceptance criteria

- Question-owned files live under one feature boundary with shallow internal folders.
- `persisted_questions_v1` remains unchanged.
- YAML question seeds still load.
- Editor/list behavior remains unchanged, including direct writes to the registry.
- Tests/stories continue to live under `src/**` and pass after import updates.

## Validation

- Run:
  - `src/question-registry.spec.ts`
  - `src/question-yaml.spec.ts`
  - `src/question-parser.spec.ts`
- Run any question-related component stories.
- Manual smoke test:
  - open question list,
  - edit an existing question,
  - create a question if the UI allows it,
  - delete/update and reload,
  - confirm persisted questions remain available.

## Notes / risks

- `question-parser.ts` may have cross-feature dependencies; confirm ownership before moving it.
- Avoid improving architecture and moving files in one step; preserve current behavior first.
- Relative imports to YAML files and parser helpers are likely the highest-risk part of the move.
