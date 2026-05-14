# Issue 02: App shell and hash routing boundary

## Objective

Move app bootstrap, shell rendering, and hash-route parsing into an `src/app` boundary without changing route behavior.

## Why

`src/components/dashboard/dashboard.ts` currently mixes app-shell concerns with dashboard/question feature rendering. Separating app ownership first reduces coupling before feature file moves begin.

## Current-state findings

- `src/main.ts` imports `./styles.css` and `./components/dashboard`.
- `src/components/dashboard/dashboard.ts` defines the root custom element and owns hash-based navigation.
- Current routes are:
  - `#/`
  - `#/dashboard/:slug`
  - `#/questions`
  - `#/question/:slug`
- The component binds a fresh function in lifecycle hooks, so `disconnectedCallback` risks removing a different listener than `connectedCallback` added.
- Stories/specs already exist for the dashboard shell and will need import-path attention if files move.

## Target-state snippet

```text
src/
  app/
    main.ts
    shell/
      app-shell.ts
    routing/
      hash-routes.ts
  components/
    dashboard/
      index.ts   # temporary compatibility export if needed
```

## Dependencies

- Depends on: Issue 01.

## Scope

- Move app entry ownership into `src/app`.
- Extract route parsing/render-selection into app-level code.
- Preserve custom-element behavior and current URLs.
- Optionally leave temporary compatibility exports in old locations during migration.

## Non-goals

- Changing route semantics.
- Moving dashboard/question internals into feature folders yet.
- Introducing a router library.

## Step-by-step tasks

1. Inventory current app entry files:
   - `src/main.ts`
   - `src/components/dashboard/dashboard.ts`
   - `src/components/dashboard/index.ts`
   - related specs/stories.
2. Create the target app boundary, for example:
   - `src/app/main.ts`
   - `src/app/shell/app-shell.ts`
   - `src/app/routing/hash-routes.ts`
3. Move pure route parsing and route-to-view selection out of the shell component into app routing helpers.
4. Rename shell ownership to something app-oriented (`app-shell`) while preserving the rendered feature components.
5. Fix the event-listener lifecycle bug by storing a stable handler reference instead of binding fresh functions in both lifecycle methods.
6. Update the root entry import path so the browser app still starts from the right module.
7. If needed, keep `src/components/dashboard/index.ts` as a temporary re-export to reduce churn for stories/specs while the move lands.
8. Update any specs/stories importing the moved shell directly.
9. Run route-focused and component-focused validation.

## Acceptance criteria

- App bootstrap and route parsing live under `src/app`.
- Route behavior remains unchanged for all four existing hash routes.
- The listener cleanup bug is removed by using a stable handler reference.
- Story/spec imports are updated or covered by temporary compatibility exports.
- No feature-domain moves are bundled into this issue.

## Validation

- Run the dashboard shell spec/story tests already present under `src/components/dashboard/*`.
- Manually load and navigate to:
  - `#/`
  - `#/dashboard/portable-bi-dashboard`
  - `#/questions`
  - `#/question/sales-by-region`
- Confirm back/forward and direct hash edits still re-render correctly.
- Verify the app still boots from the browser entry after the move.

## Notes / risks

- The current shell sits in a feature-looking folder, so imports may temporarily look awkward until later feature issues land.
- Storybook and Vitest are path-sensitive; keep stories/specs under `src/**` and update direct imports carefully.
- Avoid renaming route strings or custom-element tags unless the current code already requires it for the move.
