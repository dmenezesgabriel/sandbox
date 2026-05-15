# Issue 09: Move app-config into the app boundary

## Objective

Relocate `src/app-config.ts` from the project root into `src/app/` where it belongs as
app-level initialization logic.

## Why

After the Issues 01–08 refactor, `src/app-config.ts` is the only non-shim file left at
`src/` root that is purely app-initialization logic. It defines the default dashboard seed
used at first boot and has exactly one consumer inside the dashboard feature. Keeping it at
the root mixes app-boot concerns with feature/infra files and leaves coverage gap in
`vitest.config.ts` (the `src/app/` directory is not currently included).

## Current state

- `src/app-config.ts` — exports `APP_DEFAULT_DASHBOARD_SEED` (string constant) and
  `createDefaultDashboardSeed()` (factory function).
- One importer: `src/features/dashboard/model/dashboard-config.ts:1` imports
  `createDefaultDashboardSeed` from `'../../../app-config'`.
- No spec file exists for `app-config.ts`.

## Target state

```text
src/app/
  app-config.ts       ← moved here
  main.ts
  routing/
  shell/
```

The single importer is updated to the new path; no compat shim is needed (there is only one
importer and it is within the project source).

## Step-by-step tasks

1. Move `src/app-config.ts` → `src/app/app-config.ts`. No content changes.
2. Update the one importer:
   - `src/features/dashboard/model/dashboard-config.ts:1`
     — change `'../../../app-config'` → `'../../../app/app-config'`.
3. Verify no other file imports the old path:
   ```sh
   grep -rn "from '.*app-config'" src/ --include="*.ts"
   ```
   Expected: only the updated `dashboard-config.ts` line remains, pointing at the new path.
4. Update `vitest.config.ts` coverage `include` to add `'src/app/**/*.ts'` so the moved
   file is included in coverage reports.

## Acceptance criteria

- `src/app-config.ts` no longer exists.
- `src/app/app-config.ts` exists with identical content.
- `src/features/dashboard/model/dashboard-config.ts` imports from the new path.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` all pass.

## Validation

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run build
```

## Notes / risks

- Single importer — lowest-risk move in the post-refactor cleanup set.
- No spec file to move.
- `vitest.config.ts` must be updated or `src/app/app-config.ts` will be invisible to
  coverage reports.
