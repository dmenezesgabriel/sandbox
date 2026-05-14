import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta = {
  title: 'Design System/Overview',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Living guidance for this repo's component taxonomy and lightweight contribution rules. " +
          'Use it alongside the component stories when deciding where new UI belongs and whether an existing pattern should be extended.',
      },
    },
  },
  render: () => html`
    <article style="max-width: 860px; margin: 0 auto; display: grid; gap: 1rem; line-height: 1.6;">
      <section>
        <h2>Atomic taxonomy in this repo</h2>
        <ul>
          <li>
            <strong>Atoms</strong>: primitive controls and loading states (<code>ui-button</code>,
            <code>ui-text-field</code>, <code>app-spinner</code>, <code>skeleton-loader</code>).
          </li>
          <li>
            <strong>Molecules</strong>: focused combinations of atoms with one clear job
            (<code>ask-input</code>, <code>ask-clarification</code>).
          </li>
          <li>
            <strong>Organisms</strong>: larger interactive sections that coordinate multiple states
            (<code>widget</code>, <code>top-nav</code>, <code>widget-editor</code>,
            <code>dashboard-canvas</code>, <code>dashboard-list</code>, <code>ask-result</code>).
          </li>
          <li>
            <strong>Templates</strong>: layout-level compositions (<code>dashboard-workspace</code>,
            <code>dashboard-editor</code>).
          </li>
          <li><strong>Pages</strong>: route-level instances (<code>app-dashboard</code>).</li>
        </ul>
      </section>
      <section>
        <h2>How to add or change patterns</h2>
        <ol>
          <li>
            Prefer extending an existing atom or organism before inventing a new feature-specific
            variant.
          </li>
          <li>Add a representative Storybook state before refactoring risky behavior.</li>
          <li>
            Keep decision logic pure when possible; keep DOM, storage, and browser APIs in thin
            shells.
          </li>
          <li>Name shared pieces by structure and role, not by a single screen.</li>
        </ol>
      </section>
    </article>
  `,
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Taxonomy: Story = {};

export const Governance: Story = {
  render: () => html`
    <article style="max-width: 860px; margin: 0 auto; display: grid; gap: 1rem; line-height: 1.6;">
      <section>
        <h2>Lightweight governance</h2>
        <ul>
          <li>
            <strong>Modify the system first</strong>: if a page-specific workaround would help
            several screens, fix the shared pattern instead.
          </li>
          <li>
            <strong>Add patterns only for real variation</strong>: new components should represent a
            new responsibility, not just a one-off label or color.
          </li>
          <li>
            <strong>Deprecate visibly</strong>: update Storybook docs and stories when a pattern is
            being replaced.
          </li>
          <li>
            <strong>Protect behavior with tests</strong>: keep pure helpers under unit test and use
            story interactions for user-facing flows.
          </li>
        </ul>
      </section>
      <section>
        <h2>Review checklist</h2>
        <ul>
          <li>Does the component live at the right atomic level?</li>
          <li>Can this be expressed as a variant of an existing atom/molecule?</li>
          <li>Are loading, empty, and realistic-content states documented?</li>
          <li>Is the change easier to understand because logic and side effects are separated?</li>
        </ul>
      </section>
    </article>
  `,
};
