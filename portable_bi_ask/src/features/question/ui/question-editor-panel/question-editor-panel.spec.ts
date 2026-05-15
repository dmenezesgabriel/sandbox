import '../../../dashboard/ui/widget';
import './index';

import { describe, expect, it } from 'vitest';

import type { QuestionConfig } from '../../../../shared/types/index';
import { QuestionEditorPanel } from './question-editor-panel';

function makeConfig(overrides: Partial<QuestionConfig> = {}): QuestionConfig {
  return {
    id: 'test-q',
    slug: 'test-q',
    title: 'Test Question',
    type: 'chart',
    chartType: 'bar',
    source: 'user',
    dataSources: [{ name: 'sales', url: 'sales.csv' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mount(
  props: Partial<{ config: QuestionConfig; dataSources: unknown[] }> = {},
): QuestionEditorPanel {
  const el = document.createElement('question-editor-panel') as QuestionEditorPanel;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('QuestionEditorPanel', () => {
  describe('_renderPreview()', () => {
    it('renders app-widget (not the old widget tag) when preview data is set', async () => {
      const el = mount({ config: makeConfig() });
      await el.updateComplete;

      // Inject preview data by calling runPreview's internal state directly via the public method path:
      // We reach the preview state by accessing the private field via a cast.
      (el as unknown as Record<string, unknown>)['_previewData'] = {
        labels: ['A', 'B'],
        values: [1, 2],
        rows: [],
      };
      el.requestUpdate();
      await el.updateComplete;

      expect(el.querySelector('app-widget')).not.toBeNull();
      expect(el.querySelector('widget')).toBeNull();
      cleanup(el);
    });

    it('does not render app-widget when there is no preview data', async () => {
      const el = mount({ config: makeConfig() });
      await el.updateComplete;

      expect(el.querySelector('app-widget')).toBeNull();
      cleanup(el);
    });

    it('renders placeholder when no data sources are configured', async () => {
      const el = mount({ config: makeConfig({ dataSources: [] }) });
      await el.updateComplete;

      expect(el.querySelector('.qep-preview-placeholder')?.textContent).toContain(
        'Add a data source',
      );
      cleanup(el);
    });

    it('renders "Run preview" placeholder when data sources are set but no preview yet', async () => {
      const el = mount({ config: makeConfig() });
      await el.updateComplete;

      expect(el.querySelector('.qep-preview-placeholder')?.textContent).toContain('Run preview');
      cleanup(el);
    });
  });

  describe('rendering', () => {
    it('renders the title input with the config title', async () => {
      const el = mount({ config: makeConfig({ title: 'My Chart' }) });
      await el.updateComplete;

      const input = el.querySelector<HTMLInputElement>('#qep-title')!;
      expect(input.value).toBe('My Chart');
      cleanup(el);
    });

    it('renders nothing when config is null', async () => {
      const el = mount({ config: undefined as unknown as QuestionConfig });
      await el.updateComplete;

      expect(el.querySelector('.qep-layout')).toBeNull();
      cleanup(el);
    });
  });
});
