import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuestionConfig } from '../../../shared/types/index';
import { createEmptyQuestionConfig } from '../model/question-config';

type QuestionRegistryModule = typeof import('./question-registry');

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

async function importFreshRegistry(ls: LocalStorageMock): Promise<QuestionRegistryModule> {
  vi.resetModules();
  vi.stubGlobal('localStorage', ls);
  return import('./question-registry');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('createEmptyQuestionConfig', () => {
  it('returns a valid QuestionConfig with required fields', () => {
    const q = createEmptyQuestionConfig();
    expect(q.id).toBeTruthy();
    expect(q.slug).toBe(q.id);
    expect(q.title).toBe('Untitled Question');
    expect(q.type).toBe('chart');
    expect(q.source).toBe('user');
    expect(q.createdAt).toBeTruthy();
    expect(q.updatedAt).toBeTruthy();
  });

  it('applies overrides', () => {
    const q = createEmptyQuestionConfig({ title: 'My Chart', type: 'kpi' });
    expect(q.title).toBe('My Chart');
    expect(q.type).toBe('kpi');
  });
});

describe('question-registry', () => {
  let ls: ReturnType<typeof createLocalStorageMock>;
  let registry: QuestionRegistryModule;

  beforeEach(async () => {
    ls = createLocalStorageMock();
    registry = await importFreshRegistry(ls.localStorage);
  });

  it('addQuestion stores and returns a new question', () => {
    const q = registry.addQuestion({ title: 'Sales by Region', type: 'chart' });
    expect(q.slug).toBeTruthy();
    expect(registry.getQuestionBySlug(q.slug)).toEqual(q);
  });

  it('addQuestion generates a unique slug from title', () => {
    const q1 = registry.addQuestion({ title: 'Sales' });
    const q2 = registry.addQuestion({ title: 'Sales' });
    expect(q1.slug).not.toBe(q2.slug);
  });

  it('addQuestion throws on explicit duplicate slug', () => {
    registry.addQuestion({ slug: 'my-slug', title: 'A' });
    expect(() => registry.addQuestion({ slug: 'my-slug', title: 'B' })).toThrow();
  });

  it('updateQuestion changes fields but not slug', () => {
    const q = registry.addQuestion({ title: 'Old Title' });
    const updated = registry.updateQuestion(q.slug, { title: 'New Title' });
    expect(updated.title).toBe('New Title');
    expect(updated.slug).toBe(q.slug);
  });

  it('deleteQuestion removes a user question', () => {
    const q = registry.addQuestion({ title: 'Temp' });
    registry.deleteQuestion(q.slug);
    expect(registry.getQuestionBySlug(q.slug)).toBeUndefined();
  });

  it('deleteQuestion silently returns when slug does not exist', () => {
    expect(() => registry.deleteQuestion('ghost-slug')).not.toThrow();
  });

  it('deleteQuestion removes question from localStorage', () => {
    const q = registry.addQuestion({ title: 'Stored' });
    registry.deleteQuestion(q.slug);
    const raw = ls.store.get('persisted_questions_v1');
    const stored: QuestionConfig[] = raw ? JSON.parse(raw) : [];
    expect(stored.some((x) => x.slug === q.slug)).toBe(false);
  });

  it('deleteQuestion throws for YAML-seeded questions', () => {
    const seed: QuestionConfig = {
      ...createEmptyQuestionConfig(),
      slug: 'seed-q',
      source: 'yaml',
    };
    registry.registerSeedQuestion(seed);
    expect(() => registry.deleteQuestion('seed-q')).toThrow();
  });

  it('questionList includes both seed and user questions', () => {
    const seed: QuestionConfig = { ...createEmptyQuestionConfig(), slug: 'seed', source: 'yaml' };
    registry.registerSeedQuestion(seed);
    registry.addQuestion({ title: 'User Q' });
    const list = registry.questionList();
    expect(list.some((q) => q.slug === 'seed')).toBe(true);
    expect(list.some((q) => q.source === 'user')).toBe(true);
  });

  it('persists user questions to localStorage across reloads', async () => {
    registry.addQuestion({ title: 'Persisted' });
    const raw = ls.store.get('persisted_questions_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].title).toBe('Persisted');

    const reloaded = await importFreshRegistry(ls.localStorage);
    expect(reloaded.getQuestionBySlug(parsed[0].slug)?.title).toBe('Persisted');
  });
});
