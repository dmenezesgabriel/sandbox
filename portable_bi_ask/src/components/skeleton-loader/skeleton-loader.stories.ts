import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

type SkeletonArgs = {
  variant: 'line' | 'box' | 'kpi' | 'table';
  lines: number;
  columns: number;
  rows: number;
  width: string;
  height: string;
};

const meta = {
  title: 'Atoms/Skeleton Loader',
  component: 'skeleton-loader',
  tags: ['autodocs'],
  render: ({ variant, lines, columns, rows, width, height }: SkeletonArgs) => html`
    <skeleton-loader
      .variant=${variant}
      .lines=${lines}
      .columns=${columns}
      .rows=${rows}
      .width=${width}
      .height=${height}
    ></skeleton-loader>
  `,
  argTypes: {
    variant: {
      control: 'select',
      options: ['line', 'box', 'kpi', 'table'],
      description:
        'Shape preset. `line` for text rows, `box` for image/chart placeholders, `kpi` for metric cards, `table` for data grids.',
      table: { defaultValue: { summary: 'line' } },
    },
    lines: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Number of animated lines to render. Only used when variant is `line`.',
      table: { defaultValue: { summary: '1' } },
    },
    columns: {
      control: { type: 'number', min: 1, max: 12 },
      description: 'Column count for the table header and body. Only used when variant is `table`.',
      table: { defaultValue: { summary: '4' } },
    },
    rows: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Body row count. Only used when variant is `table`.',
      table: { defaultValue: { summary: '3' } },
    },
    width: {
      control: 'text',
      description:
        'Inline CSS width override (e.g. `200px`, `50%`). Falls back to parent width when empty.',
      table: { defaultValue: { summary: '—' } },
    },
    height: {
      control: 'text',
      description:
        'Inline CSS height override (e.g. `120px`). Primarily useful for the `box` variant.',
      table: { defaultValue: { summary: '—' } },
    },
  },
  args: {
    variant: 'line' as const,
    lines: 1,
    columns: 4,
    rows: 3,
    width: '',
    height: '',
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Animated pulse placeholder rendered while content is loading. ' +
          'Four shape presets (`line`, `box`, `kpi`, `table`) match the silhouette of the ' +
          'real content so the layout shift on reveal is minimal. ' +
          'All variants respect the design-token animation speed defined in `animations.css`.',
      },
    },
  },
} satisfies Meta<SkeletonArgs>;

export default meta;
// StoryObj<typeof meta> doesn't propagate args for string component refs in web-components;
// use the concrete args type directly.
type Story = StoryObj<SkeletonArgs>;

export const Line: Story = {
  args: { variant: 'line', lines: 3 },
  parameters: {
    docs: { description: { story: 'Three stacked text-line skeletons at varying widths.' } },
  },
};

export const Box: Story = {
  args: { variant: 'box', width: '200px', height: '120px' },
  parameters: {
    docs: {
      description: { story: 'Rectangular placeholder for charts, images, or card thumbnails.' },
    },
  },
};

export const Kpi: Story = {
  name: 'KPI',
  args: { variant: 'kpi' },
  parameters: {
    docs: {
      description: {
        story: 'Two-row skeleton matching the label + value layout of a KPI metric card.',
      },
    },
  },
};

export const Table: Story = {
  args: { variant: 'table', columns: 5, rows: 4 },
  parameters: {
    docs: {
      description: {
        story: 'Full grid skeleton with a header row and configurable columns × rows.',
      },
    },
  },
};
