import type { DataSourceType } from '../../../shared/types/index';
import { addDatasource, datasourceList, getDatasourceByUrl } from '../data/datasource-registry';

interface LegacyDataSourceEntry {
  name: string;
  url: string;
}

interface MigratableQuestion {
  slug?: string;
  dataSourceSlugs?: string[];
  dataSources?: LegacyDataSourceEntry[];
}

interface MigratableDashboard {
  dataSources?: LegacyDataSourceEntry[];
  dataSourceSlugs?: string[];
}

function inferTypeFromUrl(url: string): DataSourceType {
  const lower = url.toLowerCase();
  if (lower.endsWith('.parquet')) return 'parquet';
  if (lower.endsWith('.json')) return 'json';
  return 'csv';
}

function inferNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop() ?? '';
    const base = segment.replace(/\.[^.]+$/, '');
    return base ? base.charAt(0).toUpperCase() + base.slice(1).replace(/[-_]/g, ' ') : 'Datasource';
  } catch {
    return 'Datasource';
  }
}

function promoteEmbeddedSources(sources: LegacyDataSourceEntry[]): string[] {
  const slugs: string[] = [];
  for (const src of sources) {
    const url = src.url?.trim();
    if (!url) continue;

    const existing = getDatasourceByUrl(url);
    if (existing) {
      slugs.push(existing.slug);
      continue;
    }

    try {
      const added = addDatasource({
        name: src.name || inferNameFromUrl(url),
        url,
        type: inferTypeFromUrl(url),
      });
      slugs.push(added.slug);
    } catch (err) {
      console.warn('[datasource-migration] Could not promote datasource:', url, err);
    }
  }
  return slugs;
}

export function migrateQuestions<T extends MigratableQuestion>(questions: T[]): T[] {
  return questions.map((q) => {
    if (!Array.isArray(q.dataSources) || q.dataSources.length === 0) return q;

    const slugs = promoteEmbeddedSources(q.dataSources);
    const rest = Object.fromEntries(
      Object.entries(q as Record<string, unknown>).filter(([k]) => k !== 'dataSources'),
    );
    return { ...rest, dataSourceSlugs: slugs } as unknown as T;
  });
}

export function migrateDashboards<T extends MigratableDashboard>(dashboards: T[]): T[] {
  return dashboards.map((d) => {
    if (!Array.isArray(d.dataSources) || d.dataSources.length === 0) return d;

    const slugs = promoteEmbeddedSources(d.dataSources);
    const rest = Object.fromEntries(
      Object.entries(d as Record<string, unknown>).filter(([k]) => k !== 'dataSources'),
    );
    return { ...rest, dataSourceSlugs: slugs } as unknown as T;
  });
}

export function runMigration<Q extends MigratableQuestion, D extends MigratableDashboard>(
  questions: Q[],
  dashboards: D[],
): { questions: Q[]; dashboards: D[] } {
  const migratedQuestions = migrateQuestions(questions);
  const migratedDashboards = migrateDashboards(dashboards);
  return { questions: migratedQuestions, dashboards: migratedDashboards };
}

export { datasourceList };
