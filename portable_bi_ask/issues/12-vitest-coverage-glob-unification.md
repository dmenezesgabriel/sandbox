# Issue 12: Unify vitest coverage globs

## Objective

Replace the four separate per-boundary coverage `include` globs in `vitest.config.ts` with
a unified `src/**/*.ts` pattern and add the `src/app/**/*.ts` gap that currently exists,
so coverage is complete and does not require manual updates when new folders are added.

## Why

After the Issues 01–11 refactor, `vitest.config.ts` has accumulated four separate globs
that must be maintained manually whenever a new top-level boundary is added:

```ts
include: [
  'src/components/**/*.ts',
  'src/features/**/*.ts',
  'src/infra/**/*.ts',
  'src/shared/**/*.ts',
],
```

`src/app/**/*.ts` is missing entirely, so `app-config.ts`, `app-shell.ts`, and
`hash-routes.ts` are excluded from coverage reports. A unified `src/**/*.ts` glob covers
all current and future boundaries without manual upkeep, provided the existing exclusions
(`**/*.stories.ts`, `**/index.ts`) are preserved.

## Current state

In `vitest.config.ts` (lines 21–27):

```ts
coverage: {
  provider: 'v8',
  include: [
    'src/components/**/*.ts',
    'src/features/**/*.ts',
    'src/infra/**/*.ts',
    'src/shared/**/*.ts',
  ],
  exclude: ['**/*.stories.ts', '**/index.ts'],
  ...
}
```

Missing: `src/app/` — `app-shell.ts`, `hash-routes.ts`, `main.ts`, `app-config.ts` are
all invisible to coverage.

Also missing implicitly: any future top-level boundary added under `src/` would need a
manual glob addition.

## Target state

```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.ts'],
  exclude: ['**/*.stories.ts', '**/index.ts'],
  ...
}
```

## Step-by-step tasks

1. Open `vitest.config.ts`.
2. Replace the four `include` entries with a single `'src/**/*.ts'`.
3. Verify the existing `exclude` array (`'**/*.stories.ts'`, `'**/index.ts'`) is preserved
   — these are already correct and exclude noise from coverage.
4. Run the full test suite with coverage to confirm no unexpected files are pulled in and
   coverage thresholds still pass:
   ```sh
   npm run test:unit -- --coverage
   ```
5. Spot-check that `src/app/shell/app-shell.ts` and `src/app/routing/hash-routes.ts` now
   appear in the coverage report.
6. Confirm the two root-level files that remain (`src/grid-layout-engine.ts` if not yet
   moved, `src/app-config.ts` if not yet moved) appear or are absent as expected. If
   Issues 09 and 10 are complete before this issue runs, no root-level implementation files
   should remain outside `src/app/`, `src/features/`, `src/infra/`, or `src/shared/`.

## Acceptance criteria

- `vitest.config.ts` `coverage.include` contains exactly `['src/**/*.ts']`.
- `coverage.exclude` retains `['**/*.stories.ts', '**/index.ts']`.
- `src/app/` files appear in coverage output.
- All existing coverage watermarks continue to pass (50% low, 80% high for
  statements/branches/functions/lines).
- `npm run test:unit` and `npm run test:components` still pass.

## Validation

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:components
```

## Notes / risks

- This is a pure config change — no source files are moved or modified.
- The unified glob will also pick up any remaining files at `src/` root (e.g.,
  `src/env.d.ts`, `src/main.ts`). Type declaration files (`.d.ts`) are excluded by
  TypeScript by default but verify `src/main.ts` is not a false positive in coverage.
- Recommended to run after Issues 09, 10, and 11 so that the final glob reflects the
  fully settled directory layout.
- Depends on: Issues 01–08 completed (already done). Recommended after Issues 09–11 but
  can be applied independently if needed.
