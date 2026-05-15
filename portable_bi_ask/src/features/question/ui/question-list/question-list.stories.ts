import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent, waitFor } from 'storybook/test';

type QuestionListArgs = {
  onQuestionSelect: (slug: string) => void;
  onQuestionCreate: (name: string) => void;
};

const meta = {
  title: 'Organisms/Question List',
  component: 'question-list',
  tags: ['autodocs'],
  render: ({ onQuestionSelect, onQuestionCreate }: QuestionListArgs) =>
    html`<question-list
      @question-select=${(e: CustomEvent<{ slug: string }>) => onQuestionSelect(e.detail.slug)}
      @question-create=${(e: CustomEvent<{ name: string }>) => onQuestionCreate(e.detail.name)}
    ></question-list>`,
  argTypes: {
    onQuestionSelect: {
      action: 'question-select',
      description:
        'Fired when a question card is clicked or activated. `detail.slug` identifies the question.',
      table: { category: 'Events' },
    },
    onQuestionCreate: {
      action: 'question-create',
      description:
        'Fired after the user confirms the create-question dialog. `detail.name` is the new question name.',
      table: { category: 'Events' },
    },
  },
  args: {
    onQuestionSelect: fn(),
    onQuestionCreate: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Landing page listing all available questions. ' +
          'Reads `questionList()` from the registry (YAML seeds + localStorage). ' +
          'Supports grid/list view toggle and a "New Question" modal.',
      },
    },
  },
} satisfies Meta<QuestionListArgs>;

export default meta;
type Story = StoryObj<QuestionListArgs>;

export const GridView: Story = {
  parameters: {
    docs: { description: { story: 'Default grid view showing question cards.' } },
  },
};

export const ListView: Story = {
  name: 'Interaction — Switch to List View',
  tags: ['!autodocs'],
  play: async ({ canvas }) => {
    const listBtn = canvas.getByTitle('List view');
    await userEvent.click(listBtn);
    // In list mode the cards render in a single-column layout (.question-cards.list-mode).
    // Assert the grid toggle is no longer active by checking aria-pressed on the grid button.
    const gridBtn = canvas.getByTitle('Grid view');
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(listBtn).toHaveAttribute('aria-pressed', 'true');
  },
};

export const OpenCreateModal: Story = {
  name: 'Interaction — Open Create Modal',
  tags: ['!autodocs'],
  play: async ({ canvas }) => {
    const newBtn = canvas.getByRole('button', { name: /new question/i });
    await userEvent.click(newBtn);
    await expect(canvas.findByRole('dialog')).toBeTruthy();
  },
};

export const CreateQuestion: Story = {
  name: 'Interaction — Create Question',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const newBtn = canvas.getByRole('button', { name: /new question/i });
    await userEvent.click(newBtn);
    const nameInput = await canvas.findByRole('textbox', { name: /name/i });
    await userEvent.type(nameInput, 'Monthly Revenue');
    const createBtn = canvas.getByRole('button', { name: /^create$/i });
    await userEvent.click(createBtn);
    await expect(args.onQuestionCreate).toHaveBeenCalledWith('Monthly Revenue');
  },
};

export const BlankNameValidation: Story = {
  name: 'Interaction — Blank Name Validation',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const newBtn = canvas.getByRole('button', { name: /new question/i });
    await userEvent.click(newBtn);

    const nameInput = await canvas.findByRole('textbox', { name: /name/i });
    const createBtn = canvas.getByRole('button', { name: /^create$/i });
    await userEvent.click(createBtn);

    const errorAlert = await canvas.findByRole('alert');
    await expect(args.onQuestionCreate).not.toHaveBeenCalled();
    await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(errorAlert).toHaveTextContent('Please enter a question name.');
  },
};

export const CancelCreateModalRestoresFocus: Story = {
  name: 'Interaction — Cancel Restores Focus',
  tags: ['!autodocs'],
  play: async ({ canvas }) => {
    const newBtn = canvas.getByRole('button', { name: /new question/i });
    await userEvent.click(newBtn);

    const cancelBtn = await canvas.findByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
      expect(newBtn).toHaveFocus();
    });
  },
};
