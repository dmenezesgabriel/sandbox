# 02 — Simplify `sheets-manager` tabs and remove the edit-mode toggle button

## Context

`sheets-manager` currently renders two things that no longer belong there:

1. **An Edit / Done Editing button** in `.sheets-toolbar` — this button fires `edit-mode-toggle` and is consumed by `sheets-view`. After this restructure the edit toggle moves to `dashboard-editor-header` (issue 01), which means `sheets-manager` should stop owning it.

2. **A 📊 emoji icon** (`<span class="sheet-icon">`) in every tab — the tabs should be title-only. Each sheet is effectively a full dashboard view; the icon adds noise without information.

This issue simplifies `sheets-manager` first, in isolation, so the component can be reviewed before it is wired into the new edit-mode flow (issue 03).

> **Dependency**: this issue has no dependency on issue 01. It can be implemented in parallel.

---

## Current state

`src/components/sheets-manager/sheets-manager.ts` (113 lines):

```
sheets-manager
  ├── .sheets-manager
  │     ├── .sheets-list
  │     │     └── [.sheet-tab] × N
  │     │           ├── .sheet-icon  ← 📊 emoji  (REMOVE)
  │     │           ├── .sheet-name  ← title text (KEEP)
  │     │           └── .sheet-actions (duplicate/delete, edit mode only) (KEEP)
  │     └── .sheets-toolbar           ← (REMOVE entire block)
  │           └── .btn-edit-mode      ← Edit / Done Editing (REMOVE)
```

Event currently fired from this component: `edit-mode-toggle` — **remove it**.

---

## Target state

```
sheets-manager
  └── .sheets-manager
        └── .sheets-list
              └── [.sheet-tab] × N
                    ├── .sheet-name       ← title only (no icon)
                    └── .sheet-actions    ← duplicate/delete, only when editMode=true
```

`editMode` property is **kept** — it still controls whether per-tab action buttons are visible. Only the standalone Edit/Done Editing toolbar button is removed.

---

## File: `src/components/sheets-manager/sheets-manager.ts`

### Changes

Remove from `static properties` and class body:

- `_toggleEditMode()` method (lines ~43–50)
- The `edit-mode-toggle` `CustomEvent` dispatch

Remove from `render()`:

- The `<span class="sheet-icon">📊</span>` inside `.sheet-tab`
- The entire `.sheets-toolbar` div with the `.btn-edit-mode` button

### Before (key sections)

```ts
// inside render():
${this.sheets.map(
  (sheet) => html`
    <div class="sheet-tab ${sheet.id === this.activeSheetId ? 'active' : ''}"
         @click=${() => this._selectSheet(sheet.id)}>
      <span class="sheet-icon">📊</span>           <!-- REMOVE -->
      <span class="sheet-name">${sheet.name}</span>
      ${this.editMode ? html`
        <div class="sheet-actions">
          <button class="sheet-btn" @click=${(e: Event) => this._duplicateSheet(e, sheet)} title="Duplicate">⧉</button>
          <button class="sheet-btn" @click=${(e: Event) => this._deleteSheet(e, sheet.id)} title="Delete">✕</button>
        </div>` : nothing}
    </div>
  `,
)}

<!-- REMOVE entire block below: -->
<div class="sheets-toolbar">
  <button class="btn-edit-mode ${this.editMode ? 'active' : ''}"
          @click=${this._toggleEditMode}>
    ${this.editMode ? 'Done Editing' : 'Edit'}
  </button>
</div>
```

### After (complete render method)

```ts
override render(): TemplateResult {
  return html`
    <div class="sheets-manager">
      <div class="sheets-list">
        ${this.sheets.map(
          (sheet) => html`
            <div
              class="sheet-tab ${sheet.id === this.activeSheetId ? 'active' : ''}"
              @click=${() => this._selectSheet(sheet.id)}
            >
              <span class="sheet-name">${sheet.name}</span>
              ${this.editMode
                ? html`
                    <div class="sheet-actions">
                      <button
                        class="sheet-btn"
                        @click=${(e: Event) => this._duplicateSheet(e, sheet)}
                        title="Duplicate"
                      >
                        ⧉
                      </button>
                      <button
                        class="sheet-btn"
                        @click=${(e: Event) => this._deleteSheet(e, sheet.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  `
                : nothing}
            </div>
          `,
        )}
      </div>
    </div>
  `;
}
```

### Complete updated file

```ts
import { html, LitElement, nothing, type TemplateResult } from 'lit';

import type { Sheet } from '../../types';

export class SheetsManager extends LitElement {
  static override readonly properties = {
    sheets: { type: Array },
    activeSheetId: { type: String },
    editMode: { type: Boolean },
  };

  sheets: Sheet[];
  activeSheetId: string | null;
  editMode: boolean;

  constructor() {
    super();
    this.sheets = [];
    this.activeSheetId = null;
    this.editMode = false;
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _selectSheet(id: string): void {
    this.activeSheetId = id;
    this.dispatchEvent(
      new CustomEvent('sheet-select', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  private _deleteSheet(e: Event, id: string): void {
    e.stopPropagation();
    if (confirm('Delete this dashboard?')) {
      this.dispatchEvent(
        new CustomEvent('sheet-delete', { detail: { id }, bubbles: true, composed: true }),
      );
    }
  }

  private _duplicateSheet(e: Event, sheet: Sheet): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('sheet-duplicate', { detail: { sheet }, bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    return html`
      <div class="sheets-manager">
        <div class="sheets-list">
          ${this.sheets.map(
            (sheet) => html`
              <div
                class="sheet-tab ${sheet.id === this.activeSheetId ? 'active' : ''}"
                @click=${() => this._selectSheet(sheet.id)}
              >
                <span class="sheet-name">${sheet.name}</span>
                ${this.editMode
                  ? html`
                      <div class="sheet-actions">
                        <button
                          class="sheet-btn"
                          @click=${(e: Event) => this._duplicateSheet(e, sheet)}
                          title="Duplicate"
                        >
                          ⧉
                        </button>
                        <button
                          class="sheet-btn"
                          @click=${(e: Event) => this._deleteSheet(e, sheet.id)}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    `
                  : nothing}
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('sheets-manager')) {
  customElements.define('sheets-manager', SheetsManager);
}
```

---

## File: `src/styles/sheets.css`

Remove the two CSS blocks that no longer have matching elements:

### Remove `.sheet-icon` block

```css
/* DELETE this block: */
.sheet-icon {
  font-size: var(--text-md);
  line-height: 1;
}
```

### Remove `.sheets-toolbar` and `.sheets-toolbar-bar` blocks

```css
/* DELETE these blocks: */
.sheets-toolbar {
  display: flex;
  gap: 0.4rem;
}

.sheets-toolbar-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-sm);
}
```

> `.sheets-toolbar-bar` is used by `sheets-view` for the Export/Import toolbar row — **do not delete it**. Only `.sheets-toolbar` (the wrapper for the edit toggle button) is removed.

Wait — re-check: `sheets-view.ts` line 632 renders `<div class="sheets-toolbar-bar">` for the export/import buttons. This class must be **kept**. Only the `.sheets-toolbar` class (used by the removed toolbar div inside `sheets-manager`) is deleted.

### Summary of CSS removals

| Class                                                       | Action                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `.sheet-icon`                                               | **Delete** — element removed from template                   |
| `.sheets-toolbar`                                           | **Delete** — container div removed from `sheets-manager`     |
| `.sheets-toolbar-bar`                                       | **Keep** — still used by `sheets-view` for export/import row |
| `.sheet-tab`, `.sheet-name`, `.sheet-actions`, `.sheet-btn` | **Keep** — all still in use                                  |

---

## File: `src/components/sheets-manager/sheets-manager.stories.ts`

### Changes

1. Remove `onEditModeToggle` from `SheetsManagerArgs` type.
2. Remove `onEditModeToggle` from `argTypes` and `args`.
3. Remove the `@edit-mode-toggle` listener from the `render` template.
4. Delete the `ToggleEditMode` interaction story entirely.
5. Update descriptions for `Default` and `EditMode`.

### Updated file

```ts
import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { Sheet } from '../../types';

type SheetsManagerArgs = {
  sheets: Sheet[];
  activeSheetId: string | null;
  editMode: boolean;
  onSheetSelect: (id: string) => void;
  onSheetDelete: (id: string) => void;
  onSheetDuplicate: (sheet: Sheet) => void;
};

const SHEETS: Sheet[] = [
  { id: 'sheet-1', name: 'Overview', type: 'sheet', widgets: [], layout: [] },
  { id: 'sheet-2', name: 'Sales Detail', type: 'sheet', widgets: [], layout: [] },
  { id: 'sheet-3', name: 'Regional Breakdown', type: 'sheet', widgets: [], layout: [] },
];

const meta = {
  title: 'Organisms/Sheets Manager',
  component: 'sheets-manager',
  tags: ['autodocs'],
  render: ({
    sheets,
    activeSheetId,
    editMode,
    onSheetSelect,
    onSheetDelete,
    onSheetDuplicate,
  }: SheetsManagerArgs) =>
    html`<sheets-manager
      .sheets=${sheets}
      .activeSheetId=${activeSheetId}
      .editMode=${editMode}
      @sheet-select=${(e: CustomEvent<{ id: string }>) => onSheetSelect(e.detail.id)}
      @sheet-delete=${(e: CustomEvent<{ id: string }>) => onSheetDelete(e.detail.id)}
      @sheet-duplicate=${(e: CustomEvent<{ sheet: Sheet }>) => onSheetDuplicate(e.detail.sheet)}
    ></sheets-manager>`,
  argTypes: {
    sheets: {
      control: 'object',
      description: 'Array of sheets to render as tabs.',
    },
    activeSheetId: {
      control: 'text',
      description: 'ID of the currently active (selected) sheet.',
    },
    editMode: {
      control: 'boolean',
      description:
        'When `true`, shows duplicate (⧉) and delete (✕) action buttons on each tab. ' +
        'The Edit toggle button is no longer in this component — it lives in `dashboard-editor-header`.',
      table: { defaultValue: { summary: 'false' } },
    },
    onSheetSelect: {
      action: 'sheet-select',
      description: 'Fired when a tab is clicked. `detail.id` is the sheet ID.',
      table: { category: 'Events' },
    },
    onSheetDelete: {
      action: 'sheet-delete',
      description: 'Fired when the ✕ delete button is clicked. `detail.id` is the sheet ID.',
      table: { category: 'Events' },
    },
    onSheetDuplicate: {
      action: 'sheet-duplicate',
      description:
        'Fired when the ⧉ duplicate button is clicked. `detail.sheet` is the source sheet.',
      table: { category: 'Events' },
    },
  },
  args: {
    sheets: SHEETS,
    activeSheetId: 'sheet-1',
    editMode: false,
    onSheetSelect: fn(),
    onSheetDelete: fn(),
    onSheetDuplicate: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tab bar for navigating between dashboard sheets. ' +
          'Each tab shows only the sheet name. ' +
          'Duplicate (⧉) and delete (✕) controls appear per tab when `editMode` is enabled. ' +
          'The Edit toggle button is owned by `dashboard-editor-header`, not this component.',
      },
    },
  },
} satisfies Meta<SheetsManagerArgs>;

export default meta;
type Story = StoryObj<SheetsManagerArgs>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Three title-only tabs — Overview active, action buttons hidden.',
      },
    },
  },
};

export const EditMode: Story = {
  args: { editMode: true },
  parameters: {
    docs: {
      description: {
        story:
          'Edit mode enabled — duplicate (⧉) and delete (✕) buttons visible on each tab. ' +
          'The Edit toggle that controls this mode lives in `dashboard-editor-header`.',
      },
    },
  },
};

export const SingleSheet: Story = {
  args: { sheets: [SHEETS[0]], activeSheetId: 'sheet-1' },
  parameters: {
    docs: { description: { story: 'Only one tab — minimum viable state.' } },
  },
};

export const SelectSheet: Story = {
  name: 'Interaction — Select Sheet',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByText('Sales Detail'));
    await expect(args.onSheetSelect).toHaveBeenCalledWith('sheet-2');
  },
};
```

---

## Impact on other files

At this stage `sheets-view.ts` still has `@edit-mode-toggle=${this._onEditModeToggle}` on its `<sheets-manager>` element. Since `sheets-manager` no longer fires that event, the listener in `sheets-view` becomes a no-op — **it will not break**, but it is dead code. That cleanup is handled in issue 03.

Similarly, the `btn-edit-mode` CSS class still exists in `sheets.css`. Remove it there:

```css
/* DELETE — no longer rendered */
.btn-edit-mode { ... }
.btn-edit-mode.active { ... }
```

Check `sheets.css` for any `.btn-edit-mode` rules and remove them. These were part of the old toolbar button style.

---

## Checklist before marking done

- [ ] `_toggleEditMode()` method removed from `sheets-manager.ts`
- [ ] `edit-mode-toggle` event removed from `sheets-manager.ts`
- [ ] `.sheets-toolbar` div removed from `sheets-manager.ts` render
- [ ] `<span class="sheet-icon">` removed from tab template
- [ ] `.sheet-icon` block removed from `sheets.css`
- [ ] `.sheets-toolbar` block removed from `sheets.css` (not `.sheets-toolbar-bar`)
- [ ] `onEditModeToggle` removed from stories args/argTypes/render
- [ ] `ToggleEditMode` interaction story deleted
- [ ] All remaining stories (`Default`, `EditMode`, `SingleSheet`, `SelectSheet`) render correctly
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes (no tests reference the removed event)

## What is NOT done in this issue

- Removing the `@edit-mode-toggle` listener from `sheets-view` (issue 03)
- Passing `editMode` from `dashboard-editor` down to `sheets-view` (issue 04)
