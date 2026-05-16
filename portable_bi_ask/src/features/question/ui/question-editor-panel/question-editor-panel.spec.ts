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
    dataSourceSlugs: ['superstore-sales'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mount(props: Partial<{ config: QuestionConfig }> = {}): QuestionEditorPanel {
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

    it('renders placeholder when no datasource slugs are configured', async () => {
      const el = mount({ config: makeConfig({ dataSourceSlugs: [] }) });
      await el.updateComplete;

      expect(el.querySelector('.qep-preview-placeholder')?.textContent).toContain(
        'Link a datasource',
      );
      cleanup(el);
    });

    it('renders "Run preview" placeholder when datasource slugs are set but no preview yet', async () => {
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

  describe('_renderQuerySection()', () => {
    it('renders ui-code-editor when queryType is "sql"', async () => {
      const el = mount({ config: makeConfig({ queryType: 'sql', query: 'SELECT 1' }) });
      await el.updateComplete;

      expect(el.querySelector('ui-code-editor')).not.toBeNull();
      expect(el.querySelector('textarea.qep-query-input')).toBeNull();
      cleanup(el);
    });

    it('renders a textarea when queryType is "nl"', async () => {
      const el = mount({ config: makeConfig({ queryType: 'nl', nlQuery: 'active users' }) });
      await el.updateComplete;

      expect(el.querySelector('textarea.qep-query-input')).not.toBeNull();
      expect(el.querySelector('ui-code-editor')).toBeNull();
      cleanup(el);
    });

    it('emits panel-change with updated query on ui-code-editor value-change', async () => {
      const el = mount({ config: makeConfig({ queryType: 'sql', query: '' }) });
      await el.updateComplete;

      const received: QuestionConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<QuestionConfig>).detail),
      );

      const editor = el.querySelector('ui-code-editor')!;
      editor.dispatchEvent(
        new CustomEvent<string>('value-change', {
          detail: 'SELECT 2',
          bubbles: true,
          composed: true,
        }),
      );

      expect(received).toHaveLength(1);
      expect(received[0].query).toBe('SELECT 2');
      cleanup(el);
    });

    it('emits panel-change with updated nlQuery on NL textarea input', async () => {
      const el = mount({ config: makeConfig({ queryType: 'nl', nlQuery: '' }) });
      await el.updateComplete;

      const received: QuestionConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<QuestionConfig>).detail),
      );

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea.qep-query-input')!;
      textarea.value = 'revenue by month';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0].nlQuery).toBe('revenue by month');
      cleanup(el);
    });

    it('SQL value-change does not touch nlQuery', async () => {
      const el = mount({ config: makeConfig({ queryType: 'sql', query: '', nlQuery: 'kept' }) });
      await el.updateComplete;

      const received: QuestionConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<QuestionConfig>).detail),
      );

      const editor = el.querySelector('ui-code-editor')!;
      editor.dispatchEvent(
        new CustomEvent<string>('value-change', {
          detail: 'SELECT 1',
          bubbles: true,
          composed: true,
        }),
      );

      expect(received[0].nlQuery).toBe('kept');
      cleanup(el);
    });

    it('NL textarea input does not touch query', async () => {
      const el = mount({
        config: makeConfig({ queryType: 'nl', nlQuery: '', query: 'SELECT kept' }),
      });
      await el.updateComplete;

      const received: QuestionConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<QuestionConfig>).detail),
      );

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea.qep-query-input')!;
      textarea.value = 'new nl';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      expect(received[0].query).toBe('SELECT kept');
      cleanup(el);
    });

    it('NL textarea shows nlQuery when set', async () => {
      const el = mount({ config: makeConfig({ queryType: 'nl', nlQuery: 'top products' }) });
      await el.updateComplete;

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea.qep-query-input')!;
      expect(textarea.value).toBe('top products');
      cleanup(el);
    });

    it('NL textarea is empty when nlQuery is undefined', async () => {
      const el = mount({
        config: makeConfig({ queryType: 'nl', nlQuery: undefined, query: 'SELECT 1' }),
      });
      await el.updateComplete;

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea.qep-query-input')!;
      expect(textarea.value).toBe('');
      cleanup(el);
    });
  });
});
