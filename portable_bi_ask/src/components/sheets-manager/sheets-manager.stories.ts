import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { Sheet } from '../../types';

type SheetsManagerArgs = {
  sheets: Sheet[];
  activeSheetId: string | null;
  editMode: boolean;
  onSheetSelect: (id: string) => void;
  onSheetDelete: (id: string) => void;
  onEditModeToggle: (editMode: boolean) => void;
  onSheetDuplicate: (sheet: Sheet) => void;
};

const SHEETS: Sheet[] = [
  { id: 'sheet-1', name: 'Overview', type: 'sheet', widgets: [], layout: [] },
  { id: 'sheet-2', name: 'Sales Detail', type: 'sheet', widgets: [], layout: [] },
  { id: 'sheet-3', name: 'Regional Breakdown', type: 'sheet', widgets: [], layout: [] },
];

const meta = {
  title: 'Components/SheetsManager',
  component: 'sheets-manager',
  tags: ['autodocs'],
  render: ({
    sheets,
    activeSheetId,
    editMode,
    onSheetSelect,
    onSheetDelete,
    onEditModeToggle,
    onSheetDuplicate,
  }: SheetsManagerArgs) =>
    html`<sheets-manager
      .sheets=${sheets}
      .activeSheetId=${activeSheetId}
      .editMode=${editMode}
      @sheet-select=${(e: CustomEvent<{ id: string }>) => onSheetSelect(e.detail.id)}
      @sheet-delete=${(e: CustomEvent<{ id: string }>) => onSheetDelete(e.detail.id)}
      @edit-mode-toggle=${(e: CustomEvent<{ editMode: boolean }>) =>
        onEditModeToggle(e.detail.editMode)}
      @sheet-duplicate=${(e: CustomEvent<{ sheet: Sheet }>) => onSheetDuplicate(e.detail.sheet)}
    ></sheets-manager>`,
  argTypes: {
    sheets: {
      control: 'object',
      description: 'Array of sheets to render as tabs.',
    },
    activeSheetId: {
      control: 'text',
      description: 'ID of the currently active (selected) sheet.',
    },
    editMode: {
      control: 'boolean',
      description: 'When `true`, shows duplicate (⧉) and delete (✕) buttons on each tab.',
      table: { defaultValue: { summary: 'false' } },
    },
    onSheetSelect: {
      action: 'sheet-select',
      description: 'Fired when a tab is clicked. `detail.id` is the sheet ID.',
      table: { category: 'Events' },
    },
    onSheetDelete: {
      action: 'sheet-delete',
      description: 'Fired when the ✕ delete button is clicked. `detail.id` is the sheet ID.',
      table: { category: 'Events' },
    },
    onEditModeToggle: {
      action: 'edit-mode-toggle',
      description: 'Fired when Edit / Done Editing is clicked. `detail.editMode` is the new state.',
      table: { category: 'Events' },
    },
    onSheetDuplicate: {
      action: 'sheet-duplicate',
      description:
        'Fired when the ⧉ duplicate button is clicked. `detail.sheet` is the source sheet.',
      table: { category: 'Events' },
    },
  },
  args: {
    sheets: SHEETS,
    activeSheetId: 'sheet-1',
    editMode: false,
    onSheetSelect: fn(),
    onSheetDelete: fn(),
    onEditModeToggle: fn(),
    onSheetDuplicate: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tab bar for navigating between dashboard sheets. ' +
          'Shows duplicate and delete controls per tab when `editMode` is enabled.',
      },
    },
  },
} satisfies Meta<SheetsManagerArgs>;

export default meta;
type Story = StoryObj<SheetsManagerArgs>;

export const Default: Story = {
  parameters: {
    docs: { description: { story: 'Three sheets — Overview tab active, edit controls hidden.' } },
  },
};

export const EditMode: Story = {
  args: { editMode: true },
  parameters: {
    docs: {
      description: {
        story: 'Edit mode enabled — duplicate (⧉) and delete (✕) buttons visible on each tab.',
      },
    },
  },
};

export const SingleSheet: Story = {
  args: { sheets: [SHEETS[0]], activeSheetId: 'sheet-1' },
  parameters: {
    docs: { description: { story: 'Only one tab — minimum viable state.' } },
  },
};

export const ToggleEditMode: Story = {
  name: 'Interaction — Toggle Edit Mode',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const editBtn = canvas.getByRole('button', { name: /^edit$/i });
    await userEvent.click(editBtn);
    await expect(args.onEditModeToggle).toHaveBeenCalledWith(true);
  },
};

export const SelectSheet: Story = {
  name: 'Interaction — Select Sheet',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByText('Sales Detail'));
    await expect(args.onSheetSelect).toHaveBeenCalledWith('sheet-2');
  },
};
