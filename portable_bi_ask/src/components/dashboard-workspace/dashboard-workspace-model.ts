import type { CellValue, DashboardFilterConfig, DashboardSheet, Filters } from '../../types';

export type WidgetDataMap = Record<
  string,
  { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
>;

export function storageKeyForDashboard(slug: string): string {
  return `sheets:${slug || 'default'}`;
}

export function applySqlFilters(
  query: string,
  filterDefs: DashboardFilterConfig[],
  filters: Filters,
): string {
  let sql = query;
  for (const filterDef of filterDefs) {
    const placeholder = `--filter:${filterDef.field}--`;
    if (!sql.includes(placeholder)) continue;
    const value = filters[filterDef.field];
    const replacement = value && value !== 'All' ? `'${String(value).replace(/'/g, "''")}'` : '1=1';
    sql = sql.replaceAll(placeholder, replacement);
  }
  return sql;
}

export function filterSheetData(
  sheetData: WidgetDataMap,
  crossFilters: Record<string, CellValue[]>,
): WidgetDataMap {
  if (!Object.keys(crossFilters).length) return { ...sheetData };

  const filterValues = Object.values(crossFilters).flat() as string[];
  const result: WidgetDataMap = {};

  for (const [widgetId, data] of Object.entries(sheetData)) {
    const rows = (data.rows ?? []).filter((row) => {
      const label = String(row.label ?? row.name ?? '');
      return filterValues.includes(label);
    });

    result[widgetId] = {
      labels: rows.map((row) => String(row.label ?? row.name ?? '')),
      values: rows.map((row) => Number(row.value ?? 0)),
      rows,
    };
  }

  return result;
}

export function exportFileBaseName(sheetName: string): string {
  return sheetName.replace(/\s+/g, '-').toLowerCase();
}

export function sanitizePersistedDashboardLayouts(value: unknown): DashboardSheet[] {
  if (!Array.isArray(value)) return [];
  return value.map((sheet) => {
    const clean = { ...(sheet as Record<string, unknown>) };
    delete clean.width;
    delete clean.height;
    return clean as unknown as DashboardSheet;
  });
}
