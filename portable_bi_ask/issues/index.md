# Frontend Refactor Backlog Index

This directory contains the ordered issue backlog for reorganizing the frontend into clearer bounded contexts with shallow folder structure and low-risk import migration.

## Sequence

1. [`01-frontend-target-structure.md`](./01-frontend-target-structure.md) — lock the target folder structure, migration rules, and refactor guardrails.
2. [`02-app-shell-and-routing.md`](./02-app-shell-and-routing.md) — isolate app bootstrap, shell, and hash routing.
3. [`03-dashboard-feature-boundary.md`](./03-dashboard-feature-boundary.md) — consolidate dashboard files into a dashboard feature boundary.
4. [`04-question-feature-boundary.md`](./04-question-feature-boundary.md) — consolidate question files into a question feature boundary.
5. [`05-ask-feature-boundary.md`](./05-ask-feature-boundary.md) — group ask orchestration, logic, and UI into one bounded context.
6. [`06-infra-and-runtime-boundary.md`](./06-infra-and-runtime-boundary.md) — move DuckDB/runtime/shim concerns into infra.
7. [`07-shared-types-and-utils.md`](./07-shared-types-and-utils.md) — split shared types/utilities only after feature ownership is clearer.
8. [`08-import-cleanup-and-docs.md`](./08-import-cleanup-and-docs.md) — remove transition layers, normalize imports, and document the final structure.
9. [`09-app-config-to-app-boundary.md`](./09-app-config-to-app-boundary.md) — move app-config.ts into src/app/ where it belongs.
10. [`10-grid-layout-engine-to-dashboard.md`](./10-grid-layout-engine-to-dashboard.md) — move grid-layout-engine into the dashboard feature model.
11. [`11-shared-ui-components.md`](./11-shared-ui-components.md) — move cross-feature ui-button and ui-text-field into src/shared/ui/.
12. [`12-vitest-coverage-glob-unification.md`](./12-vitest-coverage-glob-unification.md) — replace per-boundary coverage globs with a unified src/\*_/_.ts pattern.

## Dependency summary

- 01 has no dependencies.
- 02 depends on 01.
- 03 depends on 01 and is easier after 02.
- 04 depends on 01 and is easier after 02.
- 05 depends on 01 and should usually follow 03-04.
- 06 can begin after 01, but is safest after 05 when import ownership is clearer.
- 07 depends on 03-06.
- 08 depends on 01-07.
- 09 depends on 01-08. Single-importer move, fully isolated.
- 10 depends on 01-08. Single-feature move, fully isolated.
- 11 depends on 01-08. Can run independently of 09 and 10.
- 12 depends on 01-08. Recommended after 09-11 so the glob reflects the settled layout.

## Global rules carried across all issues

Use `references/frontend-target-structure.md` as the canonical migration guardrail document for Issues 02-08.

- Keep folders shallow: prefer `feature/{ui,model,data}` over deeply nested trees.
- Keep stories/specs under `src/**` so Storybook and Vitest globs continue to work.
- Prefer temporary re-export barrels during moves instead of one-shot import churn.
- Do not introduce new runtime aliases unless a dedicated config change is part of the issue.
- Preserve existing route behavior, localStorage keys, YAML seeds, and test coverage while moving files.
- Re-validate Vite, Vitest, and Storybook path assumptions whenever files move.
