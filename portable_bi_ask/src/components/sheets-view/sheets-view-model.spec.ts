import { describe, expect, it } from 'vitest';

import type { DashboardFilterConfig } from '../../types';
import {
  applySqlFilters,
  exportFileBaseName,
  filterSheetData,
  sanitizePersistedSheets,
  storageKeyForSheets,
} from './sheets-view-model';

const filterDefs: DashboardFilterConfig[] = [
  {
    field: 'region',
    label: 'Region',
    source: { table: 'sales', column: 'region' },
    type: 'select',
  },
];

describe('sheets-view-model', () => {
  describe('applySqlFilters', () => {
    it('replaces placeholders with escaped filter values', () => {
      const sql = applySqlFilters(
        'SELECT * FROM sales WHERE region = --filter:region--',
        filterDefs,
        { region: "O'Hare" },
      );

      expect(sql).toBe("SELECT * FROM sales WHERE region = 'O''Hare'");
    });

    it('replaces missing or All filters with 1=1', () => {
      const sql = applySqlFilters('SELECT * FROM sales WHERE --filter:region--', filterDefs, {
        region: 'All',
      });

      expect(sql).toBe('SELECT * FROM sales WHERE 1=1');
    });
  });

  describe('filterSheetData', () => {
    it('filters each widget rows by active cross-filter labels', () => {
      const data = filterSheetData(
        {
          widgetA: {
            labels: ['West', 'East'],
            values: [10, 20],
            rows: [
              { label: 'West', value: 10 },
              { label: 'East', value: 20 },
            ],
          },
        },
        { label: ['East'] },
      );

      expect(data.widgetA).toEqual({
        labels: ['East'],
        values: [20],
        rows: [{ label: 'East', value: 20 }],
      });
    });
  });

  describe('storageKeyForSheets', () => {
    it('uses a default namespace when no slug is provided', () => {
      expect(storageKeyForSheets('')).toBe('sheets:default');
      expect(storageKeyForSheets('sales')).toBe('sheets:sales');
    });
  });

  describe('exportFileBaseName', () => {
    it('creates a lowercase dash-separated basename', () => {
      expect(exportFileBaseName('Regional Sales Report')).toBe('regional-sales-report');
    });
  });

  describe('sanitizePersistedSheets', () => {
    it('removes legacy width/height fields and ignores non-arrays', () => {
      expect(sanitizePersistedSheets(null)).toEqual([]);
      expect(
        sanitizePersistedSheets([
          {
            id: 'sheet-1',
            name: 'Overview',
            type: 'sheet',
            widgets: [],
            layout: [],
            width: 1200,
            height: 800,
          },
        ]),
      ).toEqual([{ id: 'sheet-1', name: 'Overview', type: 'sheet', widgets: [], layout: [] }]);
    });
  });
});
