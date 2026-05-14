import { describe, expect, it } from 'vitest';

import { parseQuestionYaml, serializeQuestionYaml } from './question-yaml';

const VALID_YAML = `
id: 'my-chart'
slug: 'my-chart'
title: 'My Chart'
type: chart
chartType: bar
queryType: sql
query: 'SELECT 1 AS value'
`;

describe('parseQuestionYaml', () => {
  it('parses a minimal valid YAML string', () => {
    const q = parseQuestionYaml(VALID_YAML);
    expect(q.id).toBe('my-chart');
    expect(q.title).toBe('My Chart');
    expect(q.type).toBe('chart');
    expect(q.chartType).toBe('bar');
    expect(q.source).toBe('yaml');
  });

  it('throws when id is missing', () => {
    const bad = VALID_YAML.replace("id: 'my-chart'\n", '');
    expect(() => parseQuestionYaml(bad)).toThrow();
  });

  it('throws when type is invalid', () => {
    const bad = VALID_YAML.replace('type: chart', 'type: unknown');
    expect(() => parseQuestionYaml(bad)).toThrow();
  });

  it('throws when chartType is invalid', () => {
    const bad = VALID_YAML.replace('chartType: bar', 'chartType: rainbow');
    expect(() => parseQuestionYaml(bad)).toThrow();
  });
});

describe('serializeQuestionYaml', () => {
  it('round-trips through parse and serialize', () => {
    const q = parseQuestionYaml(VALID_YAML);
    const serialized = serializeQuestionYaml(q);
    const q2 = parseQuestionYaml(serialized);
    expect(q2.id).toBe(q.id);
    expect(q2.title).toBe(q.title);
    expect(q2.type).toBe(q.type);
    expect(q2.query).toBe(q.query);
  });

  it('omits undefined optional fields', () => {
    const q = parseQuestionYaml(VALID_YAML);
    const serialized = serializeQuestionYaml(q);
    expect(serialized).not.toContain('dataSources');
    expect(serialized).not.toContain('description');
  });
});
