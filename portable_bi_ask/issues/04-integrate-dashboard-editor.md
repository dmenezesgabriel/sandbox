# 04 — Integrate `dashboard-editor-header` into `dashboard-editor`

## Context

`dashboard-editor` is the page-level component that composes the top nav, the ask interface, and the sheets canvas. It currently:

- Passes `showTabs={true}` and `activeTab` to `<top-nav>`, which renders the "Editor / Ask Data" tabs in the global nav bar.
- Has no `_editMode` state of its own — edit mode is self-managed inside `sheets-view` via the `edit-mode-toggle` event from `sheets-manager`.

After this issue:

- `<top-nav>` only receives `dashboardSlug` (for the back button) — no more tab props.
- A new `<dashboard-editor-header>` renders below the nav with the dashboard title, mode switcher, and edit toggle.
- `dashboard-editor` owns `_editMode` state and passes it down to `<sheets-view>` as a prop.

> **Dependencies**: issues 01, 02, and 03 must be complete before this one.
>
> - Issue 01: `dashboard-editor-header` component must exist.
> - Issue 02: `sheets-manager` must no longer fire `edit-mode-toggle`.
> - Issue 03: `sheets-view` must consume `editMode` as a pure prop.

---

## Current state of `dashboard-editor.ts`

```ts
// imports (lines 1–5):
import '../ask-clarification';
import '../ask-input';
import '../ask-result';
import '../sheet-editor';
import '../sheets-view';

// properties:
_activeTab: 'dashboard' | 'askData' = 'dashboard';
// no _editMode state

// render() (lines 161–177):
override render(): TemplateResult {
  const c = this.config;
  const subtitle = c?.subtitle ?? '';
  return html`
    <top-nav
      .activeTab=${this._activeTab}
      .subtitle=${subtitle}
      .dashboardSlug=${this.slug}
      .showTabs=${true}
      @tab-change=${(e: CustomEvent<'dashboard' | 'askData'>) => {
        this._activeTab = e.detail;
      }}
    ></top-nav>

    ${this._renderTabContent()}
  `;
}

// _renderTabContent() passes NO editMode to sheets-view:
<sheets-view .config=${this.config} .isNew=${this.isNew} .slug=${this.slug}></sheets-view>
```

---

## Target state

```ts
// render():
override render(): TemplateResult {
  const c = this.config;
  return html`
    <top-nav .dashboardSlug=${this.slug}></top-nav>

    <dashboard-editor-header
      .title=${c?.title ?? ''}
      .subtitle=${c?.subtitle ?? ''}
      .mode=${this._activeTab}
      .editMode=${this._editMode}
      @mode-change=${(e: CustomEvent<DashboardMode>) => {
        this._activeTab = e.detail;
      }}
      @edit-mode-toggle=${(e: CustomEvent<{ editMode: boolean }>) => {
        this._editMode = e.detail.editMode;
      }}
    ></dashboard-editor-header>

    ${this._renderTabContent()}
  `;
}

// _renderTabContent() now passes editMode:
<sheets-view
  .config=${this.config}
  .isNew=${this.isNew}
  .slug=${this.slug}
  .editMode=${this._editMode}
></sheets-view>
```

---

## Complete updated `dashboard-editor.ts`

```ts
import '../ask-clarification';
import '../ask-input';
import '../ask-result';
import '../dashboard-editor-header';
import '../sheet-editor';
import '../sheets-view';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { AskOrchestrator } from '../../ask-orchestrator';
import { createDashboardOrchestrator } from '../../create-dashboard-orchestrator';
import type {
  AskResult,
  AskSuccessResult,
  Clarification,
  ClarificationChoice,
  DashboardConfig,
} from '../../types';
import type { DashboardMode } from '../dashboard-editor-header/dashboard-editor-header';

function isAskSuccess(result: AskResult): result is AskSuccessResult {
  return 'rows' in result && 'sql' in result && 'chartType' in result;
}

export class DashboardEditor extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    slug: { type: String },
    isNew: { type: Boolean },
    _activeTab: { state: true },
    _editMode: { state: true },
    _askQuestion: { state: true },
    _askResult: { state: true },
    _askLoading: { state: true },
    _askError: { state: true },
    _askClarification: { state: true },
  };

  config: DashboardConfig | null = null;
  slug = '';
  isNew = false;

  private _activeTab: DashboardMode = 'dashboard';
  private _editMode = false;
  private _askQuestion = '';
  private _askResult: AskSuccessResult | null = null;
  private _askLoading = false;
  private _askError = '';
  private _askClarification: Clarification | null = null;
  private _orchestrator: AskOrchestrator | null = null;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _getOrchestrator(): AskOrchestrator | null {
    if (!this.config) return null;
    if (!this._orchestrator) {
      this._orchestrator = createDashboardOrchestrator(this.config);
    }
    return this._orchestrator;
  }

  private async _ensureDataReady(): Promise<void> {
    const orchestrator = this._getOrchestrator();
    if (!orchestrator) return;
    await orchestrator.initialize();
  }

  private async _runAsk(
    appliedClarification: Clarification['pending'] | null = null,
  ): Promise<void> {
    await this._ensureDataReady();
    const orchestrator = this._getOrchestrator();
    if (!orchestrator) return;
    this._askLoading = true;
    this._askError = '';
    this._askClarification = null;
    this._askResult = null;
    try {
      const result = await orchestrator.ask(
        this._askQuestion,
        appliedClarification ? { clarification: appliedClarification } : undefined,
      );
      if ('clarification' in result) this._askClarification = result.clarification;
      else if ('error' in result) this._askError = result.error;
      else if (isAskSuccess(result)) this._askResult = result;
    } catch (err: unknown) {
      console.error(err);
      this._askError = String(err);
    } finally {
      this._askLoading = false;
    }
  }

  private _chooseClarification(choice: ClarificationChoice): void {
    const pending = this._askClarification?.pending;
    if (!pending) return;
    this._askQuestion = pending.originalQuestion || this._askQuestion;
    this._runAsk({
      ...pending,
      fieldId: choice.fieldId,
      value: choice.value,
      valueNormalized: choice.valueNormalized,
    }).catch(console.error);
  }

  private _renderAskData(): TemplateResult {
    const c = this.config;
    if (!c) return html``;
    return html`
      <main class="ask-page">
        <ask-input
          .question=${this._askQuestion}
          .examples=${c.askData.examples || []}
          .loading=${this._askLoading}
          @question-change=${(e: CustomEvent<string>) => {
            this._askQuestion = e.detail;
          }}
          @ask=${() => {
            this._runAsk().catch(console.error);
          }}
          @example-select=${(e: CustomEvent<string>) => {
            this._askQuestion = e.detail;
            this._askError = '';
            this._askClarification = null;
            this._askResult = null;
            this.updateComplete.then(() => {
              const input = this.querySelector<HTMLInputElement>('.ask-input-row input');
              input?.focus();
              input?.classList.add('input-prefilled');
              setTimeout(() => input?.classList.remove('input-prefilled'), 800);
            });
          }}
        ></ask-input>

        ${this._askError ? html`<div class="warning">${this._askError}</div>` : nothing}

        <ask-clarification
          .clarification=${this._askClarification}
          @choice-select=${(e: CustomEvent<ClarificationChoice>) =>
            this._chooseClarification(e.detail)}
        ></ask-clarification>

        <ask-result .result=${this._askResult}></ask-result>
      </main>
    `;
  }

  private _renderTabContent(): TemplateResult {
    if (this._activeTab === 'askData') {
      return html`
        <div id="panel-ask-data" role="tabpanel" aria-labelledby="tab-ask-data" tabindex="0">
          ${this._renderAskData()}
        </div>
      `;
    }
    return html`
      <div id="panel-dashboard" role="tabpanel" aria-labelledby="tab-dashboard" tabindex="0">
        <sheets-view
          .config=${this.config}
          .isNew=${this.isNew}
          .slug=${this.slug}
          .editMode=${this._editMode}
        ></sheets-view>
      </div>
    `;
  }

  override render(): TemplateResult {
    const c = this.config;
    return html`
      <top-nav .dashboardSlug=${this.slug}></top-nav>

      <dashboard-editor-header
        .title=${c?.title ?? ''}
        .subtitle=${c?.subtitle ?? ''}
        .mode=${this._activeTab}
        .editMode=${this._editMode}
        @mode-change=${(e: CustomEvent<DashboardMode>) => {
          this._activeTab = e.detail;
        }}
        @edit-mode-toggle=${(e: CustomEvent<{ editMode: boolean }>) => {
          this._editMode = e.detail.editMode;
        }}
      ></dashboard-editor-header>

      ${this._renderTabContent()}
    `;
  }
}

if (!customElements.get('dashboard-editor')) {
  customElements.define('dashboard-editor', DashboardEditor);
}
```

---

## Key changes explained

### `import type { DashboardMode }` from the header component

`DashboardMode = 'dashboard' | 'askData'` is now defined in `dashboard-editor-header.ts` and imported here. The string values are **identical** to the old inline type in `dashboard-editor.ts` (`'dashboard' | 'askData'`), so no runtime change occurs.

### `_editMode` private state added

```ts
private _editMode = false;
// static properties:
_editMode: { state: true },
```

The initial value is `false` (view mode). When the user clicks Edit in the header, `_editMode` becomes `true` and re-renders the header (Done Editing) and the sheets-view (edit canvas).

### `top-nav` call simplified

```ts
// Before:
<top-nav
  .activeTab=${this._activeTab}
  .subtitle=${subtitle}
  .dashboardSlug=${this.slug}
  .showTabs=${true}
  @tab-change=${...}
></top-nav>

// After:
<top-nav .dashboardSlug=${this.slug}></top-nav>
```

`showTabs` and `activeTab` props are removed from `top-nav` in issue 05. Using `.dashboardSlug` alone is sufficient for the back button.

### `sheets-view` now receives `editMode`

```ts
<sheets-view
  .config=${this.config}
  .isNew=${this.isNew}
  .slug=${this.slug}
  .editMode=${this._editMode}   // ← new
></sheets-view>
```

After issue 03, `sheets-view.editMode` is a pure prop — setting it from here is the only way edit mode changes.

---

## Update `dashboard-editor.stories.ts`

The stories file needs updating to reflect the new component contract. The `subtitle` arg is no longer passed through `top-nav`; instead the header displays it.

```ts
import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { DashboardConfig } from '../../types';

type DashboardEditorArgs = {
  config: DashboardConfig | null;
  slug: string;
  isNew: boolean;
};

const EMPTY_CONFIG: DashboardConfig = {
  title: 'Sample Dashboard',
  subtitle: 'Your Data, Any Data, Instantly Explained',
  dataSources: [],
  askData: { defaultQuestion: 'Show me total sales' },
  filters: [],
  kpis: [],
  charts: [],
  tables: [],
  layout: [],
};

const meta = {
  title: 'Templates/Dashboard Editor',
  component: 'dashboard-editor',
  tags: ['autodocs', '!test'],
  render: ({ config, slug, isNew }: DashboardEditorArgs) =>
    html`<dashboard-editor .config=${config} .slug=${slug} .isNew=${isNew}></dashboard-editor>`,
  argTypes: {
    config: {
      control: 'object',
      description: '`DashboardConfig` loaded from the registry. `null` renders an empty shell.',
    },
    slug: {
      control: 'text',
      description: 'URL slug identifying the dashboard; used by the top-nav back-link.',
      table: { defaultValue: { summary: '""' } },
    },
    isNew: {
      control: 'boolean',
      description:
        'When `true` a blank sheet is created instead of loading persisted sheets from localStorage.',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    config: EMPTY_CONFIG,
    slug: 'sample-dashboard',
    isNew: true,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Template-level composition for the dashboard workspace. ' +
          'Renders the global top nav (brand + back link), the dashboard editor header ' +
          '(title, mode switcher, edit toggle), and the active panel (canvas or Ask Data). ' +
          'Mode and edit state are owned internally and driven by the header component events.',
      },
    },
  },
} satisfies Meta<DashboardEditorArgs>;

export default meta;
type Story = StoryObj<DashboardEditorArgs>;

export const DashboardTab: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'New dashboard opened in Editor mode — empty canvas visible, ' +
          'header shows "Editor" button active and an "Edit" toggle.',
      },
    },
  },
};

export const AskDataConfig: Story = {
  name: 'Ask Data config (shell)',
  args: {
    config: {
      ...EMPTY_CONFIG,
      askData: {
        defaultQuestion: 'What are total sales by region?',
        examples: ['Total sales', 'Sales by region', 'Top 5 products'],
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dashboard with example questions configured. ' +
          'Switch to Ask Data mode using the header mode buttons to see the ask interface. ' +
          'Submitting a query will initialise DuckDB — use with a real data source.',
      },
    },
  },
};

export const NoConfig: Story = {
  args: { config: null },
  globals: { a11y: { manual: true } },
  parameters: {
    docs: {
      description: { story: '`config` is `null` — renders the nav and header with empty title.' },
    },
  },
};
```

---

## Accessibility note

The `tabpanel` role attributes on the content panels (`id="panel-dashboard"`, `id="panel-ask-data"`) reference `aria-labelledby` pointing to `tab-dashboard` and `tab-ask-data` IDs. These IDs no longer exist in the nav — they are now on the mode buttons inside `dashboard-editor-header`.

Update the `aria-labelledby` values **or** the button IDs to match. The simplest fix is to add matching `id` attributes to the buttons in `dashboard-editor-header`:

```ts
// In dashboard-editor-header render():
<button id="tab-dashboard" ... >Editor</button>
<button id="tab-ask-data"  ... >Ask Data</button>
```

This makes the `aria-labelledby` on the panels in `_renderTabContent()` still valid without any change to `dashboard-editor.ts`.

---

## Checklist before marking done

- [ ] `import '../dashboard-editor-header'` added to `dashboard-editor.ts`
- [ ] `import type { DashboardMode }` from header component added
- [ ] `_editMode: { state: true }` added to `static properties` and class body
- [ ] `_activeTab` typed as `DashboardMode` (same string values, now from the shared type)
- [ ] `<top-nav>` receives only `.dashboardSlug` — no `showTabs`, `activeTab`, `subtitle`, or `tab-change`
- [ ] `<dashboard-editor-header>` rendered with all 4 props and 2 event handlers
- [ ] `<sheets-view>` receives `.editMode=${this._editMode}`
- [ ] Button IDs on mode buttons in `dashboard-editor-header` (`id="tab-dashboard"`, `id="tab-ask-data"`) added for `aria-labelledby` compatibility
- [ ] `dashboard-editor.stories.ts` updated (subtitle arg removed, descriptions updated)
- [ ] `npx tsc --noEmit` passes
- [ ] Manual test: clicking Edit / Done Editing toggles canvas edit state
- [ ] Manual test: clicking Ask Data switches to ask interface; clicking Editor returns to canvas

## What is NOT done in this issue

- Removing `showTabs` / `activeTab` props from `top-nav.ts` (issue 05) — at this point `top-nav` still has those props; passing fewer props to it is backwards-compatible and will not break anything.
- CSS import wiring (issue 06)
