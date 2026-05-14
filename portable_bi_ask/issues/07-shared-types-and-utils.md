# Issue 07: Shared types and utilities boundary

## Objective

Split cross-cutting shared types and utilities into clearer `src/shared` modules only after feature and infra ownership has stabilized.

## Why

`src/types.ts` currently concentrates many unrelated contracts in one file, and generic helpers/styles are also flat at the top level. Doing this split late avoids broad churn while feature ownership is still moving.

## Current-state findings

Shared or cross-cutting files currently include:

- `src/types.ts`
- `src/utils.ts`
- `src/icons.ts`
- `src/styles.css`
- `src/styles/**`
- `src/components/ui-button/`, `src/components/ui-text-field/`, `src/components/spinner/`, `src/components/skeleton-loader/` may eventually belong to shared UI, but this issue should move them only if ownership is already clear.
- `src/types.ts` contains ask, dashboard, question, widget, and infra-related contracts together.

## Target-state snippet

```text
src/shared/
  types/
    ask.ts
    dashboard.ts
    question.ts
    data-source.ts
    index.ts
  utils/
    utils.ts
    icons.ts
  styles/
    styles.css
    *.css
  ui/
    # only for clearly shared components
```

## Dependencies

- Depends on: Issues 03, 04, 05, and 06.

## Scope

- Split `src/types.ts` into bounded shared modules.
- Move generic utilities and shared styles into `src/shared`.
- Preserve public import surfaces during migration with temporary re-exports/barrels.

## Non-goals

- Abstracting every reusable-looking file into shared.
- Changing data contracts.
- Deeply reorganizing component APIs.

## Step-by-step tasks

1. Inventory imports from `src/types.ts` and group them by actual bounded context.
2. Create `src/shared/types/` modules such as `ask.ts`, `dashboard.ts`, `question.ts`, and `data-source.ts` only where the split is supported by current usage.
3. Add `src/shared/types/index.ts` and temporary re-exports from the old `src/types.ts` path while migration is in progress.
4. Move clearly generic helpers:
   - `src/utils.ts`
   - `src/icons.ts`
5. Move global/shared styles into `src/shared/styles/` while keeping app entry imports working.
6. Move only clearly shared UI components if their ownership is already settled; otherwise leave them for a later dedicated pass.
7. Update imports gradually and avoid one-shot changes across the whole repo.
8. Remove stale imports only after new shared entrypoints are in place.

## Acceptance criteria

- `src/types.ts` is broken into bounded shared modules with a transitional compatibility path during migration.
- Generic utilities and styles live under `src/shared`.
- No premature abstraction forces feature-specific files into shared.
- Import churn is staged through temporary barrels or re-exports.

## Validation

- Run full typecheck.
- Run lint.
- Run unit/component/storybook test suites.
- Grep for stale imports of moved shared files and confirm any remaining ones are intentional temporary compatibility imports.

## Notes / risks

- This step can create circular dependencies if the split follows old import habits instead of real ownership.
- Moving styles may affect app bootstrap and Storybook preview imports.
- Avoid relocating borderline-shared UI components until their feature ownership is actually clear from earlier issues.
