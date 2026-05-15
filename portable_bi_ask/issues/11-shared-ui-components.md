# Issue 11: Move shared UI components into src/shared/ui/

## Objective

Relocate `ui-button` and `ui-text-field` from `src/components/` into `src/shared/ui/` to
properly reflect that they are genuinely cross-feature primitives used across the app shell,
dashboard, and ask boundaries.

## Why

After the Issues 01–08 refactor, `src/components/` still holds two UI primitives that are
imported by multiple independent feature boundaries. Leaving them under `src/components/`
implies a component-folder ownership that no longer matches the bounded-context structure.
`ui-button` has 7 importers spanning `app/`, `features/dashboard/`, and `features/ask/`.
`ui-text-field` has 2 importers in `features/dashboard/` and `features/ask/`.

## Current state

```text
src/components/
  ui-button/
    ui-button.ts
    ui-button.stories.ts   (if present)
    index.ts
  ui-text-field/
    ui-text-field.ts
    ui-text-field.stories.ts   (if present)
    index.ts
```

Importers of `ui-button` (all side-effect imports — `import '...'`):

- `src/app/shell/app-shell.ts:4`
- `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts:4`
- `src/features/dashboard/ui/dashboard-list/dashboard-list.ts:1`
- `src/features/dashboard/ui/widget-editor/widget-editor.ts:2`
- `src/features/ask/ui/ask-clarification/ask-clarification.ts:1`
- `src/features/ask/ui/ask-input/ask-input.ts:1`
- `src/features/ask/ui/ask-result/ask-result.ts:1`

Importers of `ui-text-field` (all side-effect imports):

- `src/features/dashboard/ui/dashboard-list/dashboard-list.ts:2`
- `src/features/ask/ui/ask-input/ask-input.ts:2`

## Target state

```text
src/shared/
  ui/
    ui-button/
      ui-button.ts
      ui-button.stories.ts
      index.ts
    ui-text-field/
      ui-text-field.ts
      ui-text-field.stories.ts
      index.ts
```

All 9 importers are updated to the new paths. No compat shim needed (all importers are
already inside the project source and can be updated directly).

## Step-by-step tasks

1. Create `src/shared/ui/` directory.
2. Move `src/components/ui-button/` → `src/shared/ui/ui-button/` (all files including
   stories and `index.ts`).
3. Move `src/components/ui-text-field/` → `src/shared/ui/ui-text-field/` (all files).
4. Update all `ui-button` importers to the new path:
   - `src/app/shell/app-shell.ts` — `'../../components/ui-button'` → `'../../shared/ui/ui-button'`
   - `src/features/dashboard/ui/dashboard-workspace/dashboard-workspace.ts`
     — `'../../../../components/ui-button'` → `'../../../../shared/ui/ui-button'`
   - `src/features/dashboard/ui/dashboard-list/dashboard-list.ts`
     — `'../../../../components/ui-button'` → `'../../../../shared/ui/ui-button'`
   - `src/features/dashboard/ui/widget-editor/widget-editor.ts`
     — `'../../../../components/ui-button'` → `'../../../../shared/ui/ui-button'`
   - `src/features/ask/ui/ask-clarification/ask-clarification.ts`
     — `'../../../../components/ui-button'` → `'../../../../shared/ui/ui-button'`
   - `src/features/ask/ui/ask-input/ask-input.ts`
     — `'../../../../components/ui-button'` → `'../../../../shared/ui/ui-button'`
   - `src/features/ask/ui/ask-result/ask-result.ts`
     — `'../../../../components/ui-button'` → `'../../../../shared/ui/ui-button'`
5. Update all `ui-text-field` importers:
   - `src/features/dashboard/ui/dashboard-list/dashboard-list.ts`
     — `'../../../../components/ui-text-field'` → `'../../../../shared/ui/ui-text-field'`
   - `src/features/ask/ui/ask-input/ask-input.ts`
     — `'../../../../components/ui-text-field'` → `'../../../../shared/ui/ui-text-field'`
6. Remove the now-empty `src/components/ui-button/` and `src/components/ui-text-field/`
   directories.
7. Confirm no stale imports remain:
   ```sh
   grep -rn "components/ui-button\|components/ui-text-field" src/ --include="*.ts"
   ```
   Expected: zero results.
8. Update `vitest.config.ts` coverage `include` — `src/shared/**/*.ts` already covers the
   new location; no change needed unless the glob was narrowed.
9. Confirm Storybook still discovers moved stories (Storybook glob is `../src/**/*.stories.*`
   which still matches `src/shared/ui/**/*.stories.*`).

## Acceptance criteria

- `src/components/ui-button/` and `src/components/ui-text-field/` no longer exist.
- Both components live under `src/shared/ui/`.
- All 9 importers reference the new paths.
- Stories are still discovered by Storybook.
- `npm run typecheck`, `npm run lint`, `npm run test:storybook` all pass.

## Validation

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:components
npm run test:storybook
npm run build
npm run build-storybook
```

## Notes / risks

- All imports are side-effect imports (`import '...'`) so no named-export rewriting is
  needed — only the path string changes.
- Storybook shim aliases in `.storybook/main.ts` do not reference these components; no
  config change is needed there.
- After this move `src/components/` may have only a few remaining folders (`spinner`,
  `skeleton-loader`, and any others not yet relocated). That cleanup is out of scope here.
- Depends on: Issues 01–08 completed (already done). No dependency on Issues 09 or 10.
