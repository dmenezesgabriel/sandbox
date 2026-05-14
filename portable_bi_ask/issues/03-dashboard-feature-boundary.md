# Issue 03: Dashboard feature boundary

## Objective

Consolidate dashboard UI, model, registry, YAML conversion, and seed assets into a single `dashboard` bounded context with shallow internal folders.

## Why

Dashboard behavior is currently split across multiple `src/components/dashboard-*` folders plus flat top-level files. That weakens ownership and makes dashboard-specific changes spill into unrelated areas.

## Current-state findings

Dashboard-related files are currently spread across:

- UI:
  - `src/components/dashboard-list/`
  - `src/components/dashboard-editor/`
  - `src/components/dashboard-editor-header/`
  - `src/components/dashboard-canvas/`
  - `src/components/dashboard-workspace/`
  - `src/components/widget/`
  - `src/components/widget-editor/`
  - `src/components/question-picker/` (shared with question selection, but dashboard-oriented in usage)
  - `src/components/top-nav/` (may become shared later; do not force that decision here)
- Model/data files:
  - `src/dashboard-config.ts`
  - `src/dashboard-registry.ts`
  - `src/dashboard-yaml.ts`
- Seed content:
  - `src/dashboards/*.yaml`
- Tests/stories are colocated under `src/**`.
- Persistence uses localStorage key `persisted_dashboards_v1`.
- Seed loading and runtime registry mutation both live in `src/dashboard-registry.ts`.

## Target-state snippet

```text
src/features/dashboard/
  ui/
    dashboard-list/
    dashboard-editor/
    dashboard-editor-header/
    dashboard-canvas/
    dashboard-workspace/
    widget/
    widget-editor/
    question-picker/
  model/
    dashboard-config.ts
    dashboard-yaml.ts
  data/
    dashboard-registry.ts
    dashboards/
      portable-bi-dashboard.yaml
  index.ts
```

## Dependencies

- Depends on: Issue 01.
- Recommended before or after: easier after Issue 02 because the app shell currently imports dashboard/question UI directly.

## Scope

- Move dashboard-owned code into `src/features/dashboard`.
- Keep internal structure shallow.
- Preserve current registry API behavior and existing persistence/seed semantics.
- Allow temporary re-exports from old paths during migration.

## Non-goals

- Redesigning dashboard persistence.
- Changing widget/dashboard data shapes.
- Extracting shared UI to `src/shared` yet.

## Step-by-step tasks

1. Inventory every dashboard-owned file and mark whether it belongs in `ui`, `model`, or `data`.
2. Create `src/features/dashboard/` with shallow subfolders only.
3. Move config/model conversion files:
   - `src/dashboard-config.ts`
   - `src/dashboard-yaml.ts`
4. Move data ownership:
   - `src/dashboard-registry.ts`
   - `src/dashboards/*.yaml`
5. Move dashboard UI folders into `src/features/dashboard/ui/...` while keeping stories/specs colocated.
6. Decide whether `question-picker` stays temporarily inside dashboard UI for this step; if yes, document why and keep behavior unchanged.
7. Add `src/features/dashboard/index.ts` that exposes the dashboard public surface.
8. Preserve or temporarily re-export the existing `dashboardList` and `dashboardRegistry` import surfaces so app/ask code can migrate incrementally.
9. Update imports in dashboard components, tests, stories, and any app shell references.
10. Validate dashboard list, create, edit, save, and load flows.

## Acceptance criteria

- Dashboard-owned files live under one dashboard feature boundary.
- The folder structure remains shallow and understandable.
- `persisted_dashboards_v1` remains unchanged.
- YAML seed dashboards still load correctly.
- Existing registry exports remain available or are temporarily re-exported during migration.
- Dashboard list/editor/workspace flows behave the same before and after the move.

## Validation

- Run `src/dashboard-registry.spec.ts`.
- Run dashboard-related component/model specs such as:
  - `src/components/dashboard/dashboard.spec.ts`
  - `src/components/dashboard-editor-header/dashboard-editor-header.spec.ts`
  - `src/components/dashboard-workspace/dashboard-workspace-model.spec.ts`
  - `src/components/widget/widget-model.spec.ts`
- Run dashboard Storybook stories.
- Manual smoke test:
  - open dashboard list,
  - create or edit a dashboard,
  - reload the page,
  - confirm persisted dashboards still appear.

## Notes / risks

- Some UI pieces may later prove shared, but this issue should optimize for current ownership, not speculative reuse.
- Moving YAML assets may require careful relative-import updates.
- Registry changes must not drop persisted user dashboards or break seed bootstrapping.
