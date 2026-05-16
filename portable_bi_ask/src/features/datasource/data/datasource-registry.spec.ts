import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataSourceConfig } from '../../../shared/types/index';
import { createEmptyDatasourceConfig } from '../model/datasource-config';

type DatasourceRegistryModule = typeof import('./datasource-registry');

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createLocalStorageMock(seed: Record<string, string> = {}): {
  store: Map<string, string>;
  localStorage: LocalStorageMock;
} {
  const store = new Map(Object.entries(seed));
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

async function importFreshRegistry(ls: LocalStorageMock): Promise<DatasourceRegistryModule> {
  vi.resetModules();
  vi.stubGlobal('localStorage', ls);
  return import('./datasource-registry');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('createEmptyDatasourceConfig', () => {
  it('returns a valid DataSourceConfig with required fields', () => {
    const ds = createEmptyDatasourceConfig();
    expect(ds.id).toBeTruthy();
    expect(ds.slug).toBe(ds.id);
    expect(ds.name).toBe('');
    expect(ds.type).toBe('csv');
    expect(ds.source).toBe('user');
    expect(ds.createdAt).toBeTruthy();
    expect(ds.updatedAt).toBeTruthy();
  });

  it('applies overrides', () => {
    const ds = createEmptyDatasourceConfig({ name: 'My DS', type: 'parquet' });
    expect(ds.name).toBe('My DS');
    expect(ds.type).toBe('parquet');
  });
});

describe('datasource-registry', () => {
  let ls: ReturnType<typeof createLocalStorageMock>;
  let registry: DatasourceRegistryModule;

  beforeEach(async () => {
    ls = createLocalStorageMock();
    registry = await importFreshRegistry(ls.localStorage);
  });

  it('addDatasource stores and returns a new datasource', () => {
    const ds = registry.addDatasource({ name: 'Sales', type: 'csv', url: 'https://x.com/s.csv' });
    expect(ds.slug).toBeTruthy();
    expect(registry.getDatasourceBySlug(ds.slug)).toEqual(ds);
  });

  it('addDatasource generates a unique slug from name', () => {
    const ds1 = registry.addDatasource({ name: 'Sales', type: 'csv', url: 'https://x.com/a.csv' });
    const ds2 = registry.addDatasource({ name: 'Sales', type: 'csv', url: 'https://x.com/b.csv' });
    expect(ds1.slug).not.toBe(ds2.slug);
  });

  it('addDatasource throws on explicit duplicate slug', () => {
    registry.addDatasource({ name: 'A', type: 'csv', url: 'https://x.com/a.csv', slug: 'my-slug' });
    expect(() =>
      registry.addDatasource({
        name: 'B',
        type: 'csv',
        url: 'https://x.com/b.csv',
        slug: 'my-slug',
      }),
    ).toThrow();
  });

  it('addDatasource generates id and timestamps', () => {
    const ds = registry.addDatasource({ name: 'X', type: 'csv', url: 'https://x.com/x.csv' });
    expect(ds.id).toBeTruthy();
    expect(ds.createdAt).toBeTruthy();
    expect(ds.updatedAt).toBeTruthy();
    expect(ds.source).toBe('user');
  });

  it('getDatasourceBySlug returns undefined for unknown slug', () => {
    expect(registry.getDatasourceBySlug('ghost')).toBeUndefined();
  });

  it('getDatasourceByUrl finds a datasource by url (case-insensitive)', () => {
    const ds = registry.addDatasource({ name: 'X', type: 'csv', url: 'https://X.COM/data.csv' });
    expect(registry.getDatasourceByUrl('https://x.com/data.csv')).toEqual(ds);
  });

  it('updateDatasource changes fields and bumps updatedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const ds = registry.addDatasource({ name: 'Old', type: 'csv', url: 'https://x.com/x.csv' });
    vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));
    const updated = registry.updateDatasource(ds.slug, { name: 'New' });
    vi.useRealTimers();
    expect(updated.name).toBe('New');
    expect(updated.slug).toBe(ds.slug);
    expect(updated.updatedAt).not.toBe(ds.updatedAt);
  });

  it('updateDatasource throws for unknown or read-only slug', () => {
    expect(() => registry.updateDatasource('ghost', { name: 'X' })).toThrow();
  });

  it('deleteDatasource removes a user datasource', () => {
    const ds = registry.addDatasource({ name: 'Temp', type: 'csv', url: 'https://x.com/t.csv' });
    registry.deleteDatasource(ds.slug);
    expect(registry.getDatasourceBySlug(ds.slug)).toBeUndefined();
  });

  it('deleteDatasource silently returns when slug does not exist', () => {
    expect(() => registry.deleteDatasource('ghost')).not.toThrow();
  });

  it('deleteDatasource removes datasource from localStorage', () => {
    const ds = registry.addDatasource({ name: 'Stored', type: 'csv', url: 'https://x.com/s.csv' });
    registry.deleteDatasource(ds.slug);
    const raw = ls.store.get('persisted_datasources_v1');
    const stored: DataSourceConfig[] = raw ? JSON.parse(raw) : [];
    expect(stored.some((d) => d.slug === ds.slug)).toBe(false);
  });

  it('deleteDatasource throws for YAML-seeded datasources', () => {
    const seed: DataSourceConfig = {
      ...createEmptyDatasourceConfig(),
      slug: 'seed-ds',
      source: 'yaml',
    };
    registry.registerSeedDatasource(seed);
    expect(() => registry.deleteDatasource('seed-ds')).toThrow();
  });

  it('datasourceList includes both seed and user datasources', () => {
    const seed: DataSourceConfig = {
      ...createEmptyDatasourceConfig(),
      slug: 'seed',
      source: 'yaml',
    };
    registry.registerSeedDatasource(seed);
    registry.addDatasource({ name: 'User DS', type: 'csv', url: 'https://x.com/u.csv' });
    const list = registry.datasourceList();
    expect(list.some((d) => d.slug === 'seed')).toBe(true);
    expect(list.some((d) => d.source === 'user')).toBe(true);
  });

  it('persists user datasources to localStorage across reloads', async () => {
    registry.addDatasource({ name: 'Persisted', type: 'csv', url: 'https://x.com/p.csv' });
    const raw = ls.store.get('persisted_datasources_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].name).toBe('Persisted');

    const reloaded = await importFreshRegistry(ls.localStorage);
    expect(reloaded.getDatasourceBySlug(parsed[0].slug)?.name).toBe('Persisted');
  });

  it('datasourceList loads two seed datasources from YAML', () => {
    const list = registry.datasourceList();
    const seeds = list.filter((d) => d.source === 'yaml');
    expect(seeds.length).toBeGreaterThanOrEqual(2);
  });
});
