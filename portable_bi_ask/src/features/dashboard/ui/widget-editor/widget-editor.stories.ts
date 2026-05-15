import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { WidgetConfig } from '../../../../shared/types/index';

type WidgetEditorArgs = {
  widget: WidgetConfig | null;
  mode: 'add' | 'edit';
  onWidgetSave: (detail: { widget: WidgetConfig; mode: 'add' | 'edit' }) => void;
  onEditorCancel: () => void;
};

const chartWidget: WidgetConfig = {
  id: 'widget-1',
  type: 'chart',
  title: 'Sales by Region',
  query: 'sales by region',
  chartType: 'bar',
};

const textWidget: WidgetConfig = {
  id: 'widget-2',
  type: 'text',
  title: 'Dashboard Note',
  textContent: 'Data refreshed daily at 09:00 UTC.',
};

const meta = {
  title: 'Organisms/Widget Editor',
  component: 'widget-editor',
  tags: ['autodocs'],
  render: ({ widget, mode, onWidgetSave, onEditorCancel }: WidgetEditorArgs) =>
    html`<widget-editor
      .widget=${widget}
      .mode=${mode}
      @widget-save=${(e: CustomEvent<{ widget: WidgetConfig; mode: 'add' | 'edit' }>) =>
        onWidgetSave(e.detail)}
      @editor-cancel=${onEditorCancel}
    ></widget-editor>`,
  argTypes: {
    widget: {
      control: 'object',
      description: 'Existing `WidgetConfig` to edit, or `null` to create a new widget.',
    },
    mode: {
      control: 'select',
      options: ['add', 'edit'],
      description: 'Controls the dialog heading and `mode` field in the `widget-save` event.',
      table: { defaultValue: { summary: 'add' } },
    },
    onWidgetSave: {
      action: 'widget-save',
      description:
        'Fired on Save. `detail.widget` is the configured `WidgetConfig`; `detail.mode` is `"add"` or `"edit"`.',
      table: { category: 'Events' },
    },
    onEditorCancel: {
      action: 'editor-cancel',
      description: 'Fired when the dialog is dismissed without saving.',
      table: { category: 'Events' },
    },
  },
  args: {
    widget: null,
    mode: 'add',
    onWidgetSave: fn(),
    onEditorCancel: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Modal dialog (`<dialog>`) for adding or editing a dashboard widget. ' +
          'Opens automatically on mount via `showModal()`. ' +
          'Emits `widget-save` with the configured `WidgetConfig` on save, or `editor-cancel` on dismiss.',
      },
    },
  },
  decorators: [(story) => html`<div style="min-height:520px;">${story()}</div>`],
} satisfies Meta<WidgetEditorArgs>;

export default meta;
type Story = StoryObj<WidgetEditorArgs>;

export const AddMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Empty "Add Question" form — default state when no widget is provided.',
      },
    },
  },
};

export const EditChart: Story = {
  name: 'Edit Chart Widget',
  args: { widget: chartWidget, mode: 'edit' },
  parameters: {
    docs: {
      description: {
        story: 'Form pre-filled from an existing chart widget; heading reads "Edit Question".',
      },
    },
  },
};

export const EditText: Story = {
  name: 'Edit Text Widget',
  args: { widget: textWidget, mode: 'edit' },
  parameters: {
    docs: {
      description: {
        story: 'Text-box type — the Content textarea is shown instead of the chart-type selector.',
      },
    },
  },
};

export const SaveWidget: Story = {
  name: 'Interaction — Save Widget',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const titleInput = await canvas.findByRole('textbox', { name: /title/i });
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Revenue KPI');
    const saveBtn = canvas.getByRole('button', { name: /save question/i });
    await userEvent.click(saveBtn);
    await expect(args.onWidgetSave).toHaveBeenCalledOnce();
  },
};

export const BlankTitleValidation: Story = {
  name: 'Interaction — Blank Title Validation',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const titleInput = await canvas.findByRole('textbox', { name: /title/i });
    const saveBtn = canvas.getByRole('button', { name: /save question/i });

    await userEvent.click(saveBtn);

    const errorAlert = await canvas.findByRole('alert');
    await expect(args.onWidgetSave).not.toHaveBeenCalled();
    await expect(titleInput).toHaveAttribute('aria-invalid', '');
    await expect(errorAlert).toHaveTextContent('Please enter a title for this question.');
  },
};

export const CancelEditor: Story = {
  name: 'Interaction — Cancel',
  tags: ['!autodocs'],
  play: async ({ canvas, args }) => {
    const cancelBtn = await canvas.findByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);
    await expect(args.onEditorCancel).toHaveBeenCalledOnce();
  },
};
