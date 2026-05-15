## Review

- Correct: Feature directory layout is correct. `src/features/question/` has the expected shallow structure: `model/` (question-config.ts, question-yaml.ts, question-yaml.spec.ts), `data/` (question-registry.ts, question-registry.spec.ts, questions/sales-by-region.yaml, questions/top-products.yaml), and `ui/` with three subfolders (question-editor/, question-editor-panel/, question-list/), plus a top-level `index.ts` public surface. No extra nesting introduced.
- Correct: `question-parser.ts` ownership decision is correct. `src/question-parser.ts:1-14` imports only ask-infrastructure siblings (`DateRangeParser`, `IntentCueDetector`, `TermMatcher`, `ValueFilterResolver`) and is consumed exclusively by `src/ask-data.ts`. It is not owned by the question feature; leaving it at the top level with its spec is the right call.
- Correct: All three top-level compat barrels are present and point to canonical feature locations: `src/question-config.ts:1` re-exports from `./features/question/model/question-config`, `src/question-registry.ts:1` from `./features/question/data/question-registry`, and `src/question-yaml.ts:1` from `./features/question/model/question-yaml`.
- Correct: All three component-folder compat barrels are present: `src/components/question-editor/index.ts:1`, `src/components/question-editor-panel/index.ts:1`, and `src/components/question-list/index.ts:1` each re-export from their respective `../../features/question/ui/…` location. The `src/components/question-picker/index.ts:1` compat barrel was untouched (correctly, because question-picker is dashboard-feature infrastructure, not question-feature).
- Correct: `persisted_questions_v1` localStorage key is preserved unchanged at `src/features/question/data/question-registry.ts:9`. The spec at `src/features/question/data/question-registry.spec.ts:112` asserts the literal key and passes.
- Correct: YAML seed loading paths are correct. `src/features/question/data/question-registry.ts:4-5` imports the seed YAMLs with `?raw` from `./questions/sales-by-region.yaml` and `./questions/top-products.yaml`, which now live at `src/features/question/data/questions/`. Both files are present and correctly colocated.
- Correct: No runtime `@` alias imports were introduced. A grep for `from '@/'` across `src/features/question/` returned no results.
- Correct: `vitest.config.ts` is updated correctly. Coverage includes `src/features/question/**/*.ts` at line 24. The `unit` project excludes `src/features/question/ui/**/*.spec.ts` at line 44. The `components` project includes `src/features/question/ui/**/*.spec.ts` at line 55. This mirrors the dashboard pattern established in Issue 03.
- Correct: `src/app/shell/app-shell.ts:1-2` imports `question-editor` and `question-list` directly from the new feature boundary (`../../features/question/ui/question-editor` and `../../features/question/ui/question-list`), not from the old component paths. This is correct boundary discipline.
- Correct: The moved `question-editor.stories.ts` is colocated under `src/features/question/ui/question-editor/`. The old component path had no stories for `question-editor-panel` or `question-list`, so the absence of stories files for those two is faithful to the prior state rather than a regression.
- Correct: Specs are colocated beside their code: `question-yaml.spec.ts` lives next to `question-yaml.ts` in `model/`, and `question-registry.spec.ts` lives next to `question-registry.ts` in `data/`. There are no UI specs (there were none before the move).
- Correct: `src/features/dashboard/ui/question-picker/question-picker.ts:5` now imports `questionList` from `../../../question/data/question-registry` instead of the old top-level barrel. Cross-feature import is a direct feature-to-feature path, which is acceptable given there is no public-surface indirection imposed between dashboard and question features yet.
- Note: `question-list.ts` imports from `../../data/question-registry` across two separate import statements (lines 4 and 5: `deleteQuestion, questionList` then `addQuestion` separately). ESLint passed with no error, so this is below the configured rule threshold, but it is a minor style inconsistency that could be unified into a single import statement in a future cleanup pass.
- Note: `src/features/question/ui/question-editor-panel/question-editor-panel.ts:1` imports `../../../../components/widget`, which is a cross-boundary import from the UI layer into the legacy components path. This pre-existed before the move and was not introduced by Issue 04. It remains a latent coupling worth resolving when the widget component itself is migrated to a feature boundary.
- Note: Coverage config continues to grow piecemeal. `vitest.config.ts:21-25` now covers `src/components/**/*.ts`, `src/features/dashboard/**/*.ts`, and `src/features/question/**/*.ts` as three separate globs rather than a unified `src/**/*.ts`. This is intentional (spec files in `src/` root should not all be included in component coverage), but it requires that each new feature folder be manually added to the coverage include list. This is a minor drift risk for future issues.
- Note: `src/question-parser.ts` still has no feature home. The worker output correctly flags this as a candidate for a future `src/features/ask/` boundary. No action needed for Issue 04.
- Note: Old component folders (`src/components/question-editor/`, `src/components/question-editor-panel/`, `src/components/question-list/`) retain only their `index.ts` re-export stubs. The `src/dashboard-config.spec.ts` and `src/dashboard-registry.spec.ts` deletions visible in git status are pre-existing unstaged changes from prior issues and are unrelated to Issue 04.

## Commands run

| Command                    | Result                                           |
| -------------------------- | ------------------------------------------------ |
| `npm run typecheck`        | PASS                                             |
| `npm run lint`             | PASS                                             |
| `npm run format:check`     | PASS — all matched files use Prettier code style |
| `npm run test:unit`        | PASS — 28 files, 565 tests                       |
| `npm run test:components`  | PASS — 5 files, 43 tests                         |
| `npm run test:storybook`   | PASS — 14 passed, 4 skipped, 72 tests            |
| `npm run test:integration` | PASS — 18 scenarios, 74 steps                    |
| `npm run test:e2e`         | PASS — 8 scenarios, 47 steps                     |

## Blockers

None. All validation commands pass clean.
