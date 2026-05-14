# Issue 08: Import cleanup and documentation

## Objective

Remove transitional re-exports, normalize import paths, and document the final frontend structure after all structural moves are complete.

## Why

The earlier issues intentionally allow temporary compatibility layers to reduce risk. This final issue removes that debt and leaves the repo in a clean, documented state.

## Current-state findings

- Earlier refactor steps will likely leave temporary `index.ts` barrels and re-export files.
- Import styles are currently mixed and may become more inconsistent during staged moves.
- README/contributor notes do not yet describe the target bounded-context structure.
- Storybook and Vitest both rely on code and stories/specs remaining under `src/**`.

## Target-state snippet

```text
src/
  app/
  features/
    ask/
    dashboard/
    question/
  infra/
  shared/
```

## Dependencies

- Depends on: Issues 01 through 07.

## Scope

- Remove temporary compatibility exports that are no longer needed.
- Normalize import style across the repo.
- Update docs to reflect final ownership and folder structure.
- Confirm story/spec colocation still matches configured globs.

## Non-goals

- New architectural changes.
- Renaming major concepts after the structure has stabilized.
- Feature behavior changes.

## Step-by-step tasks

1. Inventory all temporary re-export/barrel files added during Issues 02-07.
2. Remove compatibility exports only after all callers use the final paths.
3. Normalize import paths:
   - choose and document the accepted relative-import style,
   - avoid introducing runtime-only aliases unless config explicitly supports them.
4. Grep for stale imports referencing old top-level paths and remove them.
5. Update README or contributor-facing structure notes with the final tree and ownership rules.
6. Confirm Storybook stories and Vitest specs are still colocated under `src/**` and match existing globs.
7. Capture a final repo tree snapshot in the docs/issue notes.
8. Run the full validation suite.

## Acceptance criteria

- Transitional re-exports are removed.
- Repo imports consistently reference the final structure.
- Documentation explains the final bounded-context layout and migration result.
- Story/spec discovery still works under existing globs.
- Full validation passes.

## Validation

- Run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test:unit`
  - `npm run test:components`
  - `npm run test:storybook`
- Run targeted smoke checks for routing, dashboard flows, question flows, and ask flows.
- Grep for removed old paths to confirm there are no accidental leftovers.

## Notes / risks

- Removing compatibility layers too early can break downstream imports; do this only after all earlier moves are complete.
- Documentation can drift quickly; ensure the recorded final tree matches the actual filesystem.
- If any old import path must remain for a justified compatibility reason, document it explicitly instead of leaving silent exceptions.
