import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { ChartType2, DashboardConfig, Position, Sheet, WidgetConfig } from './types';

function mapChartType(type: string): ChartType2 {
  const map: Record<string, ChartType2> = {
    bar: 'bar',
    line: 'line',
    pie: 'pie',
    doughnut: 'donut',
    scatter: 'scatter',
    bubble: 'bubble',
    area: 'area',
    histogram: 'histogram',
    gauge: 'gauge',
    funnel: 'funnel',
  };
  return map[type] ?? 'bar';
}

export function configToSheet(config: DashboardConfig): Sheet {
  const widgets: WidgetConfig[] = [];
  const layout: Position[] = [];

  for (const kpi of config.kpis) {
    widgets.push({
      id: kpi.id,
      type: 'kpi',
      title: kpi.title,
      query: kpi.query,
      queryType: 'sql',
      kpiConfig: kpi,
    });
    const pos = findLayout(config.layout, kpi.id, widgets.length - 1);
    layout.push(pos);
  }

  for (const chart of config.charts) {
    widgets.push({
      id: chart.id,
      type: 'chart',
      title: chart.title ?? chart.id,
      query: chart.query,
      queryType: 'sql',
      chartType: mapChartType(chart.type),
      options: chart.options as Record<string, unknown>,
    });
    const pos = findLayout(config.layout, chart.id, widgets.length - 1);
    layout.push(pos);
  }

  for (const table of config.tables) {
    widgets.push({
      id: table.id,
      type: 'table',
      title: table.title,
      query: table.query,
      queryType: 'sql',
      columns: table.columns,
    });
    const pos = findLayout(config.layout, table.id, widgets.length - 1);
    layout.push(pos);
  }

  return {
    id: 'default-dashboard',
    name: config.title,
    type: 'dashboard',
    widgets,
    layout,
    filters: config.filters,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function findLayout(layout: Position[] | undefined, id: string, fallbackIndex: number): Position {
  if (layout) {
    const match = layout.find((p) => 'id' in p && (p as Record<string, unknown>).id === id) as
      | (Position & { id?: string })
      | undefined;
    if (match) {
      const pos: Position = { x: match.x!, y: match.y!, w: match.w!, h: match.h! };
      return pos;
    }
  }
  const cols = 4;
  const row = Math.floor(fallbackIndex / cols);
  const col = fallbackIndex % cols;
  return {
    x: col * 300 + 16,
    y: row * 220 + 16,
    w: 280,
    h: 200,
  };
}

export function sheetToYaml(sheet: Sheet): string {
  const obj: Record<string, unknown> = {
    title: sheet.name,
    dataSources: [],
    filters: [],
    kpis: [],
    charts: [],
    tables: [],
    layout: [],
  };

  for (let i = 0; i < sheet.widgets.length; i++) {
    const w = sheet.widgets[i];
    const pos = sheet.layout[i];
    const entry: Record<string, unknown> = { id: w.id };

    if (pos) {
      entry.x = pos.x;
      entry.y = pos.y;
      entry.w = pos.w;
      entry.h = pos.h;
    }

    if (w.backgroundColor) entry.backgroundColor = w.backgroundColor;

    if (w.type === 'kpi') {
      const kpiEntry: Record<string, unknown> = {
        id: w.id,
        title: w.title,
        query: w.query,
      };
      if (w.kpiConfig?.format) kpiEntry.format = w.kpiConfig.format;
      obj.kpis = (obj.kpis as Record<string, unknown>[]).concat(kpiEntry);
      obj.layout = (obj.layout as Record<string, unknown>[]).concat(entry);
    } else if (w.type === 'chart') {
      const chartEntry: Record<string, unknown> = {
        id: w.id,
        type: w.chartType,
        title: w.title,
        query: w.query,
      };
      obj.charts = (obj.charts as Record<string, unknown>[]).concat(chartEntry);
      obj.layout = (obj.layout as Record<string, unknown>[]).concat(entry);
    } else if (w.type === 'table') {
      const tableEntry: Record<string, unknown> = {
        id: w.id,
        title: w.title,
        query: w.query,
        columns: w.columns,
      };
      obj.tables = (obj.tables as Record<string, unknown>[]).concat(tableEntry);
      obj.layout = (obj.layout as Record<string, unknown>[]).concat(entry);
    }
  }

  return stringifyYaml(obj, { indent: 2 });
}

export function sheetToJson(sheet: Sheet): string {
  return JSON.stringify(
    sheet,
    (key, value) => (key === 'width' || key === 'height' ? undefined : value),
    2,
  );
}

export function yamlToSheet(yaml: string): Sheet {
  const parsed = parseYaml(yaml) as Record<string, unknown>;
  const widgets: WidgetConfig[] = [];
  const layout: Position[] = [];
  const layoutDefs = (parsed.layout as Record<string, unknown>[]) ?? [];

  const addWidget = (
    item: Record<string, unknown>,
    type: WidgetConfig['type'],
    extra: Partial<WidgetConfig> = {},
  ): void => {
    const id = String(item.id);
    const bgColor = item.backgroundColor ? String(item.backgroundColor) : undefined;
    widgets.push({
      id,
      type,
      title: String(item.title ?? ''),
      query: item.query ? String(item.query) : undefined,
      queryType: 'sql',
      backgroundColor: bgColor,
      ...extra,
    });
    const layoutDef = layoutDefs.find((l) => String(l.id) === id);
    if (layoutDef) {
      layout.push({
        x: Number(layoutDef.x) || 0,
        y: Number(layoutDef.y) || 0,
        w: Number(layoutDef.w) || 280,
        h: Number(layoutDef.h) || 200,
      });
    } else {
      layout.push({ x: 16, y: 16 + widgets.length * 220, w: 280, h: 200 });
    }
  };

  const kpis = (parsed.kpis as Record<string, unknown>[]) ?? [];
  for (const kpi of kpis) {
    const fmt = kpi.format === 'currency' ? ('currency' as const) : undefined;
    addWidget(kpi, 'kpi', {
      kpiConfig: {
        id: String(kpi.id),
        title: String(kpi.title ?? ''),
        query: String(kpi.query ?? ''),
        format: fmt,
      },
    });
  }

  const charts = (parsed.charts as Record<string, unknown>[]) ?? [];
  for (const chart of charts) {
    addWidget(chart, 'chart', {
      chartType: (chart.type as WidgetConfig['chartType']) ?? 'bar',
    });
  }

  const tables = (parsed.tables as Record<string, unknown>[]) ?? [];
  for (const table of tables) {
    const colFmts: Record<string, 'currency'> | undefined = table.columnFormats
      ? (Object.fromEntries(
          Object.entries(table.columnFormats as Record<string, unknown>).filter(
            ([, v]) => v === 'currency',
          ),
        ) as Record<string, 'currency'>)
      : undefined;
    addWidget(table, 'table', {
      columns: (table.columns as string[]) ?? [],
      columnFormats: colFmts,
    });
  }

  return {
    id: crypto.randomUUID(),
    name: String(parsed.title ?? 'Imported Dashboard'),
    type: 'dashboard',
    widgets,
    layout,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function jsonToSheet(json: string): Sheet {
  const parsed = JSON.parse(json) as Sheet & { width?: number; height?: number };
  const rest = { ...parsed };
  delete (rest as Record<string, unknown>).width;
  delete (rest as Record<string, unknown>).height;
  return {
    ...rest,
    id: rest.id || crypto.randomUUID(),
    widgets: rest.widgets ?? [],
    layout: rest.layout ?? [],
    createdAt: rest.createdAt ?? new Date().toISOString(),
    updatedAt: rest.updatedAt ?? new Date().toISOString(),
  };
}
