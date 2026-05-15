# Issue 10: Move grid-layout-engine into the dashboard feature boundary

## Objective

Relocate `src/grid-layout-engine.ts` and its spec from the project root into
`src/features/dashboard/model/` where it belongs as dashboard-specific layout logic.

## Why

After the Issues 01–08 refactor, `src/grid-layout-engine.ts` is one of the last real
implementation files sitting at `src/` root. It is a 172-line module implementing grid
collision detection and layout migration — logic that is exclusively consumed by the
dashboard feature. Keeping it at the root hides dashboard ownership and leaves it outside
the `src/features/**` coverage glob in `vitest.config.ts`.

## Current state

- `src/grid-layout-engine.ts` — exports `findBestPosition()`, `migrateToGridLayout()`,
  `clampToGrid()`, and related grid helpers.
- `src/grid-layout-engine.spec.ts` — collocated spec.
- Three importers, all inside the dashboard feature:
  - `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts:8`
    — imports `findBestPosition`, `migrateToGridLayout`
  - `src/features/dashboard/ui/dashboard-canvas/dashboard-canvas.ts:15`
    — imports grid helpers
  - `src/features/dashboard/model/dashboard-yaml.ts:7`
    — imports grid helpers

## Target state

```text
src/features/dashboard/
  model/
    dashboard-config.ts
    dashboard-yaml.ts
    grid-layout-engine.ts       ← moved here
    grid-layout-engine.spec.ts  ← moved here
```

All three importers are updated to the new path. No compat shim needed (all importers are
inside the dashboard feature boundary).

## Step-by-step tasks

1. Move `src/grid-layout-engine.ts` → `src/features/dashboard/model/grid-layout-engine.ts`.
2. Move `src/grid-layout-engine.spec.ts` →
   `src/features/dashboard/model/grid-layout-engine.spec.ts`.
3. Update the three importers:
   - `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts`
     — change `'../../../../grid-layout-engine'`
     → `'../../model/grid-layout-engine'`
   - `src/features/dashboard/ui/dashboard-canvas/dashboard-canvas.ts`
     — change `'../../../../grid-layout-engine'`
     → `'../../model/grid-layout-engine'`
   - `src/features/dashboard/model/dashboard-yaml.ts`
     — change `'../../../grid-layout-engine'`
     → `'./grid-layout-engine'`
4. Confirm no other file imports the old path:
   ```sh
   grep -rn "from '.*grid-layout-engine'" src/ --include="*.ts"
   ```
   Expected: only the three updated lines above, all pointing at the new path.
5. Run `npm run typecheck` to confirm no broken imports.

## Acceptance criteria

- `src/grid-layout-engine.ts` and `src/grid-layout-engine.spec.ts` no longer exist at root.
- Both files exist under `src/features/dashboard/model/`.
- All three importers reference the new path.
- Spec still runs under the `unit` Vitest project (it is matched by `src/**/*.spec.ts`
  and is now inside `src/features/**` so it is already covered by the coverage glob).
- `npm run typecheck`, `npm run lint`, `npm run test:unit` all pass.

## Validation

```sh
npm run typecheck
npm run lint
npm run format:check
npx vitest run --project unit src/features/dashboard/model/grid-layout-engine.spec.ts
npm run build
```

## Notes / risks

- No compat shim needed — all three importers are within the same feature tree and can be
  updated directly.
- Spec file must be moved alongside the source file so Vitest continues to discover it
  under `src/**/*.spec.ts`.
- Check that `vitest.config.ts` does not explicitly exclude `src/features/dashboard/model/`
  from the unit project (it should not — the exclusion only targets `ui/**/*.spec.ts`).
