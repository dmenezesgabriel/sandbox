import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { Clarification, ClarificationChoice } from '../../../../shared/types/index';

type AskClarificationArgs = {
  clarification: Clarification | null;
  onChoiceSelect: (choice: ClarificationChoice) => void;
};

const fieldAmbiguity: Clarification = {
  message: 'I found multiple fields matching "sales". Which one did you mean?',
  pending: {
    slot: 'field',
    originalQuestion: 'show me sales by region',
    phrase: 'sales',
  },
  choices: [
    { label: 'Sales (revenue)', fieldId: 'sales.Sales' },
    { label: 'Sales Count', fieldId: 'sales.SalesCount' },
    { label: 'Order Count', fieldId: 'orders.OrderCount' },
  ],
};

const filterAmbiguity: Clarification = {
  message: 'Did you mean a specific region when you said "west"?',
  pending: {
    slot: 'filterField',
    originalQuestion: 'sales in west',
    phrase: 'west',
    value: 'west',
  },
  choices: [
    { label: 'West', fieldId: 'customer.Region', value: 'West' },
    { label: 'West Coast', fieldId: 'customer.Zone', value: 'West Coast' },
  ],
};

const meta = {
  title: 'Molecules/Ask Clarification',
  component: 'ask-clarification',
  tags: ['autodocs'],
  render: ({ clarification, onChoiceSelect }: AskClarificationArgs) =>
    html`<ask-clarification
      .clarification=${clarification}
      @choice-select=${(e: CustomEvent<ClarificationChoice>) => onChoiceSelect(e.detail)}
    ></ask-clarification>`,
  argTypes: {
    clarification: {
      control: 'object',
      description:
        'The clarification request from the query parser. Passing `null` renders nothing (component stays invisible).',
    },
    onChoiceSelect: {
      action: 'choice-select',
      description:
        'Fired when the user clicks a choice. `detail` is the selected `ClarificationChoice`.',
      table: { category: 'Events' },
    },
  },
  args: {
    clarification: fieldAmbiguity,
    onChoiceSelect: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Disambiguation card shown when the query parser cannot resolve an ambiguous field or filter value. ' +
          'Renders nothing when `clarification` is `null`.',
      },
    },
  },
} satisfies Meta<AskClarificationArgs>;

export default meta;
type Story = StoryObj<AskClarificationArgs>;

export const FieldAmbiguity: Story = {
  parameters: {
    docs: {
      description: { story: 'Multiple metric fields matched the same phrase — user picks one.' },
    },
  },
};

export const FilterAmbiguity: Story = {
  name: 'Filter Value Ambiguity',
  args: { clarification: filterAmbiguity },
  parameters: {
    docs: { description: { story: 'Ambiguous filter value with two candidate matches.' } },
  },
};

export const Empty: Story = {
  args: { clarification: null },
  globals: { a11y: { manual: true } },
  parameters: {
    docs: {
      description: {
        story: '`null` clarification — component renders nothing (expected blank canvas).',
      },
    },
  },
};

export const SelectChoice: Story = {
  name: 'Interaction — Pick a Choice',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Sales (revenue)' });
    await userEvent.click(btn);
    await expect(args.onChoiceSelect).toHaveBeenCalledOnce();
  },
};
