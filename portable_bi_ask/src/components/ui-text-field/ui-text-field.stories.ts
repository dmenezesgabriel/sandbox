import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

type UITextFieldArgs = {
  value: string;
  placeholder: string;
  appearance: 'default' | 'prominent';
  disabled: boolean;
  accessibleLabel: string;
  onValueChange: (value: string) => void;
  onEnterPress: () => void;
};

const meta = {
  title: 'Atoms/Text Field',
  component: 'ui-text-field',
  tags: ['autodocs'],
  render: ({
    value,
    placeholder,
    appearance,
    disabled,
    accessibleLabel,
    onValueChange,
    onEnterPress,
  }: UITextFieldArgs) => html`
    <div style="width: 320px;">
      <ui-text-field
        .value=${value}
        .placeholder=${placeholder}
        .appearance=${appearance}
        .disabled=${disabled}
        .accessibleLabel=${accessibleLabel}
        @value-change=${(event: CustomEvent<string>) => onValueChange(event.detail)}
        @enter-press=${onEnterPress}
      ></ui-text-field>
    </div>
  `,
  args: {
    value: '',
    placeholder: 'Type a question',
    appearance: 'default' as const,
    disabled: false,
    accessibleLabel: 'Question',
    onValueChange: fn(),
    onEnterPress: fn(),
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'Controlled input value.',
    },
    placeholder: {
      control: 'text',
      description: 'Native placeholder text.',
    },
    appearance: {
      control: 'select',
      options: ['default', 'prominent'],
      description: 'Default form field or the larger ask-input treatment.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables editing and focus.',
    },
    accessibleLabel: {
      control: 'text',
      description: 'Required accessible name when the field has no visible label.',
    },
    onValueChange: {
      action: 'value-change',
      description: 'Emits the latest string on every input event.',
      table: { category: 'Events' },
    },
    onEnterPress: {
      action: 'enter-press',
      description: 'Emits when the user presses Enter inside the field.',
      table: { category: 'Events' },
    },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Text-input atom for free-form user input. Use the `prominent` appearance for search/ask surfaces and the default appearance inside labeled forms.',
      },
    },
  },
} satisfies Meta<UITextFieldArgs>;

export default meta;
type Story = StoryObj<UITextFieldArgs>;

export const Default: Story = {};

export const Prominent: Story = {
  args: {
    appearance: 'prominent',
    placeholder: 'sales by region',
    accessibleLabel: 'Ask your data',
  },
};

export const Interaction: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: /question/i });
    await userEvent.type(input, 'revenue');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalled();
    await expect(args.onEnterPress).toHaveBeenCalled();
  },
};
