Implemented Issue 07 by moving all shared types, utilities, and styles into `src/shared/` with a clean, shallow layout, establishing compat shims at all old paths, cleaning up the orphaned `src/shims/` directory, and rationalising vitest coverage globs.

## What was implemented

### Directory created

```
src/shared/
  types/
    ask.ts          — primitive cell/row types + all ask-domain types (catalog, intent, parse, result)
    dashboard.ts    — dashboard and widget types (imports from ask.ts and data-source.ts)
    data-source.ts  — DataSourceConfig (no local dependencies)
    question.ts     — QuestionConfig (imports from dashboard.ts and data-source.ts)
    index.ts        — re-exports all four sub-modules
  utils/
    utils.ts        — moved from src/utils.ts (internal import updated to ../types/index)
    utils.spec.ts   — moved from src/utils.spec.ts (import already relative ./utils; unchanged)
    icons.ts        — moved from src/icons.ts (no local imports; unchanged)
  styles/
    styles.css      — moved from src/styles.css (import paths updated from ./styles/* to ./*)
    animations.css  — moved from src/styles/animations.css
    ask.css         — moved from src/styles/ask.css
    base.css        — moved from src/styles/base.css
    controls.css    — moved from src/styles/controls.css
    dashboard.css   — moved from src/styles/dashboard.css
    feedback.css    — moved from src/styles/feedback.css
    layout.css      — moved from src/styles/layout.css
    navigation.css  — moved from src/styles/navigation.css
    questions.css   — moved from src/styles/questions.css
    reset.css       — moved from src/styles/reset.css
    tokens.css      — moved from src/styles/tokens.css
```

### Compat re-export shims at old paths

The following old top-level files were replaced with shims. These will be removed in Issue 08 cleanup.

- `src/types.ts` — re-exports everything from `./shared/types/index`
- `src/utils.ts` — re-exports everything from `./shared/utils/utils`
- `src/icons.ts` — re-exports everything from `./shared/utils/icons`
- `src/styles.css` — CSS `@import` redirect to `./shared/styles/styles.css`

### Import updates

- `src/app/main.ts` — updated CSS import from `../styles.css` to `../shared/styles/styles.css`
- `.storybook/preview.ts` — updated CSS import from `../src/styles.css` to `../src/shared/styles/styles.css`

### Canonical spec moved

- `src/utils.spec.ts` — removed; canonical copy is now `src/shared/utils/utils.spec.ts`

### Orphaned directory removed

- `src/shims/` — removed (two files `chrono-node/en.ts` and `chrono-node/pt.ts` were no longer referenced; canonical copies are in `src/infra/shims/chrono-node/`)

### vitest.config.ts coverage rationalised

Replaced three separate feature globs with a single `src/features/**/*.ts` glob, and added `src/shared/**/*.ts`:

```diff
-  'src/features/dashboard/**/*.ts',
-  'src/features/question/**/*.ts',
-  'src/features/ask/**/*.ts',
+  'src/features/**/*.ts',
+  'src/shared/**/*.ts',
```

The `src/components/**/*.ts` and `src/infra/**/*.ts` globs remain unchanged.

## Decision on shared UI components

All four candidate components were assessed:

| Component         | Used by dashboard | Used by ask | Used by question | Used by app/shell | Decision                                                                                                                   |
| ----------------- | :---------------: | :---------: | :--------------: | :---------------: | -------------------------------------------------------------------------------------------------------------------------- |
| `ui-button`       |         ✓         |      ✓      |        —         |         ✓         | Leave in `src/components/` — genuinely cross-feature, but component boundary reorganisation is out of scope for this issue |
| `ui-text-field`   |         ✓         |      ✓      |        —         |         —         | Leave in `src/components/` — same reason                                                                                   |
| `spinner`         |         ✓         |      —      |        —         |         —         | Leave in `src/components/` — only dashboard imports it; could move to dashboard in a later pass                            |
| `skeleton-loader` |         ✓         |      —      |        —         |         —         | Leave in `src/components/` — only dashboard imports it; same                                                               |

No components were moved to `src/shared/ui/`. `spinner` and `skeleton-loader` are candidates for `features/dashboard/ui/` in Issue 08; `ui-button` and `ui-text-field` are candidates for `src/shared/ui/` once the component reorganisation issue is scoped.

## Types split rationale

### Dependency graph (no circular deps)

```
data-source.ts   (no local deps)
     ↑
  ask.ts         (imports: none — owns PrimitiveCell/CellValue/DataRow/Filters/ValueFormat/SortDirection
                              and all ask-domain catalog, intent, parse, result types)
     ↑
dashboard.ts     (imports from: ask.ts, data-source.ts)
     ↑
question.ts      (imports from: dashboard.ts, data-source.ts)
```

### Why primitive types live in `ask.ts`

`CellValue`, `DataRow`, `ValueFormat`, `SortDirection`, and `Filters` are defined in `ask.ts` rather than in a separate primitives file because:

1. They originated as part of the ask/catalog domain (field values, row results).
2. Extracting them to yet another file would add a fifth module with no boundary rationale.
3. Both `dashboard.ts` and `question.ts` can safely import upward from `ask.ts`.

### Why `DashboardConfig` stays in `dashboard.ts` and not `ask.ts`

The ask orchestrator files (`ask-orchestrator.ts`, `create-dashboard-orchestrator.ts`) take a `DashboardConfig` as input, but `DashboardConfig` is a dashboard-owned contract. Placing it in `ask.ts` would make the ask module "own" a dashboard concept. The ask feature files import `DashboardConfig` from `../../../types` which resolves via the compat shim — they will import from `shared/types/dashboard` directly after Issue 08 cleanup.

### Why `SourceColumnRef` is in `ask.ts`

It is used by `AskDataConfig.defaultMetric` and is not directly exported by any feature file; bundling it with `DashboardFilterConfig` in dashboard.ts would require a reverse dependency from ask.ts → dashboard.ts. Keeping it in `ask.ts` preserves the clean DAG.

## Changed files list

**New files:**

- `src/shared/types/ask.ts`
- `src/shared/types/dashboard.ts`
- `src/shared/types/data-source.ts`
- `src/shared/types/question.ts`
- `src/shared/types/index.ts`
- `src/shared/utils/utils.ts`
- `src/shared/utils/utils.spec.ts`
- `src/shared/utils/icons.ts`
- `src/shared/styles/styles.css`
- `src/shared/styles/animations.css`
- `src/shared/styles/ask.css`
- `src/shared/styles/base.css`
- `src/shared/styles/controls.css`
- `src/shared/styles/dashboard.css`
- `src/shared/styles/feedback.css`
- `src/shared/styles/layout.css`
- `src/shared/styles/navigation.css`
- `src/shared/styles/questions.css`
- `src/shared/styles/reset.css`
- `src/shared/styles/tokens.css`

**Modified (converted to shims or updated imports):**

- `src/types.ts` — converted to compat shim
- `src/utils.ts` — converted to compat shim
- `src/icons.ts` — converted to compat shim
- `src/styles.css` — converted to CSS redirect shim
- `src/app/main.ts` — CSS import updated to `../shared/styles/styles.css`
- `.storybook/preview.ts` — CSS import updated to `../src/shared/styles/styles.css`
- `vitest.config.ts` — coverage globs rationalised; `src/shared/**/*.ts` added

**Deleted:**

- `src/utils.spec.ts` — canonical copy moved to `src/shared/utils/utils.spec.ts`
- `src/shims/` (entire directory) — orphaned after Issue 06; canonical shims are in `src/infra/shims/`

## Validation results

All commands run from `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask` on 2026-05-14.

| Command                   | Result                                           |
| ------------------------- | ------------------------------------------------ |
| `npm run typecheck`       | PASS — no errors                                 |
| `npm run lint`            | PASS — no errors                                 |
| `npm run format:check`    | PASS — all files use Prettier code style         |
| `npm run test:unit`       | PASS — 28 test files, 565 tests                  |
| `npm run test:components` | PASS — 5 test files, 43 tests                    |
| `npm run test:storybook`  | PASS — 14 passed, 4 skipped (18 total), 72 tests |
| `npm run build`           | PASS — 2115 modules transformed, built in 3.34s  |
| `npm run build-storybook` | PASS — Storybook build completed successfully    |

**Grep validation — intentional shim importers only (expected):**

```
grep -r "from '.*\/types'" src/features src/infra src/app --include="*.ts" | grep -v "shared/types"
# → 60 lines, all going through src/types.ts compat shim (intentional)

grep -r "from '.*\/utils'" src/features src/infra src/app --include="*.ts" | grep -v "shared/utils"
# → 22 lines, all going through src/utils.ts compat shim (intentional)

grep -r "from '.*\/icons'" src/features src/infra src/app --include="*.ts" | grep -v "shared/utils"
# → 3 lines, all going through src/icons.ts compat shim (intentional)
```

No feature, infra, or app file imports directly from `src/shared/*`. All importers use the compat shims at the old paths, which will be removed in Issue 08.

**No runtime `@` imports** — confirmed by grep; none of the moved shared files use `@/` style imports.

## Follow-up risks and open questions

1. **All feature importers still use the old compat-shim paths.** Approximately 85 import statements across `src/features/`, `src/infra/`, and `src/app/` still reference `src/types.ts`, `src/utils.ts`, or `src/icons.ts` via relative paths. Issue 08 cleanup should rewrite these to the canonical `src/shared/types/*`, `src/shared/utils/utils`, and `src/shared/utils/icons` paths and then delete the three shims.

2. **`src/styles/` directory still exists (with old content).** The original CSS files under `src/styles/` are still present alongside the new copies in `src/shared/styles/`. They are no longer imported by any TS file (both `src/app/main.ts` and `.storybook/preview.ts` have been updated). Issue 08 should delete `src/styles/` and `src/styles.css` shim.

3. **`spinner` and `skeleton-loader` are dashboard-exclusive components.** They live in `src/components/` but are only used by `src/features/dashboard/`. They are candidates for relocation into `src/features/dashboard/ui/` in a future pass.

4. **`ui-button` and `ui-text-field` are genuinely cross-feature.** They are used by `src/features/ask/`, `src/features/dashboard/`, and `src/app/shell/`. They are candidates for `src/shared/ui/` in a dedicated component-reorganisation issue.

5. **Chunk size warnings (pre-existing):** Build warns about chunks larger than 500 kB. Not introduced by this issue.

6. **4 skipped Storybook tests (pre-existing):** Present before this issue; not caused by any path change here.

## Current date and working directory

- Date: 2026-05-14
- Working directory: `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask`
