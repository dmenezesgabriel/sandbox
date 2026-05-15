import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';

import type { Filters, WidgetConfig } from '../../../../shared/types/index';

type WidgetArgs = {
  config: WidgetConfig;
  data: { labels: string[]; values: number[]; rows?: Record<string, unknown>[] } | null;
  filters: Filters;
  selected: boolean;
  editMode: boolean;
  onWidgetSelect: (id: string) => void;
  onWidgetDelete: (id: string) => void;
  onCrossFilter: (detail: unknown) => void;
};

const barData = {
  labels: ['West', 'East', 'Central', 'South'],
  values: [744294, 606351, 514251, 396641],
  rows: [
    { label: 'West', value: 744294 },
    { label: 'East', value: 606351 },
    { label: 'Central', value: 514251 },
    { label: 'South', value: 396641 },
  ],
};

const kpiConfig: WidgetConfig = {
  id: 'kpi-1',
  type: 'kpi',
  title: 'Total Sales',
  kpiConfig: { id: 'kpi-1', title: 'Total Sales', query: '', format: 'currency' },
};

const chartConfig: WidgetConfig = {
  id: 'chart-1',
  type: 'chart',
  title: 'Sales by Region',
  chartType: 'bar',
};

const tableConfig: WidgetConfig = {
  id: 'table-1',
  type: 'table',
  title: 'Top Regions',
  columns: ['label', 'value'],
};

const textConfig: WidgetConfig = {
  id: 'text-1',
  type: 'text',
  title: 'Note',
  textContent: 'Data refreshed daily at 09:00 UTC.',
};

const meta = {
  title: 'Organisms/Widget',
  component: 'app-widget',
  tags: ['autodocs'],
  render: ({
    config,
    data,
    filters,
    selected,
    editMode,
    onWidgetSelect,
    onWidgetDelete,
    onCrossFilter,
  }: WidgetArgs) =>
    html`<app-widget
      .config=${config}
      .data=${data}
      .filters=${filters}
      .selected=${selected}
      .editMode=${editMode}
      @widget-select=${(e: CustomEvent<{ id: string }>) => onWidgetSelect(e.detail.id)}
      @widget-delete=${(e: CustomEvent<{ id: string }>) => onWidgetDelete(e.detail.id)}
      @cross-filter=${(e: CustomEvent) => onCrossFilter(e.detail)}
    ></app-widget>`,
  argTypes: {
    config: {
      control: 'object',
      description: 'Widget configuration: `type`, `title`, chart type, KPI format, etc.',
    },
    data: {
      control: 'object',
      description: 'Resolved data payload. `null` triggers skeleton loaders or spinners.',
    },
    filters: {
      control: 'object',
      description: 'Active dashboard cross-filters forwarded from the parent layout.',
    },
    selected: {
      control: 'boolean',
      description: 'Highlights the widget with a selection border when in edit mode.',
      table: { defaultValue: { summary: 'false' } },
    },
    editMode: {
      control: 'boolean',
      description: 'Unhides the delete button and colour picker; enables click-to-select.',
      table: { defaultValue: { summary: 'false' } },
    },
    onWidgetSelect: {
      action: 'widget-select',
      description: 'Fired when the widget is clicked in edit mode. `detail.id` is the widget ID.',
      table: { category: 'Events' },
    },
    onWidgetDelete: {
      action: 'widget-delete',
      description: 'Fired when the ✕ delete button is clicked.',
      table: { category: 'Events' },
    },
    onCrossFilter: {
      action: 'cross-filter',
      description: 'Fired when a chart bar or table row is clicked to cross-filter the dashboard.',
      table: { category: 'Events' },
    },
  },
  args: {
    config: kpiConfig,
    data: { labels: [], values: [2261537], rows: [{ value: 2261537 }] },
    filters: {},
    selected: false,
    editMode: false,
    onWidgetSelect: fn(),
    onWidgetDelete: fn(),
    onCrossFilter: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dashboard organism composed from the spinner and skeleton atoms plus chart/table/text views. ' +
          'Renders as KPI, bar/line/pie chart, table, or free text based on `config.type`. ' +
          'Shows loading states while `data` is `null` and emits `cross-filter` events for inter-widget drill-down.',
      },
    },
  },
  decorators: [(story) => html`<div style="width:320px;">${story()}</div>`],
} satisfies Meta<WidgetArgs>;

export default meta;
type Story = StoryObj<WidgetArgs>;

export const KPI: Story = {
  args: {
    config: kpiConfig,
    data: { labels: [], values: [2261537], rows: [{ value: 2261537 }] },
  },
  parameters: {
    docs: { description: { story: 'KPI card with a formatted currency value.' } },
  },
};

export const KPILoading: Story = {
  name: 'KPI — Loading',
  args: { config: kpiConfig, data: null },
  parameters: {
    docs: { description: { story: 'KPI skeleton pulse while data is fetching.' } },
  },
};

export const BarChart: Story = {
  args: { config: chartConfig, data: barData },
  parameters: {
    docs: { description: { story: 'Bar chart with four region values rendered via Chart.js.' } },
  },
};

export const ChartLoading: Story = {
  name: 'Chart — Loading',
  args: { config: chartConfig, data: null },
  parameters: {
    docs: { description: { story: 'Chart widget spinner while data is fetching.' } },
  },
};

export const Table: Story = {
  args: { config: tableConfig, data: barData },
  parameters: {
    docs: {
      description: { story: 'Table widget — click any row to emit a `cross-filter` event.' },
    },
  },
};

export const TextWidget: Story = {
  name: 'Text / Annotation',
  args: { config: textConfig, data: null },
  parameters: {
    docs: { description: { story: 'Static text annotation — no data required.' } },
  },
};

export const EditModeSelected: Story = {
  name: 'Edit Mode — Selected',
  args: { config: chartConfig, data: barData, editMode: true, selected: true },
  parameters: {
    docs: {
      description: {
        story:
          'Widget in edit mode with a selection ring, delete button, and colour picker visible.',
      },
    },
  },
};

export const DeleteWidget: Story = {
  name: 'Interaction — Delete Widget',
  tags: ['!autodocs'],
  args: {
    config: kpiConfig,
    data: { labels: [], values: [2261537], rows: [{ value: 2261537 }] },
    editMode: true,
  },
  play: async ({ canvas, args }) => {
    const deleteBtn = canvas.getByRole('button', { name: /delete total sales/i });
    await userEvent.click(deleteBtn);

    const confirmDeleteBtn = canvas.getByRole('button', { name: /confirm delete total sales/i });
    await userEvent.click(confirmDeleteBtn);

    await expect(args.onWidgetDelete).toHaveBeenCalledWith('kpi-1');
  },
};
