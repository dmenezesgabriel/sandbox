import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import { JAVASCRIPT, SQL } from './index';

type UiCodeEditorArgs = {
  value: string;
  readonly: boolean;
  placeholder: string;
  onValueChange: (value: string) => void;
};

const meta = {
  title: 'Atoms/Code Editor',
  component: 'ui-code-editor',
  tags: ['autodocs'],
  render: ({ value, readonly, placeholder, onValueChange }: UiCodeEditorArgs) => html`
    <div style="width: 560px;">
      <ui-code-editor
        .language=${SQL}
        .value=${value}
        .readonly=${readonly}
        .placeholder=${placeholder}
        @value-change=${(e: CustomEvent<string>) => onValueChange(e.detail)}
      ></ui-code-editor>
    </div>
  `,
  args: {
    value: 'SELECT id, name\nFROM users\nWHERE active = TRUE;',
    readonly: false,
    placeholder: 'SELECT ...',
    onValueChange: fn(),
  },
  argTypes: {
    value: { control: 'text', description: 'Editor document content.' },
    readonly: { control: 'boolean', description: 'Prevents editing.' },
    placeholder: { control: 'text', description: 'Ghost text shown when the editor is empty.' },
    onValueChange: { action: 'value-change', table: { category: 'Events' } },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Generic CodeMirror 6 editor wrapped as a Lit web component. Pass any CodeMirror `Extension` as `language` to enable syntax highlighting, autocompletion, and linting for that language.',
      },
    },
  },
} satisfies Meta<UiCodeEditorArgs>;

export default meta;
type Story = StoryObj<UiCodeEditorArgs>;

export const Default: Story = {};

export const MultiLineSql: Story = {
  args: {
    value: [
      'SELECT',
      '  u.id,',
      '  u.name,',
      '  SUM(o.amount) AS total',
      'FROM users u',
      'JOIN orders o ON o.user_id = u.id',
      'WHERE u.active = TRUE',
      'GROUP BY u.id, u.name',
      'ORDER BY total DESC',
      'LIMIT 10;',
    ].join('\n'),
  },
};

export const EmptyWithPlaceholder: Story = {
  args: {
    value: '',
    placeholder: 'SELECT ...',
  },
};

export const Readonly: Story = {
  args: {
    value: 'SELECT id FROM users;',
    readonly: true,
  },
};

export const JavascriptLanguage: Story = {
  render: ({ value, readonly, onValueChange }: UiCodeEditorArgs) => html`
    <div style="width: 560px;">
      <ui-code-editor
        .language=${JAVASCRIPT}
        .value=${value}
        .readonly=${readonly}
        @value-change=${(e: CustomEvent<string>) => onValueChange(e.detail)}
      ></ui-code-editor>
    </div>
  `,
  args: {
    value: 'const active = users.filter(u => u.active);\nconsole.log(active.length);',
  },
};

export const NoLanguage: Story = {
  render: ({ value, readonly, placeholder, onValueChange }: UiCodeEditorArgs) => html`
    <div style="width: 560px;">
      <ui-code-editor
        .value=${value}
        .readonly=${readonly}
        .placeholder=${placeholder}
        @value-change=${(e: CustomEvent<string>) => onValueChange(e.detail)}
      ></ui-code-editor>
    </div>
  `,
  args: {
    value: 'plain text, no language extension',
    placeholder: 'Type something...',
  },
};

export const Interaction: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const editor = canvas.getByRole('textbox');
    await userEvent.click(editor);
    await userEvent.type(editor, ' -- comment');
    await expect(args.onValueChange).toHaveBeenCalled();
  },
};
