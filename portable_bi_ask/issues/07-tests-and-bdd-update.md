# 07 — Update tests and BDD step definitions

## Context

The E2E test suite uses Playwright + Cucumber. Several step definitions and the world helper reference DOM selectors and element interactions that change as part of this restructure:

1. **`.btn-edit-mode`** — the CSS class of the old Edit/Done Editing button in `sheets-manager`. The button moves to `dashboard-editor-header` and its class is now `.editor-edit-btn`.
2. **`"I navigate to the Dashboard tab"`** — this step currently navigates to a dashboard hash URL directly. The phrase "Dashboard tab" is now a mode button inside the editor header, not a TopNav tab. The step itself still works (it navigates by hash, not by clicking a tab), but the wording should be updated for clarity.
3. **Storybook interaction stories** — all added in issues 01–05; no further changes needed here.
4. **Vitest specs** — the `sheets-view-model.spec.ts` and other model specs are pure-function tests and are unaffected.

> **Dependency**: issues 01–06 must be complete before running the full E2E suite.

---

## Files to update

```
tests/
  e2e/
    steps/
      world.ts      ← clickEditToggle selector
      steps.ts      ← step wording (optional but recommended)
    features/
      sheets.feature  ← scenario wording for "Edit" / "Done Editing" steps
```

---

## 1 · `tests/e2e/steps/world.ts` — fix `clickEditToggle` selector

### Current

```ts
async clickEditToggle(): Promise<void> {
  await this.page.click('.btn-edit-mode');
}
```

The `.btn-edit-mode` class belonged to the edit button in `sheets-manager`. After issue 02 that button is gone.

### Updated

```ts
async clickEditToggle(): Promise<void> {
  await this.page.click('.editor-edit-btn');
}
```

`.editor-edit-btn` is the class on the Edit / Done Editing button in `dashboard-editor-header` (defined in issue 01).

### No other world methods need changing

`clickSheetTab(name)` uses `.sheet-tab` (still present) and `hasText: name` — this works because the tab still renders the sheet name in `.sheet-name`. The `.sheet-icon` emoji removal (issue 02) does not break the text lookup.

---

## 2 · `tests/e2e/features/sheets.feature` — update wording

The scenarios reference "the Dashboard tab" as a navigation concept and "Edit" / "Done Editing" as button labels. The labels are unchanged, but the step that navigates to the dashboard tab no longer reflects the actual UI (there is no TopNav tab to click).

### Current `Background`

```gherkin
Background:
  Given the app is loaded
  And I navigate to the Dashboard tab
```

### Updated `Background`

```gherkin
Background:
  Given the app is loaded
  And I open the dashboard editor
```

Update the matching step definition in `steps.ts`:

```ts
// Before:
Given('I navigate to the Dashboard tab', async function (this: BrowserWorld) {
  await this.page.evaluate(() => {
    window.location.hash = '#/dashboard/portable-bi-dashboard';
  });
  await this.page.waitForSelector('sheets-view', { timeout: 10000 });
});

// After:
Given('I open the dashboard editor', async function (this: BrowserWorld) {
  await this.page.evaluate(() => {
    window.location.hash = '#/dashboard/portable-bi-dashboard';
  });
  await this.page.waitForSelector('sheets-view', { timeout: 10000 });
});
```

The implementation is identical — only the step text changes.

### Scenario wording — edit mode steps

Scenarios that say `When I click "Edit" to enter edit mode` remain valid because the button label "Edit" is unchanged. The step implementation calls `this.clickEditToggle()` which now targets `.editor-edit-btn`. No wording change is strictly required here, but the following clarification is recommended:

```gherkin
# Before:
When I click "Edit" to enter edit mode
When I click "Done Editing" to exit edit mode

# Recommended (clearer location):
When I click the Edit button in the dashboard header
When I click Done Editing in the dashboard header
```

If you update the wording, update the matching step matchers in `steps.ts`:

```ts
// Before:
When('I click {string} to enter edit mode', async function (...) { ... });
When('I click {string} to exit edit mode', async function (...) { ... });

// After:
When('I click the Edit button in the dashboard header', async function (this: BrowserWorld) {
  await this.clickEditToggle();
});

When('I click Done Editing in the dashboard header', async function (this: BrowserWorld) {
  await this.clickEditToggle();
});
```

> This wording change is optional but recommended for long-term maintainability. If you prefer to keep the original wording, only fix `clickEditToggle()` in `world.ts` — the E2E suite will pass either way.

---

## 3 · Verify no other selectors reference removed classes

Run these greps across the entire test directory before closing this issue:

```sh
# Should return no matches:
grep -rn "btn-edit-mode" tests/
grep -rn "topnav-tab" tests/
grep -rn "sheet-icon" tests/
```

```sh
# These should still have matches (used in world.ts or features):
grep -rn "sheet-tab" tests/        # ← tab navigation, still valid
grep -rn "editor-edit-btn" tests/  # ← the new class after this issue
```

---

## 4 · Run the full test suite

After all changes, run every test layer:

### Unit tests (Vitest)

```sh
npx vitest run
```

Expected: all existing tests pass, plus the new `dashboard-editor-header.spec.ts` tests from issue 01.

### E2E tests (Cucumber + Playwright)

```sh
npm run test:e2e
# or the project's exact command — check package.json scripts
```

All 6 scenarios in `tests/e2e/features/sheets.feature` must pass:

| Scenario                                          | Key interaction                          |
| ------------------------------------------------- | ---------------------------------------- |
| Dashboard tab shows the default dashboard         | Navigates by hash, no click interaction  |
| Injecting a sheet with chart widgets              | Widget injection, no edit interaction    |
| Clicking a widget in view mode does not select it | Clicks widget content                    |
| Clicking a widget in edit mode selects it         | `clickEditToggle()` → `.editor-edit-btn` |
| Exiting edit mode deselects all widgets           | `clickEditToggle()` again                |
| Switching between sheets uses data cache          | `clickSheetTab()` → `.sheet-tab`         |

### Integration tests (Cucumber, headless)

```sh
npm run test:integration
# or the equivalent command
```

The `dashboard.feature` and `ask-data.feature` integration tests do not reference any UI selectors changed by this restructure. They should pass without changes.

---

## 5 · Add a new E2E scenario for the mode switcher (recommended)

The Editor / Ask Data mode switcher is now a testable UI element. Add a scenario to `sheets.feature`:

```gherkin
Scenario: Switching to Ask Data mode shows the ask interface
  When I click the Ask Data button in the dashboard header
  Then I should see the ask input field
  When I click the Editor button in the dashboard header
  Then I should see widgets rendered on the canvas
```

Add step definitions in `steps.ts`:

```ts
When('I click the Ask Data button in the dashboard header', async function (this: BrowserWorld) {
  await this.page.click('.editor-mode-group .editor-mode-btn:last-child');
  await this.page.waitForSelector('.ask-page', { timeout: 5000 });
});

When('I click the Editor button in the dashboard header', async function (this: BrowserWorld) {
  await this.page.click('.editor-mode-group .editor-mode-btn:first-child');
  await this.page.waitForSelector('sheets-view', { timeout: 5000 });
});

Then('I should see the ask input field', async function (this: BrowserWorld) {
  const input = await this.page.$('.ask-input-row input');
  assert.ok(input, 'Expected ask input field to be visible');
});
```

> This scenario is optional for this issue but closes the coverage gap left by removing the `TabSwitch` story from `top-nav.stories.ts`.

---

## 6 · Storybook interaction tests summary

All Storybook interaction tests (`play` functions) are already defined in their respective stories files from issues 01–05. Confirm they run in CI:

```sh
npx storybook test --url http://localhost:6006
# or equivalent project command
```

| Story                                                      | Interaction tested                         |
| ---------------------------------------------------------- | ------------------------------------------ |
| Dashboard Editor Header → Interaction — Switch to Ask Data | `mode-change` event with 'askData'         |
| Dashboard Editor Header → Interaction — Enter Edit Mode    | `edit-mode-toggle` with `{editMode:true}`  |
| Dashboard Editor Header → Interaction — Exit Edit Mode     | `edit-mode-toggle` with `{editMode:false}` |
| Top Nav → Interaction — Back Button                        | Back button accessible and clickable       |
| Sheets Manager → Interaction — Select Sheet                | `sheet-select` event fires                 |

---

## Checklist before marking done

- [ ] `clickEditToggle()` in `world.ts` changed from `.btn-edit-mode` to `.editor-edit-btn`
- [ ] `"I navigate to the Dashboard tab"` step renamed to `"I open the dashboard editor"` (or kept if skipping wording update)
- [ ] Step definition updated to match new wording (if changed)
- [ ] `grep -rn "btn-edit-mode" tests/` → no matches
- [ ] `grep -rn "topnav-tab" tests/` → no matches
- [ ] `npx vitest run` → all tests pass including new `dashboard-editor-header.spec.ts`
- [ ] `npm run test:e2e` → all 6 `sheets.feature` scenarios pass
- [ ] `npm run test:integration` → unchanged, all pass
- [ ] (Optional) new "Switching to Ask Data mode" E2E scenario added and passing
- [ ] Storybook interaction tests pass
