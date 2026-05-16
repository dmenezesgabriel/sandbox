import '../../../dashboard/ui/widget';
import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { QuestionConfig } from '../../../../shared/types/index';

function makeConfig(overrides: Partial<QuestionConfig> = {}): QuestionConfig {
  return {
    id: 'story-q',
    slug: 'story-q',
    title: 'Story Question',
    type: 'chart',
    chartType: 'bar',
    source: 'user',
    queryType: 'sql',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const meta = {
  title: 'Features/QuestionEditorPanel',
  component: 'question-editor-panel',
  tags: ['autodocs'],
  render: ({ config }: { config: QuestionConfig }) => html`
    <div style="width: 900px; padding: 1rem;">
      <question-editor-panel .config=${config}></question-editor-panel>
    </div>
  `,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Panel for editing a question's title, visualisation type, and query. SQL tab uses CodeMirror; Natural language tab uses a plain textarea. Running a NL preview fills the SQL tab with the generated SQL.",
      },
    },
  },
} satisfies Meta<{ config: QuestionConfig }>;

export default meta;
type Story = StoryObj<{ config: QuestionConfig }>;

export const SqlMode: Story = {
  args: {
    config: makeConfig({
      queryType: 'sql',
      query: 'SELECT id, name\nFROM users\nWHERE active = TRUE\nLIMIT 10;',
    }),
  },
};

export const NlMode: Story = {
  args: {
    config: makeConfig({
      queryType: 'nl',
      nlQuery: 'sales by region',
    }),
  },
};

export const PostNlRun: Story = {
  args: {
    config: makeConfig({
      queryType: 'sql',
      query:
        'SELECT region, SUM(amount) AS total_sales\nFROM sales\nGROUP BY region\nORDER BY total_sales DESC;',
      nlQuery: 'sales by region',
    }),
  },
};

export const EmptyNew: Story = {
  args: {
    config: makeConfig({
      queryType: 'sql',
      query: undefined,
    }),
  },
};

export const NlModeEmpty: Story = {
  name: 'NL Mode — Empty (no nlQuery)',
  args: {
    config: makeConfig({
      queryType: 'nl',
      nlQuery: undefined,
      query: 'SELECT 1',
    }),
  },
};
