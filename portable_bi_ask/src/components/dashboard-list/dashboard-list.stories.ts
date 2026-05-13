import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent, waitFor } from 'storybook/test';

type DashboardListArgs = {
  onDashboardSelect: (slug: string) => void;
  onDashboardCreate: (name: string) => void;
};

const meta = {
  title: 'Organisms/Dashboard List',
  component: 'dashboard-list',
  tags: ['autodocs'],
  render: ({ onDashboardSelect, onDashboardCreate }: DashboardListArgs) =>
    html`<dashboard-list
      @dashboard-select=${(e: CustomEvent<{ slug: string }>) => onDashboardSelect(e.detail.slug)}
      @dashboard-create=${(e: CustomEvent<{ name: string }>) => onDashboardCreate(e.detail.name)}
    ></dashboard-list>`,
  argTypes: {
    onDashboardSelect: {
      action: 'dashboard-select',
      description:
        'Fired when a dashboard card or row is clicked. `detail.slug` identifies the dashboard.',
      table: { category: 'Events' },
    },
    onDashboardCreate: {
      action: 'dashboard-create',
      description:
        'Fired after the user confirms the create-dashboard dialog. `detail.name` is the new name.',
      table: { category: 'Events' },
    },
  },
  args: {
    onDashboardSelect: fn(),
    onDashboardCreate: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Landing page listing all available dashboards. ' +
          'Reads `dashboardList` from the registry (static YAML + localStorage). ' +
          'Supports grid/list view toggle and a "New Dashboard" modal.',
      },
    },
  },
} satisfies Meta<DashboardListArgs>;

export default meta;
type Story = StoryObj<DashboardListArgs>;

export const GridView: Story = {
  parameters: {
    docs: { description: { story: 'Default grid view showing dashboard cards.' } },
  },
};

export const ListView: Story = {
  name: 'Interaction — Switch to List View',
  tags: ['!autodocs'],
  play: async ({ canvas }) => {
    const listBtn = canvas.getByTitle('List view');
    await userEvent.click(listBtn);
    await expect(canvas.getByText('Name')).toBeInTheDocument();
  },
};

export const OpenCreateModal: Story = {
  name: 'Interaction — Open Create Modal',
  tags: ['!autodocs'],
  play: async ({ canvas }) => {
    const newBtn = canvas.getByRole('button', { name: /new dashboard/i });
    await userEvent.click(newBtn);
    await expect(canvas.findByRole('dialog')).toBeTruthy();
  },
};

export const CreateDashboard: Story = {
  name: 'Interaction — Create Dashboard',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const newBtn = canvas.getByRole('button', { name: /new dashboard/i });
    await userEvent.click(newBtn);
    const nameInput = await canvas.findByRole('textbox', { name: /name/i });
    await userEvent.type(nameInput, 'Q4 Revenue');
    const createBtn = canvas.getByRole('button', { name: /^create$/i });
    await userEvent.click(createBtn);
    await expect(args.onDashboardCreate).toHaveBeenCalledWith('Q4 Revenue');
  },
};

export const BlankNameValidation: Story = {
  name: 'Interaction — Blank Name Validation',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const newBtn = canvas.getByRole('button', { name: /new dashboard/i });
    await userEvent.click(newBtn);

    const nameInput = await canvas.findByRole('textbox', { name: /name/i });
    const createBtn = canvas.getByRole('button', { name: /^create$/i });
    await userEvent.click(createBtn);

    const errorAlert = await canvas.findByRole('alert');
    await expect(args.onDashboardCreate).not.toHaveBeenCalled();
    await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(errorAlert).toHaveTextContent('Please enter a dashboard name.');
  },
};

export const CancelCreateModalRestoresFocus: Story = {
  name: 'Interaction — Cancel Restores Focus',
  tags: ['!autodocs'],
  play: async ({ canvas }) => {
    const newBtn = canvas.getByRole('button', { name: /new dashboard/i });
    await userEvent.click(newBtn);

    const cancelBtn = await canvas.findByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
      expect(newBtn).toHaveFocus();
    });
  },
};
