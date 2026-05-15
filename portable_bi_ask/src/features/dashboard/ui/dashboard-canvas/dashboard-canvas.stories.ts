import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { fn } from 'storybook/test';

import type { Dashboard, Filters } from '../../../../shared/types/index';

type DashboardCanvasArgs = {
  sheet: Dashboard;
  data: Record<string, { labels: string[]; values: number[]; rows?: Record<string, unknown>[] }>;
  filters: Filters;
  selectedWidgetId: string | null;
  editMode: boolean;
  onWidgetSelect: (id: string) => void;
  onWidgetDelete: (id: string) => void;
  onLayoutChange: (sheet: Dashboard) => void;
  onCrossFilter: (detail: unknown) => void;
};

const DASHBOARD_WITH_WIDGETS: Dashboard = {
  id: 'dashboard-demo',
  name: 'Demo',
  type: 'layout',
  widgets: [
    {
      id: 'kpi-1',
      type: 'kpi',
      title: 'Total Sales',
      kpiConfig: { id: 'kpi-1', title: 'Total Sales', query: '', format: 'currency' },
    },
    { id: 'chart-1', type: 'chart', title: 'Sales by Region', chartType: 'bar' },
  ],
  layout: [
    { x: 16, y: 16, w: 240, h: 160 },
    { x: 272, y: 16, w: 480, h: 260 },
  ],
};

const DASHBOARD_DATA = {
  'kpi-1': { labels: [], values: [2261537], rows: [{ value: 2261537 }] },
  'chart-1': {
    labels: ['West', 'East', 'Central', 'South'],
    values: [744294, 606351, 514251, 396641],
    rows: [
      { label: 'West', value: 744294 },
      { label: 'East', value: 606351 },
      { label: 'Central', value: 514251 },
      { label: 'South', value: 396641 },
    ],
  },
};

const EMPTY_DASHBOARD: Dashboard = {
  id: 'dashboard-empty',
  name: 'Empty',
  type: 'layout',
  widgets: [],
  layout: [],
};

const meta = {
  title: 'Organisms/Dashboard Canvas',
  component: 'dashboard-canvas',
  tags: ['autodocs'],
  render: ({
    sheet,
    data,
    filters,
    selectedWidgetId,
    editMode,
    onWidgetSelect,
    onWidgetDelete,
    onLayoutChange,
    onCrossFilter,
  }: DashboardCanvasArgs) =>
    html`<dashboard-canvas
      .sheet=${sheet}
      .data=${data}
      .filters=${filters}
      .selectedWidgetId=${selectedWidgetId}
      .editMode=${editMode}
      @widget-select=${(e: CustomEvent<{ id: string }>) => onWidgetSelect(e.detail.id)}
      @widget-delete=${(e: CustomEvent<{ id: string }>) => onWidgetDelete(e.detail.id)}
      @layout-change=${(e: CustomEvent<{ sheet: Dashboard }>) => onLayoutChange(e.detail.sheet)}
      @cross-filter=${(e: CustomEvent) => onCrossFilter(e.detail)}
    ></dashboard-canvas>`,
  argTypes: {
    sheet: {
      control: 'object',
      description:
        'The active dashboard containing widget configs and absolute-pixel layout positions.',
    },
    data: {
      control: 'object',
      description: 'Widget data keyed by widget ID. `null` data slots trigger skeleton loaders.',
    },
    filters: {
      control: 'object',
      description: 'Active dashboard-level filter values forwarded to each widget.',
    },
    selectedWidgetId: {
      control: 'text',
      description: 'ID of the widget with a selection ring (only relevant in edit mode).',
    },
    editMode: {
      control: 'boolean',
      description: 'Shows the grid overlay and resize handles; enables drag-to-reposition.',
      table: { defaultValue: { summary: 'false' } },
    },
    onWidgetSelect: {
      action: 'widget-select',
      description: 'Fired in edit mode when a widget is clicked. `detail.id` is the widget ID.',
      table: { category: 'Events' },
    },
    onWidgetDelete: {
      action: 'widget-delete',
      description: 'Fired when the delete button is clicked inside a widget.',
      table: { category: 'Events' },
    },
    onLayoutChange: {
      action: 'layout-change',
      description:
        'Fired after a drag or resize completes. `detail.sheet` reflects the new layout.',
      table: { category: 'Events' },
    },
    onCrossFilter: {
      action: 'cross-filter',
      description: 'Fired when a chart bar or table row is clicked for cross-filtering.',
      table: { category: 'Events' },
    },
  },
  args: {
    sheet: DASHBOARD_WITH_WIDGETS,
    data: DASHBOARD_DATA,
    filters: {},
    selectedWidgetId: null,
    editMode: false,
    onWidgetSelect: fn(),
    onWidgetDelete: fn(),
    onLayoutChange: fn(),
    onCrossFilter: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Absolute-positioned canvas that hosts `app-widget` elements. ' +
          'Supports drag-to-reposition and resize-handle interactions in edit mode. ' +
          'Emits `cross-filter` events for inter-widget drill-down.',
      },
    },
  },
} satisfies Meta<DashboardCanvasArgs>;

export default meta;
type Story = StoryObj<DashboardCanvasArgs>;

export const Default: Story = {
  parameters: {
    docs: {
      description: { story: 'KPI + bar chart positioned on the canvas — view mode, no grid.' },
    },
  },
};

export const EditModeView: Story = {
  name: 'Edit Mode',
  args: { editMode: true },
  parameters: {
    docs: {
      description: {
        story: 'Edit mode — 12-column grid overlay and resize handles visible on each widget.',
      },
    },
  },
};

export const SelectedWidget: Story = {
  name: 'Widget Selected',
  args: { editMode: true, selectedWidgetId: 'chart-1' },
  parameters: {
    docs: {
      description: {
        story: 'Chart widget highlighted with a selection ring in edit mode.',
      },
    },
  },
};

export const LoadingData: Story = {
  args: { data: {} },
  parameters: {
    docs: {
      description: {
        story: 'No data provided — widgets display skeleton loaders or spinners.',
      },
    },
  },
};

export const EmptyDashboard: Story = {
  args: { sheet: EMPTY_DASHBOARD, data: {} },
  parameters: {
    docs: {
      description: {
        story: '"Add questions to this dashboard" placeholder — dashboard has no widgets.',
      },
    },
  },
};
