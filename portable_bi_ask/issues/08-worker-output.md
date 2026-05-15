Implemented Issue 08 by removing all compatibility shims, rewriting every importer to use canonical paths, deleting orphaned directories, and updating `references/frontend-target-structure.md` with the final actual tree.

## What was removed (shim by shim)

### Shared utils/icons shims (category a)

| Shim deleted   | Canonical path           | Importers rewritten |
| -------------- | ------------------------ | ------------------- |
| `src/icons.ts` | `src/shared/utils/icons` | 4 files             |
| `src/utils.ts` | `src/shared/utils/utils` | 22 files            |

### Infra shims (category b)

| Shim deleted                 | Canonical path                               | Importers rewritten          |
| ---------------------------- | -------------------------------------------- | ---------------------------- |
| `src/db.ts`                  | `src/infra/db/db`                            | 0 (already using final path) |
| `src/data-source-manager.ts` | `src/infra/data-sources/data-source-manager` | 0 (already using final path) |
| `src/query-port.ts`          | `src/infra/query/query-port`                 | 0 (already using final path) |

### Ask model shims (category c)

All 22 top-level ask-model shims had zero importers from outside `src/features/`. Deleted without any import rewrites.

Files deleted:
`src/ask-data.ts`, `src/ask-orchestrator.ts`, `src/catalog-builder.ts`, `src/create-dashboard-orchestrator.ts`, `src/date-question-text.ts`, `src/date-range-parser.ts`, `src/diagnostic-runner.ts`, `src/field-search.ts`, `src/intent-cue-detector.ts`, `src/intent-describer.ts`, `src/month-catalog.ts`, `src/narrative-generator.ts`, `src/question-parser.ts`, `src/result-analysis.ts`, `src/result-analyzer.ts`, `src/semantic-field-matcher.ts`, `src/semantic-modeling.ts`, `src/sql-planner.ts`, `src/sql-renderer.ts`, `src/term-matcher.ts`, `src/value-filter-resolver.ts`, `src/vocabulary.ts`

### Question and dashboard shims (category d)

All 6 shims had zero importers from outside their feature. Deleted without any import rewrites.

Files deleted:
`src/question-config.ts`, `src/question-registry.ts`, `src/question-yaml.ts`, `src/dashboard-config.ts`, `src/dashboard-registry.ts`, `src/dashboard-yaml.ts`

### Component folder shims (category e)

All 15 shim-only folders deleted. Two side-effect importers existed that pointed at shim paths and were rewritten:

| File                                                                      | Old import                                              | New import                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `src/features/dashboard/ui/widget-editor/widget-editor.ts`                | `import '../../../../components/question-editor-panel'` | `import '../../../question/ui/question-editor-panel'` |
| `src/features/question/ui/question-editor-panel/question-editor-panel.ts` | `import '../../../../components/widget'`                | `import '../../../dashboard/ui/widget'`               |

Folders deleted: `src/components/dashboard-canvas/`, `src/components/dashboard-editor-header/`, `src/components/dashboard-editor/`, `src/components/dashboard-list/`, `src/components/dashboard-workspace/`, `src/components/dashboard/`, `src/components/question-picker/`, `src/components/widget-editor/`, `src/components/widget/`, `src/components/question-editor/`, `src/components/question-editor-panel/`, `src/components/question-list/`, `src/components/ask-clarification/`, `src/components/ask-input/`, `src/components/ask-result/`

### `src/types.ts` shim (category f — last)

64 files across `src/features/`, `src/infra/`, and `src/` root still imported via the compat shim. All rewritten to `…/shared/types/index`.

One file had inline import expressions that required separate treatment:

- `src/features/ask/model/ask-data.ts` — two `import(…)` expressions at lines 75–77 changed from `import('../../../types')` to `import('../../../shared/types/index')`

### CSS shim

| Shim deleted     | What replaced it                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/styles.css` | Already updated in Issue 07; `src/app/main.ts` and `.storybook/preview.ts` both import `shared/styles/styles.css` directly |

## What imports were rewritten (by category)

### icons — 4 files

| File                                                                 | Old path            | New path                         |
| -------------------------------------------------------------------- | ------------------- | -------------------------------- |
| `src/features/ask/ui/ask-input/ask-input.ts`                         | `../../../../icons` | `../../../../shared/utils/icons` |
| `src/features/dashboard/ui/dashboard-list/dashboard-list.ts`         | `../../../../icons` | `../../../../shared/utils/icons` |
| `src/components/top-nav/top-nav.ts`                                  | `../../icons`       | `../../shared/utils/icons`       |
| `src/features/question/ui/question-editor/question-editor-header.ts` | `../../../../icons` | `../../../../shared/utils/icons` |

### utils — 22 files

Pattern applied by depth:

- `src/features/ask/model/` files: `'../../../utils'` → `'../../../shared/utils/utils'` (18 files)
- `src/features/ask/ui/ask-result/` files: `'../../../../utils'` → `'../../../../shared/utils/utils'` (2 files)
- `src/features/dashboard/ui/*/` files: `'../../../../utils'` → `'../../../../shared/utils/utils'` (1 file)
- `src/features/dashboard/ui/dashboard-workspace/`: `'../../../../utils'` → `'../../../../shared/utils/utils'`
- `src/infra/data-sources/data-source-manager.ts`: `'../../utils'` → `'../../shared/utils/utils'`

### types — 64 files

All imports of the form `from '…/types'` (at various relative depths) were rewritten to `from '…/shared/types/index'`.

By depth group:

- `src/features/ask/model/` (depth 3): 29 files — `'../../../types'` → `'../../../shared/types/index'`
- `src/features/ask/orchestration/` (depth 3): 3 files — `'../../../types'` → `'../../../shared/types/index'`
- `src/features/ask/ui/*/` (depth 4): 6 files — `'../../../../types'` → `'../../../../shared/types/index'`
- `src/features/dashboard/model/` (depth 3): 3 files — `'../../../types'` → `'../../../shared/types/index'`
- `src/features/dashboard/data/` (depth 3): 2 files — `'../../../types'` → `'../../../shared/types/index'`
- `src/features/dashboard/ui/*/` (depth 4): 13 files — `'../../../../types'` → `'../../../../shared/types/index'`
- `src/features/question/model/` (depth 3): 2 files — `'../../../types'` → `'../../../shared/types/index'`
- `src/features/question/data/` (depth 3): 2 files — `'../../../types'` → `'../../../shared/types/index'`
- `src/features/question/ui/*/` (depth 4): 3 files — `'../../../../types'` → `'../../../../shared/types/index'`
- `src/infra/data-sources/` (depth 2): 2 files — `'../../types'` → `'../../shared/types/index'`
- `src/app-config.ts` (depth 0): `'./types'` → `'./shared/types/index'`
- `src/grid-layout-engine.ts` (depth 0): `'./types'` → `'./shared/types/index'`

## Directories removed entirely

- `src/styles/` — 11 CSS files (superseded by `src/shared/styles/`)
- `src/components/dashboard-canvas/`
- `src/components/dashboard-editor-header/`
- `src/components/dashboard-editor/`
- `src/components/dashboard-list/`
- `src/components/dashboard-workspace/`
- `src/components/dashboard/`
- `src/components/question-picker/`
- `src/components/widget-editor/`
- `src/components/widget/`
- `src/components/question-editor/`
- `src/components/question-editor-panel/`
- `src/components/question-list/`
- `src/components/ask-clarification/`
- `src/components/ask-input/`
- `src/components/ask-result/`

## Final directory tree snapshot

Generated 2026-05-14 (157 TypeScript + CSS files total):

```
src/
  app-config.ts
  env.d.ts
  grid-layout-engine.spec.ts
  grid-layout-engine.ts
  main.ts
  app/
    main.ts
    routing/hash-routes.ts
    shell/app-shell.ts
  components/
    design-system.stories.ts
    skeleton-loader/ (index.ts, skeleton-loader.stories.ts, skeleton-loader.ts)
    spinner/ (index.ts, spinner.stories.ts, spinner.ts)
    top-nav/ (index.ts, top-nav.stories.ts, top-nav.ts)
    ui-button/ (index.ts, ui-button.stories.ts, ui-button.ts)
    ui-text-field/ (index.ts, ui-text-field.stories.ts, ui-text-field.ts)
  features/
    ask/
      index.ts
      model/
        ask-data.ts, catalog-builder.spec.ts, catalog-builder.ts,
        date-question-text.spec.ts, date-question-text.ts,
        date-range-parser.spec.ts, date-range-parser.ts,
        diagnostic-runner.spec.ts, diagnostic-runner.ts,
        field-search.spec.ts, field-search.ts,
        intent-cue-detector.spec.ts, intent-cue-detector.ts,
        intent-describer.spec.ts, intent-describer.ts,
        month-catalog.spec.ts, month-catalog.ts,
        narrative-generator.spec.ts, narrative-generator.ts,
        question-parser.spec.ts, question-parser.ts,
        result-analysis.spec.ts, result-analysis.ts,
        result-analyzer.spec.ts, result-analyzer.ts,
        semantic-field-matcher.spec.ts, semantic-field-matcher.ts,
        semantic-modeling.spec.ts, semantic-modeling.ts,
        sql-planner.spec.ts, sql-planner.ts,
        sql-renderer.spec.ts, sql-renderer.ts,
        term-matcher.spec.ts, term-matcher.ts,
        value-filter-resolver.spec.ts, value-filter-resolver.ts,
        vocabulary.spec.ts, vocabulary.ts
      orchestration/
        ask-orchestrator.spec.ts, ask-orchestrator.ts,
        create-dashboard-orchestrator.ts
      ui/
        ask-clarification/ (ask-clarification.stories.ts, ask-clarification.ts, index.ts)
        ask-input/ (ask-input.stories.ts, ask-input.ts, index.ts)
        ask-result/ (ask-result-model.spec.ts, ask-result-model.ts,
                     ask-result.stories.ts, ask-result.ts, index.ts)
    dashboard/
      index.ts
      data/
        dashboard-registry.spec.ts, dashboard-registry.ts
      model/
        dashboard-config.spec.ts, dashboard-config.ts, dashboard-yaml.ts
      ui/
        dashboard/ (dashboard.spec.ts, dashboard.stories.ts, dashboard.ts, index.ts)
        dashboard-canvas/ (dashboard-canvas.stories.ts, dashboard-canvas.ts, index.ts)
        dashboard-editor/ (dashboard-editor.stories.ts, dashboard-editor.ts, index.ts)
        dashboard-editor-header/ (dashboard-editor-header.spec.ts,
                                   dashboard-editor-header.stories.ts,
                                   dashboard-editor-header.ts, index.ts)
        dashboard-list/ (dashboard-list.stories.ts, dashboard-list.ts, index.ts)
        dashboard-workspace/ (dashboard-workspace-model.spec.ts,
                               dashboard-workspace-model.ts,
                               dashboard-workspace.stories.ts,
                               dashboard-workspace.ts, index.ts)
        question-picker/ (index.ts, question-picker.ts)
        widget/ (index.ts, widget-model.spec.ts, widget-model.ts,
                 widget.stories.ts, widget.ts)
        widget-editor/ (index.ts, widget-editor.stories.ts, widget-editor.ts)
    question/
      index.ts
      data/
        question-registry.spec.ts, question-registry.ts
      model/
        question-config.ts, question-yaml.spec.ts, question-yaml.ts
      ui/
        question-editor/ (index.ts, question-editor-header.ts,
                          question-editor.stories.ts, question-editor.ts)
        question-editor-panel/ (index.ts, question-editor-panel.ts)
        question-list/ (index.ts, question-list.ts)
  infra/
    data-sources/
      data-source-manager.spec.ts, data-source-manager.ts
    db/
      db.spec.ts, db.ts
    query/
      query-port.ts
    shims/
      chrono-node/en.ts, chrono-node/pt.ts
  shared/
    styles/
      animations.css, ask.css, base.css, controls.css, dashboard.css,
      feedback.css, layout.css, navigation.css, questions.css,
      reset.css, styles.css, tokens.css
    types/
      ask.ts, dashboard.ts, data-source.ts, index.ts, question.ts
    utils/
      icons.ts, utils.spec.ts, utils.ts
```

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
| `npm run build`           | PASS — 2111 modules transformed, built in 3.54s  |
| `npm run build-storybook` | PASS — Storybook build completed successfully    |

### Grep validation — all clean

```
grep -rn "from '\.\./types'" src/ --include="*.ts" | grep -v "shared/types"
# → 0 lines

grep -rn "from '\.\/types'" src/ --include="*.ts" | grep -v "shared/types"
# → 0 lines

grep -rn "from '.*\/db'" src/ --include="*.ts" | grep -v "infra/db"
# → 0 lines

grep -rn "from '.*\/query-port'" src/ --include="*.ts" | grep -v "infra/query"
# → 3 lines (all infra internal: `'../query/query-port'` — correct canonical path)

grep -rn "from '.*\/utils'" src/ --include="*.ts" | grep -v "shared/utils"
# → 0 lines

grep -rn "from '.*\/icons'" src/ --include="*.ts" | grep -v "shared/utils/icons"
# → 0 lines
```

## Justified exceptions remaining

None. All shims have been removed and all importers updated to canonical paths.

### Notes on src/ root files

Four files remain at `src/` root that are not shims and were not moved in Issues 01–07:

- `src/app-config.ts` — imported by `src/features/dashboard/model/dashboard-config.ts`
- `src/grid-layout-engine.ts` — imported by 3 dashboard UI files
- `src/grid-layout-engine.spec.ts` — spec for grid-layout-engine
- `src/main.ts` — thin re-export of `src/app/main.ts`

These are future relocation candidates (app-config → `src/app/`, grid-layout-engine → `src/features/dashboard/model/`) but are out of scope for Issue 08, which is import cleanup only. They are documented in `references/frontend-target-structure.md`.

### Story/spec colocation confirmation

All stories and specs remain colocated under `src/**` beside their implementation files. The `.storybook/main.ts` glob `../src/**/*.stories.*` and vitest glob `src/**/*.spec.ts` continue to discover all tests.

## Current date and working directory

- Date: 2026-05-14
- Working directory: `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask`
