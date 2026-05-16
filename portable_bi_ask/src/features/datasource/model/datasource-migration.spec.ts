import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MigrationModule = typeof import('./datasource-migration');
type RegistryModule = typeof import('../data/datasource-registry');

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createLocalStorageMock(): { store: Map<string, string>; localStorage: LocalStorageMock } {
  const store = new Map<string, string>();
  return {
    store,
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  };
}

async function importFreshModules(ls: LocalStorageMock): Promise<{
  migration: MigrationModule;
  registry: RegistryModule;
}> {
  vi.resetModules();
  vi.stubGlobal('localStorage', ls);
  const registry = await import('../data/datasource-registry');
  const migration = await import('./datasource-migration');
  return { migration, registry };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('migrateQuestions', () => {
  let ls: ReturnType<typeof createLocalStorageMock>;
  let migration: MigrationModule;

  beforeEach(async () => {
    ls = createLocalStorageMock();
    ({ migration } = await importFreshModules(ls.localStorage));
  });

  it('promotes embedded dataSources to registry and returns dataSourceSlugs', () => {
    type Q = {
      slug: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    const questions: Q[] = [
      { slug: 'q1', dataSources: [{ name: 'sales', url: 'https://example.com/sales.csv' }] },
    ];
    const result = migration.migrateQuestions(questions);
    expect(result[0].dataSourceSlugs).toHaveLength(1);
    expect(result[0].dataSources).toBeUndefined();
  });

  it('de-duplicates datasources with the same URL across multiple questions', () => {
    type Q = {
      slug: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    const url = 'https://example.com/shared.csv';
    const questions: Q[] = [
      { slug: 'q1', dataSources: [{ name: 'shared', url }] },
      { slug: 'q2', dataSources: [{ name: 'shared-copy', url }] },
    ];
    const result = migration.migrateQuestions(questions);
    expect(result[0].dataSourceSlugs![0]).toBe(result[1].dataSourceSlugs![0]);
    expect(migration.datasourceList().filter((d) => d.source === 'user')).toHaveLength(1);
  });

  it('a single question with two different URLs gets two slugs', () => {
    type Q = {
      slug: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    const questions: Q[] = [
      {
        slug: 'q1',
        dataSources: [
          { name: 'a', url: 'https://example.com/a.csv' },
          { name: 'b', url: 'https://example.com/b.csv' },
        ],
      },
    ];
    const result = migration.migrateQuestions(questions);
    expect(result[0].dataSourceSlugs).toHaveLength(2);
    expect(result[0].dataSourceSlugs![0]).not.toBe(result[0].dataSourceSlugs![1]);
  });

  it('leaves questions without dataSources unchanged', () => {
    type Q = { slug: string; title: string; dataSourceSlugs?: string[] };
    const questions: Q[] = [{ slug: 'q1', title: 'No DS' }];
    const result = migration.migrateQuestions(questions);
    expect(result[0]).toEqual(questions[0]);
    expect(result[0].dataSourceSlugs).toBeUndefined();
  });

  it('is idempotent — running twice yields the same slugs without duplicating registry entries', () => {
    type Q = {
      slug: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    const questions: Q[] = [
      { slug: 'q1', dataSources: [{ name: 'x', url: 'https://example.com/x.csv' }] },
    ];
    const first = migration.migrateQuestions(questions);
    const second = migration.migrateQuestions(first);
    expect(second[0].dataSourceSlugs).toEqual(first[0].dataSourceSlugs);
    const userEntries = migration.datasourceList().filter((d) => d.source === 'user');
    expect(userEntries).toHaveLength(1);
  });
});

describe('migrateDashboards', () => {
  let ls: ReturnType<typeof createLocalStorageMock>;
  let migration: MigrationModule;

  beforeEach(async () => {
    ls = createLocalStorageMock();
    ({ migration } = await importFreshModules(ls.localStorage));
  });

  it('promotes embedded dataSources from dashboards', () => {
    type D = {
      title: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    const dashboards: D[] = [
      { title: 'D1', dataSources: [{ name: 'sales', url: 'https://example.com/sales.csv' }] },
    ];
    const result = migration.migrateDashboards(dashboards);
    expect(result[0].dataSourceSlugs).toHaveLength(1);
    expect(result[0].dataSources).toBeUndefined();
  });

  it('leaves dashboards without dataSources unchanged', () => {
    type D = { title: string; dataSourceSlugs?: string[] };
    const dashboards: D[] = [{ title: 'D1' }];
    const result = migration.migrateDashboards(dashboards);
    expect(result[0]).toEqual(dashboards[0]);
  });
});

describe('runMigration', () => {
  let ls: ReturnType<typeof createLocalStorageMock>;
  let migration: MigrationModule;

  beforeEach(async () => {
    ls = createLocalStorageMock();
    ({ migration } = await importFreshModules(ls.localStorage));
  });

  it('migrates both questions and dashboards in one call', () => {
    type Q = {
      slug: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    type D = {
      title: string;
      dataSources?: { name: string; url: string }[];
      dataSourceSlugs?: string[];
    };
    const url = 'https://example.com/shared.csv';
    const questions: Q[] = [{ slug: 'q1', dataSources: [{ name: 'x', url }] }];
    const dashboards: D[] = [{ title: 'D1', dataSources: [{ name: 'x', url }] }];
    const { questions: qs, dashboards: ds } = migration.runMigration(questions, dashboards);
    expect(qs[0].dataSourceSlugs).toHaveLength(1);
    expect(ds[0].dataSourceSlugs).toHaveLength(1);
    expect(qs[0].dataSourceSlugs![0]).toBe(ds[0].dataSourceSlugs![0]);
  });
});
