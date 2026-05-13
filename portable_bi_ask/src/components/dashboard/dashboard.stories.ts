import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta = {
  title: 'Pages/Dashboard App',
  component: 'app-dashboard',
  tags: ['autodocs', '!test'],
  render: () => html`<app-dashboard></app-dashboard>`,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Page-level application shell. Parses `window.location.hash` to route between the ' +
          'dashboard list page (`#/`) and the dashboard editor template (`#/dashboard/:slug`). ' +
          'All navigation is hash-based — no props are required.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ListRoute: Story = {
  name: 'List Route (#/)',
  parameters: {
    docs: {
      description: {
        story: 'Default route (`#/`) — renders the dashboard list page.',
      },
    },
  },
};

export const NotFound: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Navigate to `#/dashboard/non-existent-slug` in the browser address bar ' +
          'to see the "Dashboard not found" fallback.',
      },
    },
  },
};
