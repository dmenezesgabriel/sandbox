import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

type AskInputArgs = {
  question: string;
  examples: string[];
  loading: boolean;
  onAsk: (e: Event) => void;
  onQuestionChange: (value: string) => void;
  onExampleSelect: (value: string) => void;
};

const meta = {
  title: 'Molecules/Ask Input',
  component: 'ask-input',
  tags: ['autodocs'],
  render: ({
    question,
    examples,
    loading,
    onAsk,
    onQuestionChange,
    onExampleSelect,
  }: AskInputArgs) => html`
    <ask-input
      .question=${question}
      .examples=${examples}
      .loading=${loading}
      @ask=${onAsk}
      @question-change=${(e: CustomEvent<string>) => onQuestionChange(e.detail)}
      @example-select=${(e: CustomEvent<string>) => onExampleSelect(e.detail)}
    ></ask-input>
  `,
  argTypes: {
    question: {
      control: 'text',
      description: 'Controlled value of the question input field.',
      table: { defaultValue: { summary: '""' } },
    },
    loading: {
      control: 'boolean',
      description:
        'Shows a spinner inside the Ask button and disables it while a query is in flight.',
      table: { defaultValue: { summary: 'false' } },
    },
    examples: {
      control: 'object',
      description:
        'Suggested question strings rendered as reusable choice-button atoms below the field.',
    },
    onAsk: {
      action: 'ask',
      description: 'Fired when the user clicks Ask or presses Enter. Carries no payload.',
      table: { category: 'Events' },
    },
    onQuestionChange: {
      action: 'question-change',
      description: 'Fired on every keystroke. The `detail` is the current input string.',
      table: { category: 'Events' },
    },
    onExampleSelect: {
      action: 'example-select',
      description: 'Fired when an example chip is clicked. The `detail` is the example string.',
      table: { category: 'Events' },
    },
  },
  args: {
    question: '',
    loading: false,
    examples: ['sales by region', 'top 10 customers', 'revenue last quarter'],
    onAsk: fn(),
    onQuestionChange: fn(),
    onExampleSelect: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Molecule composed from the text-field and button atoms. ' +
          'Exposes three events — `ask`, `question-change`, and `example-select` — ' +
          'and delegates all state management to the parent so it stays fully controlled. ' +
          'Choice-button examples below the field can be swapped per dataset.',
      },
    },
  },
  decorators: [(story) => html`<div style="max-width:640px;margin:2rem auto;">${story()}</div>`],
} satisfies Meta<AskInputArgs>;

export default meta;
// StoryObj<typeof meta> doesn't propagate args for string component refs in web-components;
// use the concrete args type directly.
type Story = StoryObj<AskInputArgs>;

export const Default: Story = {
  parameters: {
    docs: { description: { story: 'Idle state with an empty input and three example chips.' } },
  },
};

export const WithQuestion: Story = {
  args: { question: 'total revenue by product category' },
  parameters: {
    docs: {
      description: {
        story:
          'Input pre-filled with a question — mirrors the controlled state after the user types.',
      },
    },
  },
};

export const Loading: Story = {
  args: { question: 'sales by region', loading: true },
  parameters: {
    docs: {
      description: {
        story:
          'Ask button disabled with an inline spinner; `aria-live` region announces "Processing your question…" to screen readers.',
      },
    },
  },
  play: async ({ canvas, step }) => {
    await step('Keep submission disabled while loading', async () => {
      const button = canvas.getByRole('button', { name: /asking/i });
      await expect(button).toBeDisabled();
    });

    await step('Announce loading progress accessibly', async () => {
      await expect(canvas.getByText('Processing your question…')).toBeInTheDocument();
      await expect(canvas.queryByRole('button', { name: /^ask$/i })).not.toBeInTheDocument();
    });
  },
};

export const NoExamples: Story = {
  args: { examples: [] },
  parameters: {
    docs: {
      description: {
        story: 'Component without example chips — for datasets where no curated suggestions exist.',
      },
    },
  },
};

export const TypeAndSubmit: Story = {
  name: 'Interaction — Type & Submit',
  tags: ['!autodocs'],
  play: async ({ canvas, args, step }) => {
    await step('Type a question into the input', async () => {
      const input = canvas.getByRole('textbox', { name: /ask your data/i });
      await userEvent.clear(input);
      await userEvent.type(input, 'monthly revenue');
      await expect(args.onQuestionChange).toHaveBeenCalled();
    });

    await step('Click the Ask button and assert the event fires', async () => {
      const button = canvas.getByRole('button', { name: /ask/i });
      await userEvent.click(button);
      await expect(args.onAsk).toHaveBeenCalledOnce();
    });
  },
};

export const EnterKeySubmit: Story = {
  name: 'Interaction — Enter Key Submit',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('textbox', { name: /ask your data/i });
    await userEvent.type(input, 'top 5 products{Enter}');
    await expect(args.onAsk).toHaveBeenCalledOnce();
  },
};

export const SelectExample: Story = {
  name: 'Interaction — Select Example',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const chip = canvas.getByRole('button', { name: 'sales by region' });
    await userEvent.click(chip);
    await expect(args.onExampleSelect).toHaveBeenCalledWith('sales by region');
  },
};
