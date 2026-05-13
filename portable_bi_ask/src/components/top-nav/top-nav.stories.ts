import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { ActiveTab } from './top-nav';

type TopNavArgs = {
  activeTab: ActiveTab;
  brand: string;
  subtitle: string;
  showTabs: boolean;
  dashboardSlug: string;
  onTabChange: (tab: ActiveTab) => void;
};

const meta = {
  title: 'Organisms/Top Nav',
  component: 'top-nav',
  tags: ['autodocs'],
  render: ({ activeTab, brand, subtitle, showTabs, dashboardSlug, onTabChange }: TopNavArgs) =>
    html`<top-nav
      .activeTab=${activeTab}
      .brand=${brand}
      .subtitle=${subtitle}
      .showTabs=${showTabs}
      .dashboardSlug=${dashboardSlug}
      @tab-change=${(e: CustomEvent<ActiveTab>) => onTabChange(e.detail)}
    ></top-nav>`,
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['dashboard', 'askData'],
      description: 'Currently active tab.',
      table: { defaultValue: { summary: 'dashboard' } },
    },
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
    showTabs: {
      control: 'boolean',
      description: 'Whether to render the Editor / Ask Data tab switcher.',
      table: { defaultValue: { summary: 'true' } },
    },
    dashboardSlug: {
      control: 'text',
      description: 'When non-empty the back-arrow button is shown.',
      table: { defaultValue: { summary: '""' } },
    },
    onTabChange: {
      action: 'tab-change',
      description: 'Fired when the user clicks a tab. `detail` is the new `ActiveTab` value.',
      table: { category: 'Events' },
    },
  },
  args: {
    activeTab: 'dashboard',
    brand: 'DataTalks',
    subtitle: 'Your Data, Any Data, Instantly Explained',
    showTabs: true,
    dashboardSlug: 'portable-bi-dashboard',
    onTabChange: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Primary navigation bar. Renders a brand wordmark, optional back arrow when inside a dashboard, ' +
          'an optional subtitle, and the Editor / Ask Data tab switcher.',
      },
    },
  },
} satisfies Meta<TopNavArgs>;

export default meta;
type Story = StoryObj<TopNavArgs>;

export const EditorActive: Story = {
  name: 'Editor Tab Active',
  parameters: {
    docs: { description: { story: 'Default state — Editor tab selected.' } },
  },
};

export const AskDataActive: Story = {
  name: 'Ask Data Tab Active',
  args: { activeTab: 'askData' },
  parameters: {
    docs: {
      description: { story: 'Ask Data tab selected; indicator shifts to the right button.' },
    },
  },
};

export const LandingNav: Story = {
  name: 'Landing (No Tabs)',
  args: { showTabs: false, dashboardSlug: '', subtitle: '' },
  parameters: {
    docs: {
      description: { story: 'Nav on the dashboard-list page — no tabs or back button.' },
    },
  },
};

export const TabSwitch: Story = {
  name: 'Interaction — Switch to Ask Data',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const tab = canvas.getByRole('tab', { name: 'Ask Data' });
    await userEvent.click(tab);
    await expect(args.onTabChange).toHaveBeenCalledWith('askData');
  },
};
