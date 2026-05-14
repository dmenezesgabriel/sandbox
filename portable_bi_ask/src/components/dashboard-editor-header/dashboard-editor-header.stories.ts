import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { DashboardMode } from './dashboard-editor-header';

type DashboardEditorHeaderArgs = {
  title: string;
  subtitle: string;
  mode: DashboardMode;
  editMode: boolean;
  onModeChange: (mode: DashboardMode) => void;
  onEditModeToggle: (detail: { editMode: boolean }) => void;
};

const meta = {
  title: 'Organisms/Dashboard Editor Header',
  component: 'dashboard-editor-header',
  tags: ['autodocs'],
  render: ({ title, subtitle, mode, editMode, onModeChange, onEditModeToggle }) =>
    html`<dashboard-editor-header
      .title=${title}
      .subtitle=${subtitle}
      .mode=${mode}
      .editMode=${editMode}
      @mode-change=${(e: CustomEvent<DashboardMode>) => onModeChange(e.detail)}
      @edit-mode-toggle=${(e: CustomEvent<{ editMode: boolean }>) => onEditModeToggle(e.detail)}
    ></dashboard-editor-header>`,
  argTypes: {
    title: {
      control: 'text',
      description: 'Dashboard display name shown on the left.',
    },
    subtitle: {
      control: 'text',
      description: 'Optional tagline shown below the title. Hidden when empty.',
    },
    mode: {
      control: 'select',
      options: ['dashboard', 'askData'],
      description: 'Active mode. Controls which segment button is highlighted.',
      table: { defaultValue: { summary: 'dashboard' } },
    },
    editMode: {
      control: 'boolean',
      description: 'When `true` the Edit button shows "Done Editing" and is highlighted.',
      table: { defaultValue: { summary: 'false' } },
    },
    onModeChange: {
      action: 'mode-change',
      description: 'Fired when a mode button is clicked. `detail` is the new `DashboardMode`.',
      table: { category: 'Events' },
    },
    onEditModeToggle: {
      action: 'edit-mode-toggle',
      description:
        'Fired when the Edit button is clicked. `detail.editMode` is the *next* edit state.',
      table: { category: 'Events' },
    },
  },
  args: {
    title: 'Sales Overview',
    subtitle: 'Regional performance Q1–Q2',
    mode: 'dashboard',
    editMode: false,
    onModeChange: fn(),
    onEditModeToggle: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Contextual header bar rendered below the global nav inside the dashboard editor. ' +
          'Displays the dashboard title and subtitle on the left; mode switcher and edit toggle on the right.',
      },
    },
  },
} satisfies Meta<DashboardEditorHeaderArgs>;

export default meta;
type Story = StoryObj<DashboardEditorHeaderArgs>;

export const EditorMode: Story = {
  parameters: {
    docs: { description: { story: 'Default state — Editor button active, not in edit mode.' } },
  },
};

export const AskDataMode: Story = {
  args: { mode: 'askData' },
  parameters: {
    docs: { description: { story: 'Ask Data button is active.' } },
  },
};

export const EditModeActive: Story = {
  args: { editMode: true },
  parameters: {
    docs: {
      description: {
        story: 'Edit mode on — button shows "Done Editing" with accent background.',
      },
    },
  },
};

export const NoSubtitle: Story = {
  args: { subtitle: '' },
  parameters: {
    docs: { description: { story: 'Subtitle omitted — title row only.' } },
  },
};

export const SwitchToAskData: Story = {
  name: 'Interaction — Switch to Ask Data',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const tab = canvas.getByRole('tab', { name: 'Ask Data' });
    await userEvent.click(tab);
    await expect(args.onModeChange).toHaveBeenCalledWith('askData');
  },
};

export const ToggleEditOn: Story = {
  name: 'Interaction — Enter Edit Mode',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Edit' });
    await userEvent.click(btn);
    await expect(args.onEditModeToggle).toHaveBeenCalledWith({ editMode: true });
  },
};

export const ToggleEditOff: Story = {
  name: 'Interaction — Exit Edit Mode',
  tags: ['!autodocs'],
  args: { editMode: true },
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Done Editing' });
    await userEvent.click(btn);
    await expect(args.onEditModeToggle).toHaveBeenCalledWith({ editMode: false });
  },
};
