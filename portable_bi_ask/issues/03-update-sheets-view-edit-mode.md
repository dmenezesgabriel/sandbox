# 03 — Remove self-managed edit mode from `sheets-view`

## Context

`sheets-view` currently both **receives** `editMode` as a public Lit property and **writes** to it internally by listening to the `edit-mode-toggle` event bubbled up from `sheets-manager`:

```ts
// sheets-view.ts  line 268-273
private _onEditModeToggle(e: CustomEvent<{ editMode: boolean }>): void {
  this.editMode = e.detail.editMode;
  if (!this.editMode) {
    this.selectedWidgetId = null;    // ← side-effect must be preserved
  }
}
```

After issue 02, `sheets-manager` no longer fires `edit-mode-toggle`. After issue 04, `editMode` will be passed down from `dashboard-editor` as a prop. `sheets-view` should become a pure prop-consumer for this value — it must not write to its own `editMode` from within.

This issue removes the internal listener and handler, **preserving the side-effect** (clearing widget selection on exit) by moving that logic to `updated()`.

> **Dependency**: complete issue 02 before this one. The `sheets-manager` must no longer fire `edit-mode-toggle` before you remove the listener here, otherwise you'll be removing a working feature mid-flight.

---

## What changes

### 1 · Remove the `@edit-mode-toggle` listener from `<sheets-manager>` in the render template

**File**: `src/components/sheets-view/sheets-view.ts`

Current `<sheets-manager>` template (lines 622–630):

```ts
<sheets-manager
  .sheets=${this.sheets}
  .activeSheetId=${this.activeSheetId}
  .editMode=${this.editMode}
  @sheet-select=${this._onSheetSelect}
  @sheet-delete=${this._onSheetDelete}
  @sheet-duplicate=${this._onSheetDuplicate}
  @edit-mode-toggle=${this._onEditModeToggle}   // ← REMOVE this line
></sheets-manager>
```

After:

```ts
<sheets-manager
  .sheets=${this.sheets}
  .activeSheetId=${this.activeSheetId}
  .editMode=${this.editMode}
  @sheet-select=${this._onSheetSelect}
  @sheet-delete=${this._onSheetDelete}
  @sheet-duplicate=${this._onSheetDuplicate}
></sheets-manager>
```

### 2 · Remove the `_onEditModeToggle` handler method

Delete the entire method (lines 268–273):

```ts
// DELETE:
private _onEditModeToggle(e: CustomEvent<{ editMode: boolean }>): void {
  this.editMode = e.detail.editMode;
  if (!this.editMode) {
    this.selectedWidgetId = null;
  }
}
```

### 3 · Preserve the "clear selection on exit" side-effect via `updated()`

The `_onEditModeToggle` handler did two things:

1. `this.editMode = e.detail.editMode` — no longer needed (prop is set from outside)
2. `this.selectedWidgetId = null` when exiting edit mode — **must be preserved**

Move this side-effect into the existing `updated()` lifecycle hook, which already handles other `changedProps`:

```ts
override updated(changedProps: Map<string, unknown>): void {
  // existing changedProps handling stays here, e.g. config reload
  if (changedProps.has('config')) {
    // ... existing logic ...
  }

  // Clear selected widget whenever edit mode is turned off
  if (changedProps.has('editMode') && !this.editMode) {
    this.selectedWidgetId = null;
  }
}
```

> If `sheets-view` does not already have an `updated()` method, add one. Check the current file around lines 116–120 for the existing `updated()` to confirm the insertion point.

---

## Exact diff (conceptual)

```diff
-  private _onEditModeToggle(e: CustomEvent<{ editMode: boolean }>): void {
-    this.editMode = e.detail.editMode;
-    if (!this.editMode) {
-      this.selectedWidgetId = null;
-    }
-  }

   override updated(changedProps: Map<string, unknown>): void {
     if (changedProps.has('config')) {
       this._askEngine = new AskDataEngine(this.config, duckDBManager);
       this._dataReady = false;
       this._dataCache = {};
     }
+    if (changedProps.has('editMode') && !this.editMode) {
+      this.selectedWidgetId = null;
+    }
   }

   // in render():
   <sheets-manager
     .sheets=${this.sheets}
     .activeSheetId=${this.activeSheetId}
     .editMode=${this.editMode}
     @sheet-select=${this._onSheetSelect}
     @sheet-delete=${this._onSheetDelete}
     @sheet-duplicate=${this._onSheetDuplicate}
-    @edit-mode-toggle=${this._onEditModeToggle}
   ></sheets-manager>
```

---

## Verify `editMode` is still a public property

`editMode` must remain declared as a public Lit property in `static properties`:

```ts
static override readonly properties = {
  // ...
  editMode: { type: Boolean },   // ← keep this
  // ...
};
```

And in the class body:

```ts
editMode: boolean;
// constructor: this.editMode = false;
```

**Do not remove it** — `dashboard-editor` will pass it as a prop in issue 04.

---

## How `editMode` flows after this change

```
dashboard-editor
  ._editMode (state)
      │
      │  .editMode=${this._editMode}
      ▼
  sheets-view
    .editMode (prop, read-only from now on)
      │
      ├──  .editMode=${this.editMode}
      │         ▼
      │     sheets-manager  (tabs show/hide action buttons)
      │
      └──  .editMode=${this.editMode}
                ▼
           sheet-canvas  (enables drag/resize)
```

The flow is strictly **downward**. No component below `dashboard-editor` writes to `editMode`.

---

## Testing

### Manual verification

1. Start the dev server: `npm run dev`
2. Open a dashboard → click **Edit** in `dashboard-editor-header` (after issue 04 is done) or temporarily test by passing `editMode` as a prop directly via the Storybook story.
3. Confirm that selecting a widget and then clicking **Done Editing** clears the selection.
4. Confirm the canvas returns to view mode.

### Vitest — `sheets-view-model.spec.ts`

The existing model tests (`applySqlFilters`, `exportFileBaseName`, etc.) are pure-function tests and are unaffected.

If you add a component-level test for the selection clearing, the pattern is:

```ts
it('clears selectedWidgetId when editMode changes from true to false', async () => {
  const el = document.createElement('sheets-view') as SheetsView;
  el.editMode = true;
  el.selectedWidgetId = 'widget-123';
  document.body.appendChild(el);
  await el.updateComplete;

  el.editMode = false; // prop change from outside (simulating dashboard-editor)
  await el.updateComplete;

  expect(el.selectedWidgetId).toBeNull();
  el.remove();
});
```

---

## Checklist before marking done

- [ ] `_onEditModeToggle` method deleted from `sheets-view.ts`
- [ ] `@edit-mode-toggle=${this._onEditModeToggle}` removed from `<sheets-manager>` in the render template
- [ ] `updated()` now contains `if (changedProps.has('editMode') && !this.editMode) { this.selectedWidgetId = null; }`
- [ ] `editMode` public property and static declaration unchanged
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] Dev server: entering/exiting edit mode still works end-to-end (requires issue 04 for the new trigger point, but the existing trigger in `sheets-manager` is gone after issue 02; test by temporarily hard-coding `editMode=true` on `<sheets-view>` in `dashboard-editor.ts` render during development)

## What is NOT done in this issue

- Passing `editMode` down from `dashboard-editor` (issue 04)
- Removing the tab props from `top-nav` (issue 05)
