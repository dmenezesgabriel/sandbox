import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

type TopNavArgs = {
  brand: string;
  subtitle: string;
  activeSection: 'dashboards' | 'questions' | '';
};

const meta = {
  title: 'Organisms/Top Nav',
  component: 'top-nav',
  tags: ['autodocs'],
  render: ({ brand, subtitle, activeSection }: TopNavArgs) =>
    html`<top-nav .brand=${brand} .subtitle=${subtitle} .activeSection=${activeSection}></top-nav>`,
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
    activeSection: {
      control: 'select',
      options: ['dashboards', 'questions', ''],
      description: 'Highlights the active section link.',
      table: { defaultValue: { summary: '""' } },
    },
  },
  args: {
    brand: 'DataTalks',
    subtitle: 'Your Data, Any Data, Instantly Explained',
    activeSection: 'dashboards',
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global navigation bar. Renders the brand mark, wordmark, an optional subtitle, and section links. ' +
          'Navigation to specific pages (e.g. back to dashboard list) is handled by page-level components such as ' +
          '`dashboard-editor-header` via a breadcrumb. Mode switching (Editor / Ask Data) and edit controls live in ' +
          '`dashboard-editor-header`.',
      },
    },
  },
} satisfies Meta<TopNavArgs>;

export default meta;
type Story = StoryObj<TopNavArgs>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Nav on the dashboard-list page — brand, subtitle, and section links.',
      },
    },
  },
};

export const QuestionsActive: Story = {
  name: 'Questions section active',
  args: { activeSection: 'questions' },
  parameters: {
    docs: { description: { story: 'Questions link highlighted.' } },
  },
};
