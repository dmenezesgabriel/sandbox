# 05 — Simplify `top-nav`: remove tab props and tab CSS

## Context

`top-nav` currently owns the "Editor / Ask Data" tab switcher and exports the `ActiveTab` type used throughout the editor. After issue 04, `dashboard-editor` no longer passes `showTabs` or `activeTab` to `<top-nav>` and instead renders those controls through `<dashboard-editor-header>`.

This issue removes the dead tab-related code from the component, its CSS, its stories, and fixes the one other caller that still passes `showTabs={false}` (`dashboard.ts`).

> **Dependency**: issue 04 must be complete. `dashboard-editor` must no longer pass `showTabs`, `activeTab`, or `@tab-change` to `<top-nav>` before those props are deleted here.

---

## Files changed

1. `src/components/top-nav/top-nav.ts` — remove tab props, methods, event, and type export
2. `src/components/top-nav/top-nav.stories.ts` — remove tab stories, add simpler coverage
3. `src/components/dashboard/dashboard.ts` — remove `.showTabs=${false}` from list-view nav
4. `src/styles/topnav.css` — remove the `/* Tabs */` CSS section

---

## 1 · `src/components/top-nav/top-nav.ts`

### What is removed

| Symbol                                                          | Reason                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `export type ActiveTab`                                         | Moved to `dashboard-editor-header.ts` as `DashboardMode` |
| `activeTab` property                                            | No longer received from any caller                       |
| `showTabs` property                                             | No longer received from any caller                       |
| `_select()` method                                              | Fired `tab-change`; no tabs to select                    |
| `_tabClass()` method                                            | Computed CSS class for active tab                        |
| `tab-change` CustomEvent                                        | Replaced by `mode-change` from `dashboard-editor-header` |
| `isInDashboard` branch that renders `<div class="topnav-tabs">` | Tabs no longer in nav                                    |

### What is kept

- `brand` property
- `subtitle` property (still used on the list page if needed)
- `dashboardSlug` property (drives the back button)
- `_goBack()` method
- Back button render (when `dashboardSlug` is set)
- Wordmark link
- Glow div

### Updated `isInDashboard` logic

```ts
// Before:
const isInDashboard = !!this.dashboardSlug || this.showTabs;

// After:
const isInDashboard = !!this.dashboardSlug;
```

### Complete updated file

```ts
import { html, LitElement, type TemplateResult } from 'lit';
import { ArrowLeft } from 'lucide';

import { icon } from '../../icons';

export class TopNav extends LitElement {
  static override readonly properties = {
    brand: { type: String },
    subtitle: { type: String },
    dashboardSlug: { type: String },
  };

  brand = 'DataTalks';
  subtitle = '';
  dashboardSlug = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _goBack(): void {
    window.location.hash = '#/';
  }

  override render(): TemplateResult {
    const isInDashboard = !!this.dashboardSlug;

    return html`
      <nav class="topnav" aria-label="Main navigation">
        <div class="topnav-inner">
          <div class="topnav-brand">
            <span class="topnav-mark" aria-hidden="true"></span>
            ${isInDashboard
              ? html`
                  <button
                    class="topnav-back"
                    @click=${this._goBack}
                    aria-label="Back to Dashboards"
                    title="Back to Dashboards"
                  >
                    ${icon(ArrowLeft, { size: 18 })}
                  </button>
                `
              : ''}
            <a class="topnav-wordmark" href="#/">DataTalks</a>
            ${this.subtitle ? html`<span class="topnav-subtitle">${this.subtitle}</span>` : ''}
          </div>
        </div>
        <div class="topnav-glow" aria-hidden="true"></div>
      </nav>
    `;
  }
}

if (!customElements.get('top-nav')) {
  customElements.define('top-nav', TopNav);
}
```

---

## 2 · `src/components/dashboard/dashboard.ts`

On the list route (line 118), `<top-nav>` is rendered with `.showTabs=${false}`. After removing `showTabs`, this call must be simplified:

```ts
// Before (line 118):
<top-nav .showTabs=${false}></top-nav>

// After:
<top-nav></top-nav>
```

No other changes to `dashboard.ts` are needed.

---

## 3 · `src/components/top-nav/top-nav.stories.ts`

### Remove

- `activeTab` arg, argType, and all references
- `showTabs` arg, argType, and all references
- `onTabChange` arg, argType, and all references
- `EditorActive` story
- `AskDataActive` story
- `TabSwitch` interaction story
- `ActiveTab` type import

### Replace with

Two simple stories covering the only two meaningful states:

- `Default` — list-page nav: no back button, optional subtitle
- `InDashboard` — dashboard nav: back button visible, no subtitle

### Updated file

```ts
import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent } from 'storybook/test';

type TopNavArgs = {
  brand: string;
  subtitle: string;
  dashboardSlug: string;
};

const meta = {
  title: 'Organisms/Top Nav',
  component: 'top-nav',
  tags: ['autodocs'],
  render: ({ brand, subtitle, dashboardSlug }: TopNavArgs) =>
    html`<top-nav .brand=${brand} .subtitle=${subtitle} .dashboardSlug=${dashboardSlug}></top-nav>`,
  argTypes: {
    brand: {
      control: 'text',
      description: 'Brand name shown in the wordmark.',
      table: { defaultValue: { summary: 'DataTalks' } },
    },
    subtitle: {
      control: 'text',
      description: 'Optional subtitle displayed after the brand name.',
      table: { defaultValue: { summary: '""' } },
    },
    dashboardSlug: {
      control: 'text',
      description: 'When non-empty, a back-arrow button is rendered to the left of the wordmark.',
      table: { defaultValue: { summary: '""' } },
    },
  },
  args: {
    brand: 'DataTalks',
    subtitle: 'Your Data, Any Data, Instantly Explained',
    dashboardSlug: '',
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global navigation bar. Renders the brand mark, wordmark, and an optional subtitle. ' +
          'When `dashboardSlug` is non-empty a back-to-list arrow button appears. ' +
          'Mode switching (Editor / Ask Data) and edit controls are no longer in this component — ' +
          'they live in `dashboard-editor-header`.',
      },
    },
  },
} satisfies Meta<TopNavArgs>;

export default meta;
type Story = StoryObj<TopNavArgs>;

export const Default: Story = {
  name: 'List Page (No Back Button)',
  parameters: {
    docs: {
      description: {
        story: 'Nav on the dashboard-list page — brand and subtitle only.',
      },
    },
  },
};

export const InDashboard: Story = {
  name: 'Inside a Dashboard',
  args: {
    dashboardSlug: 'sales-overview',
    subtitle: '',
  },
  parameters: {
    docs: {
      description: {
        story: 'Nav when a dashboard is open — back arrow visible, no subtitle.',
      },
    },
  },
};

export const ClickBack: Story = {
  name: 'Interaction — Back Button',
  tags: ['!autodocs'],
  args: { dashboardSlug: 'sales-overview', subtitle: '' },
  play: async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Back to Dashboards' });
    await expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    // Navigation is a side-effect (hash change); verify the button is accessible.
  },
};
```

---

## 4 · `src/styles/topnav.css`

Remove the entire `/* Tabs */` section. These classes are no longer rendered:

```css
/* DELETE: lines ~90–152 */

/* Tabs */

.topnav-tabs {
  display: flex;
  gap: 0;
  align-items: stretch;
  height: 100%;
  margin-left: auto;
}

.topnav-tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-lg);
  border: none;
  background: none;
  color: var(--topnav-text-muted);
  /* ... */
}

.topnav-tab:hover {
  /* ... */
}

.topnav-tab-active {
  /* ... */
}

.topnav-tab-active::after {
  /* ... animation: tab-underline-in ... */
}

.topnav-tab:focus-visible {
  /* ... */
}

.topnav-tab-text {
  /* ... */
}
```

Also remove the responsive override for `.topnav-tab` inside the `@media` block at the bottom:

```css
/* DELETE from the @media (width <= 640px) block: */
.topnav-tab {
  padding: 0 0.85rem;
  font-size: var(--text-base);
}
```

### What remains in `topnav.css` (keep everything else)

- `.topnav` (sticky container)
- `.topnav-inner` (flex row)
- `.topnav-brand`, `.topnav-mark`, `.topnav-mark::after`
- `.topnav-wordmark`, `.topnav-wordmark:hover`
- `.topnav-subtitle`
- `.topnav-glow`
- `.topnav-back`, `.topnav-back:hover`
- Responsive overrides for `.topnav-inner`, `.topnav-subtitle`, `.topnav-wordmark`

### Note on `tab-underline-in` animation

The `@keyframes tab-underline-in` is defined in `src/styles/animations.css` and referenced only by `.topnav-tab-active::after`. After removing that CSS block, the keyframe becomes unused but is **harmless** — do not delete it from `animations.css` since it may be reused in future components (e.g., the mode buttons in `dashboard-editor-header` if an underline style is preferred over the current pill style).

---

## Verify no remaining usages

After completing the changes, run a search to confirm no remaining callers pass the removed props:

```sh
grep -rn "showTabs\|activeTab\|tab-change\|ActiveTab" src/ --include="*.ts"
```

Expected output: zero matches.

Also verify the CSS classes are gone from the DOM in the running app:

```sh
grep -rn "topnav-tab\|topnav-tabs" src/ --include="*.css"
```

Expected output: zero matches.

---

## Checklist before marking done

- [ ] `export type ActiveTab` removed from `top-nav.ts`
- [ ] `activeTab` and `showTabs` properties removed from `top-nav.ts`
- [ ] `_select()` and `_tabClass()` methods removed from `top-nav.ts`
- [ ] `tab-change` event removed from `top-nav.ts`
- [ ] `isInDashboard` simplified to `!!this.dashboardSlug`
- [ ] Tabs render block removed from `top-nav.ts` render method
- [ ] `.showTabs=${false}` removed from `dashboard.ts` list-route render
- [ ] `EditorActive`, `AskDataActive`, `TabSwitch` stories deleted from `top-nav.stories.ts`
- [ ] New `Default`, `InDashboard`, `ClickBack` stories added
- [ ] `/* Tabs */` CSS section removed from `topnav.css`
- [ ] Responsive `.topnav-tab` override removed from `topnav.css`
- [ ] `grep -rn "showTabs\|activeTab\|tab-change\|ActiveTab" src/` → zero matches
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] Storybook: all top-nav stories render without errors
