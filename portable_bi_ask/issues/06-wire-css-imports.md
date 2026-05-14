# 06 — Wire CSS imports and clean up orphaned styles

## Context

By the time issues 01–05 are complete, the new `dashboard-editor-header.css` file exists on disk but is not yet imported anywhere. This issue finalises the CSS wiring and removes any leftover class selectors that no longer have matching elements.

This is deliberately the last CSS step so that prior issues can be validated without any style pollution — the new header renders unstyled until this issue is done, which makes visual regressions from each step easier to isolate.

> **Dependency**: all of issues 01–05 must be complete before this one.

---

## 1 · Add import to `src/styles.css`

Open `src/styles.css`. The current component import block ends with `dashboard-list.css`:

```css
/* 06. Components */
@import url('./styles/topnav.css');
@import url('./styles/kpi.css');
@import url('./styles/charts.css');
@import url('./styles/tables.css');
@import url('./styles/ask.css');
@import url('./styles/sheets.css');
@import url('./styles/widgets.css');
@import url('./styles/modals.css');
@import url('./styles/loading.css');
@import url('./styles/dashboard-list.css');
```

Add the new import **immediately after `topnav.css`** (the header is structurally adjacent to the nav):

```css
/* 06. Components */
@import url('./styles/topnav.css');
@import url('./styles/dashboard-editor-header.css'); /* ← add */
@import url('./styles/kpi.css');
@import url('./styles/charts.css');
@import url('./styles/tables.css');
@import url('./styles/ask.css');
@import url('./styles/sheets.css');
@import url('./styles/widgets.css');
@import url('./styles/modals.css');
@import url('./styles/loading.css');
@import url('./styles/dashboard-list.css');
```

---

## 2 · Verify orphaned CSS is removed

Cross-check that all classes deleted from component templates in issues 02 and 05 have also been removed from their CSS files. Run the following checks:

### `.topnav-tabs`, `.topnav-tab`, `.topnav-tab-active`, `.topnav-tab-text`

These should have been removed from `src/styles/topnav.css` in issue 05.

```sh
grep -n "topnav-tab" src/styles/topnav.css
```

Expected: **no output**.

### `.sheets-toolbar` (not `.sheets-toolbar-bar`)

Should have been removed from `src/styles/sheets.css` in issue 02.

```sh
grep -n "sheets-toolbar" src/styles/sheets.css
```

Expected: only `.sheets-toolbar-bar` matches (used by `sheets-view` for export/import row). No bare `.sheets-toolbar` selector.

### `.sheet-icon`

Should have been removed from `src/styles/sheets.css` in issue 02.

```sh
grep -n "sheet-icon" src/styles/sheets.css
```

Expected: **no output**.

### `.btn-edit-mode`

If this class was defined in `sheets.css` (the old edit toggle button style), it should be gone.

```sh
grep -rn "btn-edit-mode" src/styles/
```

Expected: **no output**.

---

## 3 · Verify new CSS tokens are resolvable

The `dashboard-editor-header.css` file uses design tokens defined in `src/styles/tokens.css`. Verify the following variables are defined there (they should already exist since they're used by other components):

| Token                                              | Used for                                                    |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `--color-bg`                                       | Header background                                           |
| `--color-border`                                   | Header bottom border, mode group border, edit button border |
| `--color-text`                                     | Title and edit button text                                  |
| `--color-text-muted`                               | Subtitle text                                               |
| `--color-text-secondary`                           | Inactive mode button text                                   |
| `--color-surface`                                  | Mode button and edit button background                      |
| `--color-surface-hover`                            | Mode button hover background                                |
| `--color-accent`                                   | Active mode button background, edit button active border    |
| `--color-text-on-accent`                           | Text on accent-colored buttons                              |
| `--font-display`                                   | Title font                                                  |
| `--font-body`                                      | Button and subtitle font                                    |
| `--text-xl`, `--text-lg`, `--text-sm`, `--text-xs` | Font sizes                                                  |
| `--space-md`, `--space-sm`, `--space-lg`           | Spacing                                                     |
| `--radius-md`                                      | Border radius                                               |
| `--page-padding`                                   | Horizontal padding to match canvas                          |
| `--transition-fast`                                | Hover transitions                                           |

Run a quick check:

```sh
grep -c "^--" src/styles/tokens.css
# Should print a number > 30; scan output manually for any missing tokens above
```

If `--page-padding` is not defined in `tokens.css`, check where it is defined (may be in `layout.css` or `base.css`). If absent, add a fallback or define it:

```css
/* in tokens.css if missing: */
--page-padding: var(--space-xl);
```

---

## 4 · Visual smoke test

Start the dev server and verify the following visually:

```sh
npm run dev
```

### List page (`#/`)

- [ ] TopNav shows: brand mark + wordmark + optional subtitle
- [ ] No back arrow
- [ ] No mode tabs anywhere on the page

### Dashboard editor page (`#/dashboard/portable-bi-dashboard`)

- [ ] TopNav shows: brand mark + back arrow + wordmark
- [ ] No tabs in the top nav
- [ ] Below the nav: `dashboard-editor-header` bar with title on the left, "Editor | Ask Data" buttons and "Edit" button on the right
- [ ] "Editor" button appears highlighted (active state)
- [ ] Clicking "Ask Data" switches the panel to the ask interface
- [ ] Clicking "Editor" returns to the canvas
- [ ] Clicking "Edit" highlights the button, changes it to "Done Editing", and puts the canvas into edit mode (dashed border, grid overlay)
- [ ] Clicking "Done Editing" exits edit mode, widget selection is cleared
- [ ] Sheet tabs below the editor header show title only (no 📊 emoji)

### Responsive (640px or narrower)

- [ ] Header wraps correctly with title above controls
- [ ] Buttons remain tappable

---

## 5 · Storybook smoke test

```sh
npm run storybook
```

Verify these stories load without errors:

| Story path                                           | Expected state                                 |
| ---------------------------------------------------- | ---------------------------------------------- |
| Organisms/Top Nav → List Page (No Back Button)       | Brand only, no back button                     |
| Organisms/Top Nav → Inside a Dashboard               | Back arrow visible                             |
| Organisms/Dashboard Editor Header → Editor Mode      | "Editor" highlighted, Edit button normal       |
| Organisms/Dashboard Editor Header → Ask Data Mode    | "Ask Data" highlighted                         |
| Organisms/Dashboard Editor Header → Edit Mode Active | "Done Editing" in accent style                 |
| Organisms/Sheets Manager → Default                   | Title-only tabs, no edit button in the tab bar |
| Organisms/Sheets Manager → Edit Mode                 | Action buttons per tab                         |
| Templates/Dashboard Editor → Dashboard Tab           | Full composition visible                       |

---

## 6 · TypeScript and lint pass

```sh
npx tsc --noEmit
npx eslint src/ --ext .ts
npx stylelint "src/styles/**/*.css"
```

All three must pass with zero new errors.

---

## Checklist before marking done

- [ ] `@import url('./styles/dashboard-editor-header.css')` added to `src/styles.css` after topnav import
- [ ] `grep -n "topnav-tab" src/styles/topnav.css` → no output
- [ ] `grep -n "sheets-toolbar[^-]" src/styles/sheets.css` → no output (`.sheets-toolbar-bar` is fine)
- [ ] `grep -n "sheet-icon" src/styles/sheets.css` → no output
- [ ] `grep -rn "btn-edit-mode" src/styles/` → no output
- [ ] All design tokens used in `dashboard-editor-header.css` are defined in `tokens.css`
- [ ] Visual smoke test passes (list page + dashboard editor page)
- [ ] Responsive layout correct at 640px width
- [ ] Storybook smoke test: all listed stories load without errors
- [ ] `npx tsc --noEmit` passes
- [ ] `npx stylelint "src/styles/**/*.css"` passes
