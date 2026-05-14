import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';

type TopNavArgs = {
  brand: string;
  subtitle: string;
  dashboardSlug: string;
  activeSection: 'dashboards' | 'questions' | '';
};

const meta = {
  title: 'Organisms/Top Nav',
  component: 'top-nav',
  tags: ['autodocs'],
  render: ({ brand, subtitle, dashboardSlug, activeSection }: TopNavArgs) =>
    html`<top-nav
      .brand=${brand}
      .subtitle=${subtitle}
      .dashboardSlug=${dashboardSlug}
      .activeSection=${activeSection}
    ></top-nav>`,
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
    dashboardSlug: {
      control: 'text',
      description: 'When non-empty, a back-arrow button is rendered to the left of the wordmark.',
      table: { defaultValue: { summary: '""' } },
    },
    activeSection: {
      control: 'select',
      options: ['dashboards', 'questions', ''],
      description: 'Highlights the active section link. Hidden when a back button is shown.',
      table: { defaultValue: { summary: '""' } },
    },
  },
  args: {
    brand: 'DataTalks',
    subtitle: 'Your Data, Any Data, Instantly Explained',
    dashboardSlug: '',
    activeSection: 'dashboards',
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global navigation bar. Renders the brand mark, wordmark, and an optional subtitle. ' +
          'When `dashboardSlug` is non-empty a back-to-list arrow button appears. ' +
          'Mode switching (Editor / Ask Data) and edit controls are no longer in this component — ' +
          'they live in `dashboard-editor-header`.',
      },
    },
  },
} satisfies Meta<TopNavArgs>;

export default meta;
type Story = StoryObj<TopNavArgs>;

export const Default: Story = {
  name: 'List Page (No Back Button)',
  parameters: {
    docs: {
      description: {
        story: 'Nav on the dashboard-list page — brand and subtitle only.',
      },
    },
  },
};

export const InDashboard: Story = {
  name: 'Inside a Dashboard',
  args: {
    dashboardSlug: 'sales-overview',
    subtitle: '',
  },
  parameters: {
    docs: {
      description: {
        story: 'Nav when a dashboard is open — back arrow visible, no subtitle.',
      },
    },
  },
};

export const QuestionsActive: Story = {
  name: 'Questions section active',
  args: { activeSection: 'questions', dashboardSlug: '' },
  parameters: {
    docs: { description: { story: 'Questions link highlighted, no back button.' } },
  },
};

export const InsideDashboard: Story = {
  name: 'Inside a dashboard (links hidden)',
  args: { dashboardSlug: 'sales-overview', activeSection: 'dashboards' },
  parameters: {
    docs: {
      description: {
        story: 'Back button visible; section links hidden to reduce clutter.',
      },
    },
  },
};

export const ClickBack: Story = {
  name: 'Interaction — Back Button',
  tags: ['!autodocs'],
  args: { dashboardSlug: 'sales-overview', subtitle: '' },
  play: async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: 'Back to Dashboards' });
    await expect(btn).toBeInTheDocument();
    await expect(btn).toHaveAttribute('title', 'Back to Dashboards');
    // Avoid triggering real hash navigation inside the Storybook preview iframe.
  },
};
