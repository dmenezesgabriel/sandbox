Implemented Issue 09 by moving `src/app-config.ts` into `src/app/app-config.ts`, updating its internal import path, updating the single importer, and expanding `vitest.config.ts` coverage to include `src/app/**/*.ts`.

## What changed

### File moved

| Old path            | New path                |
| ------------------- | ----------------------- |
| `src/app-config.ts` | `src/app/app-config.ts` |

### Content change in moved file

The moved file's own internal import needed a depth correction:

| File                    | Old import               | New import                |
| ----------------------- | ------------------------ | ------------------------- |
| `src/app/app-config.ts` | `'./shared/types/index'` | `'../shared/types/index'` |

### Importer updated

| File                                                 | Old import              | New import                  |
| ---------------------------------------------------- | ----------------------- | --------------------------- |
| `src/features/dashboard/model/dashboard-config.ts:1` | `'../../../app-config'` | `'../../../app/app-config'` |

### `vitest.config.ts` coverage include extended

Added `'src/app/**/*.ts'` as the first entry in the `coverage.include` array so that `src/app/app-config.ts` (and any future files added to `src/app/`) are included in coverage reports.

## Grep validation

```
grep -rn "from '.*app-config'" src/ --include="*.ts"
# → 1 line:
#   src/features/dashboard/model/dashboard-config.ts:1:import { createDefaultDashboardSeed } from '../../../app/app-config';
```

Exactly one result, pointing at the new canonical path.

## Validation results

All commands run from `/home/gabriel-menezes/Documents/repos/sandbox/portable_bi_ask` on 2026-05-14.

| Command                | Result                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | PASS — no errors                                                                                                                      |
| `npm run lint`         | PASS — no errors                                                                                                                      |
| `npm run format:check` | FAIL — 2 pre-existing unformatted issue spec files (`issues/11-shared-ui-components.md`, `issues/index.md`); unrelated to this change |
| `npm run test:unit`    | PASS — 28 test files, 565 tests                                                                                                       |
| `npm run build`        | PASS — 2111 modules transformed, built in 4.34s                                                                                       |

## Risks

- None. This was the lowest-risk move in the post-refactor cleanup set: single importer, no spec to relocate, no compat shim needed.
- The one non-trivial detail was that the file's own internal import (`./shared/types/index` at the old depth) needed to be updated to `../shared/types/index` at the new depth. TypeScript caught this immediately.
- `format:check` failure is pre-existing and confined to untracked/modified issue markdown files outside the scope of this issue.
