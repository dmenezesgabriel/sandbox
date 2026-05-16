import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type {
  ChartType2,
  Dashboard,
  DashboardConfig,
  Position,
  WidgetConfig,
} from '../../../shared/types/index';
import { findBestPosition, type GridItemLayout, migrateToGridLayout } from './grid-layout-engine';

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

export function configToDashboard(config: DashboardConfig): Dashboard {
  const widgets: WidgetConfig[] = [];
  const layout: Position[] = [];
  const accumulatedGridItems: GridItemLayout[] = [];

  const addWidget = (widget: WidgetConfig, configLayoutId: string | undefined): void => {
    widgets.push(widget);

    // Try to find a matching position in config.layout by id
    let gridPos: { x: number; y: number; w: number; h: number } | null = null;

    if (config.layout) {
      const configPos = (config.layout as Array<Position & { id?: string }>).find(
        (p) => p.id === configLayoutId,
      );
      if (configPos) {
        const migrated = migrateToGridLayout([configPos], [widget.id], 1200);
        if (migrated[0]) {
          gridPos = { x: migrated[0].x, y: migrated[0].y, w: migrated[0].w, h: migrated[0].h };
        }
      }
    }

    if (!gridPos) {
      gridPos = findBestPosition(widget.type, accumulatedGridItems);
    }

    accumulatedGridItems.push({ id: widget.id, ...gridPos });
    layout.push({ x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h });
  };

  for (const kpi of config.kpis) {
    addWidget(
      {
        id: kpi.id,
        type: 'kpi',
        title: kpi.title,
        query: kpi.query,
        queryType: 'sql',
        kpiConfig: kpi,
      },
      kpi.id,
    );
  }

  for (const chart of config.charts) {
    addWidget(
      {
        id: chart.id,
        type: 'chart',
        title: chart.title ?? chart.id,
        query: chart.query,
        queryType: 'sql',
        chartType: mapChartType(chart.type as string),
        options: chart.options as Record<string, unknown>,
      },
      chart.id,
    );
  }

  for (const table of config.tables) {
    addWidget(
      {
        id: table.id,
        type: 'table',
        title: table.title,
        query: table.query,
        queryType: 'sql',
        columns: table.columns,
      },
      table.id,
    );
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

export function dashboardToYaml(sheet: Dashboard): string {
  const obj: Record<string, unknown> = {
    title: sheet.name,
    dataSourceSlugs: [],
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

export function dashboardToJson(sheet: Dashboard): string {
  return JSON.stringify(
    sheet,
    (key, value) => (key === 'width' || key === 'height' ? undefined : value),
    2,
  );
}

export function yamlToDashboard(yaml: string): Dashboard {
  const parsed = parseYaml(yaml) as Record<string, unknown>;
  const widgets: WidgetConfig[] = [];
  const layout: Position[] = [];
  const layoutDefs = (parsed.layout as Record<string, unknown>[]) ?? [];
  const accumulatedGridItems: GridItemLayout[] = [];

  const addWidget = (
    item: Record<string, unknown>,
    type: WidgetConfig['type'],
    extra: Partial<WidgetConfig> = {},
  ): void => {
    const id = String(item.id);
    const bgColor = item.backgroundColor ? String(item.backgroundColor) : undefined;
    const widget: WidgetConfig = {
      id,
      type,
      title: String(item.title ?? ''),
      query: item.query ? String(item.query) : undefined,
      queryType: 'sql',
      backgroundColor: bgColor,
      ...extra,
    };
    widgets.push(widget);

    const layoutDef = layoutDefs.find((l) => String(l.id) === id);
    let gridPos: { x: number; y: number; w: number; h: number };

    if (layoutDef) {
      const rawPos = {
        x: Number(layoutDef.x) || 0,
        y: Number(layoutDef.y) || 0,
        w: Number(layoutDef.w) || 6,
        h: Number(layoutDef.h) || 4,
      };
      // Detect if this is pixel-based or grid-based
      const migrated = migrateToGridLayout([rawPos], [id], 1200);
      gridPos = migrated[0]
        ? { x: migrated[0].x, y: migrated[0].y, w: migrated[0].w, h: migrated[0].h }
        : findBestPosition(type, accumulatedGridItems);
    } else {
      gridPos = findBestPosition(type, accumulatedGridItems);
    }

    const gridItem: GridItemLayout = {
      id,
      x: gridPos.x,
      y: gridPos.y,
      w: gridPos.w,
      h: gridPos.h,
    };
    accumulatedGridItems.push(gridItem);
    layout.push({ x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h });
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

export function jsonToDashboard(json: string): Dashboard {
  const parsed = JSON.parse(json) as Dashboard & { width?: number; height?: number };
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
