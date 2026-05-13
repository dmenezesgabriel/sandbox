import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

type UIButtonArgs = {
  variant: 'primary' | 'secondary' | 'choice';
  size: 'sm' | 'md' | 'lg';
  disabled: boolean;
  label: string;
  onClick: (event: MouseEvent) => void;
};

const meta = {
  title: 'Atoms/Button',
  component: 'ui-button',
  tags: ['autodocs'],
  render: ({ variant, size, disabled, label, onClick }: UIButtonArgs) => html`
    <ui-button
      .variant=${variant}
      .size=${size}
      .disabled=${disabled}
      .content=${label}
      @click=${onClick}
    ></ui-button>
  `,
  args: {
    variant: 'primary' as const,
    size: 'md' as const,
    disabled: false,
    label: 'Save changes',
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'choice'],
      description: 'Visual treatment used across page shells, forms, and action strips.',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Spacing scale for compact toolbars, regular forms, or hero actions.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the underlying native button element.',
    },
    label: {
      control: 'text',
      description: 'Visible button text rendered through the default slot.',
    },
    onClick: {
      action: 'click',
      description: 'Native click event emitted from the underlying button.',
      table: { category: 'Events' },
    },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Context-agnostic button atom used by forms, cards, toolbars, and dialogs. ' +
          'Prefer this over feature-specific button markup when the action only differs by label, size, or emphasis.',
      },
    },
  },
} satisfies Meta<UIButtonArgs>;

export default meta;
type Story = StoryObj<UIButtonArgs>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Cancel' },
};

export const Choice: Story = {
  args: { variant: 'choice', label: 'West region' },
};

export const CompactToolbarAction: Story = {
  args: { variant: 'secondary', size: 'sm', label: 'Export CSV' },
};

export const Interaction: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole('button', { name: /save changes/i });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
