import { createEmptyQuestionConfig } from './question-config';
import { parseQuestionYaml } from './question-yaml';
import salesByRegionYaml from './questions/sales-by-region.yaml?raw';
import topProductsYaml from './questions/top-products.yaml?raw';
import type { QuestionConfig } from './types';

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'persisted_questions_v1';

function loadPersistedQuestions(): QuestionConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QuestionConfig[]) : [];
  } catch {
    return [];
  }
}

function persistQuestions(questions: QuestionConfig[]): void {
  const userQuestions = questions.filter((q) => q.source === 'user');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userQuestions));
}

// ── Seed questions (YAML-sourced) ─────────────────────────────────────────────

const _seedQuestions: QuestionConfig[] = [];

export function registerSeedQuestion(q: QuestionConfig): void {
  if (!_seedQuestions.find((s) => s.slug === q.slug)) {
    _seedQuestions.push({ ...q, source: 'yaml' });
  }
}

(function loadSeeds() {
  for (const raw of [salesByRegionYaml, topProductsYaml]) {
    try {
      const q = parseQuestionYaml(raw);
      registerSeedQuestion(q);
    } catch (err) {
      console.error('[question-registry] Failed to load seed question:', err);
    }
  }
})();

// ── In-memory registry ────────────────────────────────────────────────────────

let _userQuestions: QuestionConfig[] = loadPersistedQuestions();

export function questionList(): QuestionConfig[] {
  return [..._seedQuestions, ..._userQuestions];
}

export function getQuestionBySlug(slug: string): QuestionConfig | undefined {
  return questionList().find((q) => q.slug === slug);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function generateUniqueSlug(base: string): string {
  const slug =
    base
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'question';

  if (!getQuestionBySlug(slug)) return slug;

  let n = 2;
  while (getQuestionBySlug(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

export function addQuestion(partial: Partial<QuestionConfig>): QuestionConfig {
  const base = partial.title ?? 'Untitled Question';
  const slug = partial.slug ?? generateUniqueSlug(base);

  if (getQuestionBySlug(slug)) {
    throw new Error(`Question slug already exists: "${slug}"`);
  }

  const question: QuestionConfig = {
    ...createEmptyQuestionConfig(),
    ...partial,
    slug,
    source: 'user',
  };

  _userQuestions = [..._userQuestions, question];
  persistQuestions(_userQuestions);
  return question;
}

export function updateQuestion(slug: string, changes: Partial<QuestionConfig>): QuestionConfig {
  const existing = _userQuestions.find((q) => q.slug === slug);
  if (!existing)
    throw new Error(`Cannot update question: slug "${slug}" not found or is read-only`);

  const updated: QuestionConfig = {
    ...existing,
    ...changes,
    slug,
    source: 'user',
    updatedAt: new Date().toISOString(),
  };

  _userQuestions = _userQuestions.map((q) => (q.slug === slug ? updated : q));
  persistQuestions(_userQuestions);
  return updated;
}

export function deleteQuestion(slug: string): void {
  const question = getQuestionBySlug(slug);
  if (!question) return;
  if (question.source === 'yaml') {
    throw new Error(`Cannot delete YAML-seeded question: "${slug}"`);
  }
  _userQuestions = _userQuestions.filter((q) => q.slug !== slug);
  persistQuestions(_userQuestions);
}
