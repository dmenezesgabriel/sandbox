Implemented issue 03 by moving dashboard-owned model, data, UI, specs/stories, and seed YAML under `src/features/dashboard` with shallow `ui/`, `model/`, and `data/` folders.

Changed files:

- Added feature root and moved dashboard code to:
  - `src/features/dashboard/index.ts`
  - `src/features/dashboard/model/dashboard-config.ts`
  - `src/features/dashboard/model/dashboard-config.spec.ts`
  - `src/features/dashboard/model/dashboard-yaml.ts`
  - `src/features/dashboard/data/dashboard-registry.ts`
  - `src/features/dashboard/data/dashboard-registry.spec.ts`
  - `src/features/dashboard/data/dashboards/portable-bi-dashboard.yaml`
  - `src/features/dashboard/ui/dashboard/**`
  - `src/features/dashboard/ui/dashboard-canvas/**`
  - `src/features/dashboard/ui/dashboard-editor/**`
  - `src/features/dashboard/ui/dashboard-editor-header/**`
  - `src/features/dashboard/ui/dashboard-list/**`
  - `src/features/dashboard/ui/dashboard-workspace/**`
  - `src/features/dashboard/ui/question-picker/**`
  - `src/features/dashboard/ui/widget/**`
  - `src/features/dashboard/ui/widget-editor/**`
- Updated `src/app/shell/app-shell.ts` to import dashboard code from the new feature boundary.
- Kept compatibility re-exports at old paths:
  - `src/dashboard-config.ts`
  - `src/dashboard-registry.ts`
  - `src/dashboard-yaml.ts`
  - `src/components/dashboard*/index.ts`
  - `src/components/question-picker/index.ts`
  - `src/components/widget*/index.ts`
- Updated `vitest.config.ts` so moved dashboard UI specs remain in the browser/components project and dashboard feature files stay in coverage scope.

Behavior/preservation notes:

- `persisted_dashboards_v1` stayed unchanged in `src/features/dashboard/data/dashboard-registry.ts`.
- Seed YAML loading still works from the moved `data/dashboards/` asset path.
- Registry exports (`dashboardList`, `dashboardRegistry`, etc.) remain available through compatibility re-exports.
- `question-picker` was moved into dashboard UI because its current ownership is dashboard-local (`dashboard-workspace` is its active consumer); no behavior change was made.
- `top-nav` was intentionally left outside the dashboard feature.

Validation passed:

- `npm run typecheck`
- `npm run build`
- `npx vitest run --project unit src/features/dashboard/data/dashboard-registry.spec.ts src/features/dashboard/ui/dashboard/dashboard.spec.ts src/features/dashboard/ui/dashboard-workspace/dashboard-workspace-model.spec.ts src/features/dashboard/ui/widget/widget-model.spec.ts`
- `npx vitest run --project components src/features/dashboard/ui/dashboard-editor-header/dashboard-editor-header.spec.ts`
- `npx vitest run --project storybook src/features/dashboard/ui/dashboard-list/dashboard-list.stories.ts src/features/dashboard/ui/dashboard-editor/dashboard-editor.stories.ts src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.stories.ts src/features/dashboard/ui/dashboard-canvas/dashboard-canvas.stories.ts src/features/dashboard/ui/widget/widget.stories.ts src/features/dashboard/ui/widget-editor/widget-editor.stories.ts src/features/dashboard/ui/dashboard/dashboard.stories.ts src/features/dashboard/ui/dashboard-editor-header/dashboard-editor-header.stories.ts`

Not run:

- Manual browser smoke test for create/edit/save/reload flows.

Follow-up risks:

- Old component folders now only provide transitional `index.ts` re-exports; direct imports to removed old file paths like `src/components/dashboard-list/dashboard-list.ts` would no longer resolve.
- `vitest.config.ts` still has mixed legacy/new boundary assumptions and will likely need another pass when later feature-boundary issues move more UI.
