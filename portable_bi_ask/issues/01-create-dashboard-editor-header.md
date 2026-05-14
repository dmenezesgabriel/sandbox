# 01 — Create `dashboard-editor-header` component

## Context

The dashboard editor page currently splits its navigation concerns across two places:

- **`top-nav`** owns the "Editor / Ask Data" tab switcher and the edit-mode toggle button alongside the global brand and back link.
- **`sheets-manager`** also owns an Edit / Done Editing button inside the sheet tab bar.

Neither is the right place. Both controls are scoped to a specific dashboard being edited; they should live in a dedicated header bar that sits between the global nav and the canvas.

This issue creates the new `dashboard-editor-header` component **in isolation** — no integration yet. It can be developed and reviewed independently before wiring it into the editor in issue 04.

---

## Goal

Create a `<dashboard-editor-header>` Web Component that renders:

- **Left**: dashboard title + optional subtitle
- **Right**: a segmented "Editor | Ask Data" mode switcher + an "Edit / Done Editing" toggle button

The component owns no state beyond what is passed to it as properties. All interaction is communicated upward via custom events.

---

## Directory structure to create

```
src/
  components/
    dashboard-editor-header/
      dashboard-editor-header.ts      ← component + type export
      dashboard-editor-header.spec.ts ← Vitest unit tests
      dashboard-editor-header.stories.ts
      index.ts
  styles/
    dashboard-editor-header.css       ← component styles
```

---

## 1 · Component — `dashboard-editor-header.ts`

```ts
import { html, LitElement, nothing, type TemplateResult } from 'lit';

export type DashboardMode = 'dashboard' | 'askData';

export class DashboardEditorHeader extends LitElement {
  static override readonly properties = {
    title: { type: String },
    subtitle: { type: String },
    mode: { type: String },
    editMode: { type: Boolean },
  };

  title = '';
  subtitle = '';
  mode: DashboardMode = 'dashboard';
  editMode = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _selectMode(m: DashboardMode): void {
    this.dispatchEvent(
      new CustomEvent<DashboardMode>('mode-change', {
        detail: m,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggleEdit(): void {
    this.dispatchEvent(
      new CustomEvent<{ editMode: boolean }>('edit-mode-toggle', {
        detail: { editMode: !this.editMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _modeClass(m: DashboardMode): string {
    return this.mode === m ? 'editor-mode-btn-active' : '';
  }

  override render(): TemplateResult {
    return html`
      <div class="editor-header">
        <div class="editor-header-identity">
          <h1 class="editor-header-title">${this.title}</h1>
          ${this.subtitle ? html`<p class="editor-header-subtitle">${this.subtitle}</p>` : nothing}
        </div>

        <div class="editor-header-controls">
          <div class="editor-mode-group" role="group" aria-label="Dashboard mode">
            <button
              class="editor-mode-btn ${this._modeClass('dashboard')}"
              aria-pressed=${this.mode === 'dashboard'}
              @click=${() => this._selectMode('dashboard')}
            >
              Editor
            </button>
            <button
              class="editor-mode-btn ${this._modeClass('askData')}"
              aria-pressed=${this.mode === 'askData'}
              @click=${() => this._selectMode('askData')}
            >
              Ask Data
            </button>
          </div>

          <button
            class="editor-edit-btn ${this.editMode ? 'active' : ''}"
            @click=${this._toggleEdit}
          >
            ${this.editMode ? 'Done Editing' : 'Edit'}
          </button>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('dashboard-editor-header')) {
  customElements.define('dashboard-editor-header', DashboardEditorHeader);
}
```

### Key design decisions

- `DashboardMode = 'dashboard' | 'askData'` keeps the same string values used in `dashboard-editor.ts` (`_activeTab`) to avoid a mapping layer.
- `mode` and `editMode` are **read-only props** — the component never mutates them. All changes flow out through events and back down as new props.
- `edit-mode-toggle` fires with `detail: { editMode: !this.editMode }` so the parent receives the _next_ state, not the _current_ one.
- `aria-pressed` on mode buttons communicates the active state to assistive technology.

---

## 2 · Index — `index.ts`

```ts
export * from './dashboard-editor-header';
```

---

## 3 · CSS — `src/styles/dashboard-editor-header.css`

```css
/* ==========================================================================
   Dashboard Editor Header
   ========================================================================== */

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding: var(--space-md) var(--page-padding);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

/* Identity (left side) */

.editor-header-identity {
  flex: 1;
  min-width: 0;
}

.editor-header-title {
  margin: 0;
  overflow: hidden;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-header-subtitle {
  margin: 0.15rem 0 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Controls (right side) */

.editor-header-controls {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-sm);
  align-items: center;
}

/* Segmented mode switcher */

.editor-mode-group {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.editor-mode-btn {
  padding: 0.35rem var(--space-md);
  border: none;
  border-radius: 0;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.editor-mode-btn + .editor-mode-btn {
  border-left: 1px solid var(--color-border);
}

.editor-mode-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.editor-mode-btn-active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.editor-mode-btn-active:hover {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.editor-mode-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

/* Edit toggle button */

.editor-edit-btn {
  padding: 0.35rem var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.editor-edit-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.editor-edit-btn.active {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.editor-edit-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Responsive */

@media (width <= 640px) {
  .editor-header {
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-base);
  }

  .editor-header-title {
    font-size: var(--text-lg);
  }

  .editor-mode-btn {
    padding: 0.3rem var(--space-sm);
    font-size: var(--text-xs);
  }
}
```

> **Note**: Do not add the CSS import to `src/styles.css` yet — that is done in issue 06 as the final wiring step.

---

## 4 · Storybook stories — `dashboard-editor-header.stories.ts`

```ts
import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { DashboardMode } from './dashboard-editor-header';

type DashboardEditorHeaderArgs = {
  title: string;
  subtitle: string;
  mode: DashboardMode;
  editMode: boolean;
  onModeChange: (mode: DashboardMode) => void;
  onEditModeToggle: (detail: { editMode: boolean }) => void;
};

const meta = {
  title: 'Organisms/Dashboard Editor Header',
  component: 'dashboard-editor-header',
  tags: ['autodocs'],
  render: ({ title, subtitle, mode, editMode, onModeChange, onEditModeToggle }) =>
    html`<dashboard-editor-header
      .title=${title}
      .subtitle=${subtitle}
      .mode=${mode}
      .editMode=${editMode}
      @mode-change=${(e: CustomEvent<DashboardMode>) => onModeChange(e.detail)}
      @edit-mode-toggle=${(e: CustomEvent<{ editMode: boolean }>) => onEditModeToggle(e.detail)}
    ></dashboard-editor-header>`,
  argTypes: {
    title: {
      control: 'text',
      description: 'Dashboard display name shown on the left.',
    },
    subtitle: {
      control: 'text',
      description: 'Optional tagline shown below the title. Hidden when empty.',
    },
    mode: {
      control: 'select',
      options: ['dashboard', 'askData'],
      description: 'Active mode. Controls which segment button is highlighted.',
      table: { defaultValue: { summary: 'dashboard' } },
    },
    editMode: {
      control: 'boolean',
      description: 'When `true` the Edit button shows "Done Editing" and is highlighted.',
      table: { defaultValue: { summary: 'false' } },
    },
    onModeChange: {
      action: 'mode-change',
      description: 'Fired when a mode button is clicked. `detail` is the new `DashboardMode`.',
      table: { category: 'Events' },
    },
    onEditModeToggle: {
      action: 'edit-mode-toggle',
      description:
        'Fired when the Edit button is clicked. `detail.editMode` is the *next* edit state.',
      table: { category: 'Events' },
    },
  },
  args: {
    title: 'Sales Overview',
    subtitle: 'Regional performance Q1–Q2',
    mode: 'dashboard',
    editMode: false,
    onModeChange: fn(),
    onEditModeToggle: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Contextual header bar rendered below the global nav inside the dashboard editor. ' +
          'Displays the dashboard title and subtitle on the left; mode switcher and edit toggle on the right.',
      },
    },
  },
} satisfies Meta<DashboardEditorHeaderArgs>;

export default meta;
type Story = StoryObj<DashboardEditorHeaderArgs>;

export const EditorMode: Story = {
  parameters: {
    docs: { description: { story: 'Default state — Editor button active, not in edit mode.' } },
  },
};

export const AskDataMode: Story = {
  args: { mode: 'askData' },
  parameters: {
    docs: { description: { story: 'Ask Data button is active.' } },
  },
};

export const EditModeActive: Story = {
  args: { editMode: true },
  parameters: {
    docs: {
      description: {
        story: 'Edit mode on — button shows "Done Editing" with accent background.',
      },
    },
  },
};

export const NoSubtitle: Story = {
  args: { subtitle: '' },
  parameters: {
    docs: { description: { story: 'Subtitle omitted — title row only.' } },
  },
};

export const SwitchToAskData: Story = {
  name: 'Interaction — Switch to Ask Data',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Ask Data' });
    await userEvent.click(btn);
    await expect(args.onModeChange).toHaveBeenCalledWith('askData');
  },
};

export const ToggleEditOn: Story = {
  name: 'Interaction — Enter Edit Mode',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Edit' });
    await userEvent.click(btn);
    await expect(args.onEditModeToggle).toHaveBeenCalledWith({ editMode: true });
  },
};

export const ToggleEditOff: Story = {
  name: 'Interaction — Exit Edit Mode',
  tags: ['!autodocs'],
  args: { editMode: true },
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Done Editing' });
    await userEvent.click(btn);
    await expect(args.onEditModeToggle).toHaveBeenCalledWith({ editMode: false });
  },
};
```

---

## 5 · Vitest unit tests — `dashboard-editor-header.spec.ts`

The component renders into the light DOM (`createRenderRoot` returns `this`), so tests use DOM queries directly.

```ts
import { describe, expect, it, vi } from 'vitest';

import { DashboardEditorHeader } from './dashboard-editor-header';

// Ensure the custom element is registered before tests run.
import './index';

function mount(
  props: Partial<{
    title: string;
    subtitle: string;
    mode: 'dashboard' | 'askData';
    editMode: boolean;
  }>,
): DashboardEditorHeader {
  const el = document.createElement('dashboard-editor-header') as DashboardEditorHeader;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('DashboardEditorHeader', () => {
  describe('rendering', () => {
    it('renders the title', async () => {
      const el = mount({ title: 'Sales Overview' });
      await el.updateComplete;
      expect(el.querySelector('.editor-header-title')?.textContent?.trim()).toBe('Sales Overview');
      cleanup(el);
    });

    it('renders subtitle when provided', async () => {
      const el = mount({ subtitle: 'Q1 report' });
      await el.updateComplete;
      expect(el.querySelector('.editor-header-subtitle')?.textContent?.trim()).toBe('Q1 report');
      cleanup(el);
    });

    it('omits subtitle element when empty', async () => {
      const el = mount({ subtitle: '' });
      await el.updateComplete;
      expect(el.querySelector('.editor-header-subtitle')).toBeNull();
      cleanup(el);
    });

    it('applies active class to the Editor button when mode is dashboard', async () => {
      const el = mount({ mode: 'dashboard' });
      await el.updateComplete;
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      expect(btns[0].classList.contains('editor-mode-btn-active')).toBe(true);
      expect(btns[1].classList.contains('editor-mode-btn-active')).toBe(false);
      cleanup(el);
    });

    it('applies active class to the Ask Data button when mode is askData', async () => {
      const el = mount({ mode: 'askData' });
      await el.updateComplete;
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      expect(btns[0].classList.contains('editor-mode-btn-active')).toBe(false);
      expect(btns[1].classList.contains('editor-mode-btn-active')).toBe(true);
      cleanup(el);
    });

    it('shows "Edit" when editMode is false', async () => {
      const el = mount({ editMode: false });
      await el.updateComplete;
      expect(el.querySelector('.editor-edit-btn')?.textContent?.trim()).toBe('Edit');
      expect(el.querySelector('.editor-edit-btn')?.classList.contains('active')).toBe(false);
      cleanup(el);
    });

    it('shows "Done Editing" and active class when editMode is true', async () => {
      const el = mount({ editMode: true });
      await el.updateComplete;
      expect(el.querySelector('.editor-edit-btn')?.textContent?.trim()).toBe('Done Editing');
      expect(el.querySelector('.editor-edit-btn')?.classList.contains('active')).toBe(true);
      cleanup(el);
    });
  });

  describe('events', () => {
    it('fires mode-change with "askData" when Ask Data clicked', async () => {
      const el = mount({ mode: 'dashboard' });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('mode-change', handler);
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      btns[1].click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe('askData');
      cleanup(el);
    });

    it('fires mode-change with "dashboard" when Editor clicked', async () => {
      const el = mount({ mode: 'askData' });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('mode-change', handler);
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      btns[0].click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe('dashboard');
      cleanup(el);
    });

    it('fires edit-mode-toggle with {editMode: true} when Edit clicked (editMode=false)', async () => {
      const el = mount({ editMode: false });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('edit-mode-toggle', handler);
      el.querySelector<HTMLButtonElement>('.editor-edit-btn')!.click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ editMode: true });
      cleanup(el);
    });

    it('fires edit-mode-toggle with {editMode: false} when Done Editing clicked (editMode=true)', async () => {
      const el = mount({ editMode: true });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('edit-mode-toggle', handler);
      el.querySelector<HTMLButtonElement>('.editor-edit-btn')!.click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ editMode: false });
      cleanup(el);
    });
  });
});
```

---

## Checklist before marking done

- [ ] `src/components/dashboard-editor-header/dashboard-editor-header.ts` created
- [ ] `src/components/dashboard-editor-header/index.ts` created (`export * from './dashboard-editor-header'`)
- [ ] `src/styles/dashboard-editor-header.css` created (no import in `styles.css` yet — that is issue 06)
- [ ] `src/components/dashboard-editor-header/dashboard-editor-header.stories.ts` created
- [ ] `src/components/dashboard-editor-header/dashboard-editor-header.spec.ts` created
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] All 7 Storybook stories render correctly in isolation
- [ ] All Vitest tests pass (`npx vitest run`)

## What is NOT done in this issue

- Integrating into `dashboard-editor` (issue 04)
- Adding the CSS import to `styles.css` (issue 06)
- Removing tab props from `top-nav` (issue 05)
