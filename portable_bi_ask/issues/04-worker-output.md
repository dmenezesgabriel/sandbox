Implemented issue 04 by moving all question-owned model, data, UI, specs, stories, and seed YAML under `src/features/question` with shallow `model/`, `data/`, and `ui/` folders.

## What was implemented

- Audited `question-parser.ts` ownership: it imports `DateRangeParser`, `IntentCueDetector`, `TermMatcher`, `ValueFilterResolver` and is consumed by `ask-data.ts`. Ownership confirmed as ask-feature infrastructure, not question-feature. Left at `src/question-parser.ts` with its spec at `src/question-parser.spec.ts`.
- Created `src/features/question/` with the following layout:
  - `model/question-config.ts`, `model/question-yaml.ts`, `model/question-yaml.spec.ts`
  - `data/question-registry.ts`, `data/question-registry.spec.ts`, `data/questions/sales-by-region.yaml`, `data/questions/top-products.yaml`
  - `ui/question-list/question-list.ts`, `ui/question-list/index.ts`
  - `ui/question-editor/question-editor.ts`, `ui/question-editor/question-editor-header.ts`, `ui/question-editor/question-editor.stories.ts`, `ui/question-editor/index.ts`
  - `ui/question-editor-panel/question-editor-panel.ts`, `ui/question-editor-panel/index.ts`
  - `index.ts` as public surface
- Removed old implementation files from `src/components/question-editor/` (kept `index.ts` re-export only), `src/components/question-editor-panel/` (kept `index.ts`), `src/components/question-list/` (kept `index.ts`).
- Removed old YAML seeds from `src/questions/` (directory now deleted).
- Removed old spec files `src/question-registry.spec.ts` and `src/question-yaml.spec.ts` (canonical copies now in features/question).
- Replaced `src/question-config.ts`, `src/question-registry.ts`, `src/question-yaml.ts` with transitional re-export barrels pointing to `./features/question/…`.
- Updated `src/components/question-editor/index.ts`, `src/components/question-editor-panel/index.ts`, `src/components/question-list/index.ts` to re-export from `../../features/question/ui/…`.
- Updated `src/app/shell/app-shell.ts` to import directly from `../../features/question/ui/question-editor` and `../../features/question/ui/question-list`.
- Updated `src/features/dashboard/ui/question-picker/question-picker.ts` to import from `../../../question/data/question-registry` instead of the old top-level barrel.
- Updated `vitest.config.ts` coverage includes, unit excludes, and components includes to cover `src/features/question/**/*.ts`.

## Changed files

### Added (feature boundary)

- `src/features/question/index.ts`
- `src/features/question/model/question-config.ts`
- `src/features/question/model/question-yaml.ts`
- `src/features/question/model/question-yaml.spec.ts`
- `src/features/question/data/question-registry.ts`
- `src/features/question/data/question-registry.spec.ts`
- `src/features/question/data/questions/sales-by-region.yaml`
- `src/features/question/data/questions/top-products.yaml`
- `src/features/question/ui/question-list/question-list.ts`
- `src/features/question/ui/question-list/index.ts`
- `src/features/question/ui/question-editor/question-editor.ts`
- `src/features/question/ui/question-editor/question-editor-header.ts`
- `src/features/question/ui/question-editor/question-editor.stories.ts`
- `src/features/question/ui/question-editor/index.ts`
- `src/features/question/ui/question-editor-panel/question-editor-panel.ts`
- `src/features/question/ui/question-editor-panel/index.ts`

### Modified (transitional re-exports)

- `src/question-config.ts` — now re-exports from `./features/question/model/question-config`
- `src/question-registry.ts` — now re-exports from `./features/question/data/question-registry`
- `src/question-yaml.ts` — now re-exports from `./features/question/model/question-yaml`
- `src/components/question-editor/index.ts` — re-exports from `../../features/question/ui/question-editor`
- `src/components/question-editor-panel/index.ts` — re-exports from `../../features/question/ui/question-editor-panel`
- `src/components/question-list/index.ts` — re-exports from `../../features/question/ui/question-list`
- `src/app/shell/app-shell.ts` — imports from new feature paths
- `src/features/dashboard/ui/question-picker/question-picker.ts` — imports from `../../../question/data/question-registry`
- `vitest.config.ts` — coverage and project includes updated

### Removed (old implementations, old seeds, old specs)

- `src/components/question-editor/question-editor.ts`
- `src/components/question-editor/question-editor-header.ts`
- `src/components/question-editor/question-editor.stories.ts`
- `src/components/question-editor-panel/question-editor-panel.ts`
- `src/components/question-list/question-list.ts`
- `src/questions/sales-by-region.yaml`
- `src/questions/top-products.yaml`
- `src/question-registry.spec.ts`
- `src/question-yaml.spec.ts`

## Validation results

| Command                                                                              | Result                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `npm run typecheck`                                                                  | PASS                                             |
| `npm run lint`                                                                       | PASS                                             |
| `npm run format:check`                                                               | PASS                                             |
| `npm run test:unit`                                                                  | PASS — 28 files, 565 tests                       |
| `npm run test:components`                                                            | PASS — 5 files, 43 tests                         |
| `npm run test:storybook`                                                             | PASS — 14 passed, 4 skipped (expected), 72 tests |
| `npm run build`                                                                      | PASS — 2113 modules transformed                  |
| `npx vitest run --project unit src/features/question/data/question-registry.spec.ts` | PASS — 12 tests                                  |
| `npx vitest run --project unit src/features/question/model/question-yaml.spec.ts`    | PASS — 6 tests                                   |
| `npx vitest run --project unit src/question-parser.spec.ts`                          | PASS — 4 tests                                   |

## Behavior and preservation notes

- `persisted_questions_v1` storage key preserved unchanged in `src/features/question/data/question-registry.ts`.
- YAML seed loading still works from the moved `data/questions/` asset path.
- Direct registry writes from UI components (editor, list) preserved without any architecture changes.
- `question-parser.ts` confirmed as ask-feature, stays at `src/question-parser.ts`; `src/question-parser.spec.ts` also stays.

## Follow-up risks and open questions

- `src/question-parser.ts` still lives at the top level with no feature home. It likely belongs in a future `src/features/ask/` boundary (Issue 05 or later).
- Old component folders (`src/components/question-editor/`, `src/components/question-editor-panel/`, `src/components/question-list/`) still exist with only transitional `index.ts` re-exports; cleanup deferred to Issue 08.
- Old barrel files (`src/question-config.ts`, `src/question-registry.ts`, `src/question-yaml.ts`) still exist as re-exports; cleanup also deferred to Issue 08.

## Metadata

- Date: 2026-05-14
- Working directory: /home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask
