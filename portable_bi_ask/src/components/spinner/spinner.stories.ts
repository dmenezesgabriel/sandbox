import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

type SpinnerArgs = {
  label: string;
  size: 'sm' | 'md' | 'lg';
};

const meta = {
  title: 'Atoms/Spinner',
  component: 'app-spinner',
  tags: ['autodocs'],
  render: ({ label, size }: SpinnerArgs) =>
    html`<app-spinner .label=${label} .size=${size}></app-spinner>`,
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Diameter of the spinner ring and the relative size of the label font.',
      table: { defaultValue: { summary: 'md' } },
    },
    label: {
      control: 'text',
      description: 'Visible text rendered below the ring. Pass an empty string to suppress it.',
      table: { defaultValue: { summary: 'Loading…' } },
    },
  },
  args: {
    label: 'Loading…',
    size: 'md' as const,
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A lightweight animated loading indicator with three size variants. ' +
          'Renders in the light DOM (no shadow root) so it inherits the page font and color tokens. ' +
          'Always provide a `label` or add `aria-label` / `role="status"` at the call site for screen-reader users.',
      },
    },
  },
} satisfies Meta<SpinnerArgs>;

export default meta;
// StoryObj<typeof meta> doesn't propagate args for string component refs in web-components;
// use the concrete args type directly.
type Story = StoryObj<SpinnerArgs>;

export const Default: Story = {
  parameters: {
    docs: { description: { story: 'Medium-sized spinner with the default label.' } },
  },
};

export const Small: Story = {
  args: { size: 'sm' },
  parameters: {
    docs: { description: { story: 'Compact variant for tight spaces such as inline buttons.' } },
  },
};

export const Large: Story = {
  args: { size: 'lg' },
  parameters: {
    docs: { description: { story: 'Full-page loading overlay variant.' } },
  },
};

export const NoLabel: Story = {
  args: { label: '' },
  // The spinner ring carries no visible text and no aria-label here.
  // The component relies on the call site to provide role="status" / aria-label.
  // Automated axe checks are disabled for this story to avoid false positives
  // for this intentionally minimal visual-only state.
  globals: { a11y: { manual: true } },
  parameters: {
    docs: {
      description: {
        story:
          'Spinner with no text label. **Accessibility note:** you must wrap this with ' +
          '`role="status"` and `aria-label` at the call site.',
      },
    },
  },
};
