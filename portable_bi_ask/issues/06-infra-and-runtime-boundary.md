# Issue 06: Infra and runtime boundary

## Objective

Move DuckDB, data-source setup, query-port, and runtime shims into a dedicated `src/infra` boundary after feature ownership is clearer.

## Why

Runtime concerns currently sit beside feature and domain files at the top level. Extracting them into infra clarifies what is application-independent plumbing versus feature behavior.

## Current-state findings

Infra/runtime files currently include:

- `src/db.ts`
- `src/data-source-manager.ts`
- `src/query-port.ts`
- `src/shims/**`
- Related specs such as `src/db.spec.ts` and `src/data-source-manager.spec.ts`
- Tooling is path-sensitive:
  - `vite.config.ts` aliases `chrono-node/en` and `chrono-node/pt`
  - `.storybook/main.ts` points those aliases at local shim files under `src/shims/chrono-node/*`
  - tests/helpers may indirectly rely on current import paths

## Target-state snippet

```text
src/infra/
  db/
    db.ts
  data-sources/
    data-source-manager.ts
  query/
    query-port.ts
  shims/
    chrono-node/
      en.ts
      pt.ts
```

## Dependencies

- Depends on: Issue 01.
- Recommended after: Issue 05 if ask/infrastructure imports are being updated together.

## Scope

- Move runtime infrastructure into `src/infra`.
- Update import paths and config references carefully.
- Preserve current behavior for DuckDB setup, CSV view creation, and external-package shims.

## Non-goals

- Rewriting infra abstractions.
- Replacing DuckDB or changing runtime APIs.
- Introducing new path aliases unless done explicitly in config.

## Step-by-step tasks

1. Inventory all imports of `db.ts`, `data-source-manager.ts`, `query-port.ts`, and `src/shims/**`.
2. Create `src/infra/` with a shallow structure such as `db`, `data-sources`, `query`, and `shims`.
3. Move infra files and their colocated specs if appropriate, keeping tests under `src/**`.
4. Update app/feature imports to the new infra locations.
5. Update config-sensitive references, especially:
   - `vite.config.ts`
   - `.storybook/main.ts`
   - any test helpers or direct imports revealed by grep
6. Confirm Storybook still resolves the `chrono-node/*` shim aliases.
7. Add temporary re-exports only if they meaningfully reduce migration risk.
8. Validate infra unit tests, app boot, and Storybook startup.

## Acceptance criteria

- Infra/runtime files live under `src/infra`.
- DuckDB initialization still works.
- Data-source view creation still works.
- Shim alias resolution still works in Vite and Storybook.
- Config references and imports are updated without breaking feature behavior.

## Validation

- Run:
  - `src/db.spec.ts`
  - `src/data-source-manager.spec.ts`
- Run any tests that cover query-port consumers.
- Start Storybook and confirm it resolves shimmed chrono imports.
- Run app build/start checks relevant to DuckDB initialization.
- If touched, verify test helpers or integration setup still import the moved infra correctly.

## Notes / risks

- Alias configuration is the sharpest edge here; a path move can break Storybook even if unit tests pass.
- Keep the folder structure shallow; avoid building a mini-platform hierarchy under `infra`.
- If feature moves are still active, use transitional exports to avoid a large simultaneous import rewrite.
