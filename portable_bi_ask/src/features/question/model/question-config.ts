import type { QuestionConfig } from '../../../shared/types/index';

export function createEmptyQuestionConfig(overrides: Partial<QuestionConfig> = {}): QuestionConfig {
  const now = new Date().toISOString();
  const id = `question-${Date.now()}`;
  return {
    id,
    slug: id,
    title: 'Untitled Question',
    type: 'chart',
    chartType: 'bar',
    queryType: 'sql',
    query: '',
    source: 'user',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
