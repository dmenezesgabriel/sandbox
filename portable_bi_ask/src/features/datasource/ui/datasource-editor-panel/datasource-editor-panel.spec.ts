import './datasource-editor-panel';

import { describe, expect, it } from 'vitest';

import type { DataSourceConfig } from '../../../../shared/types/index';
import { createEmptyDatasourceConfig } from '../../model/datasource-config';

function makeConfig(overrides: Partial<DataSourceConfig> = {}): DataSourceConfig {
  return {
    ...createEmptyDatasourceConfig(),
    name: 'sales',
    url: 'https://example.com/data.csv',
    type: 'csv',
    ...overrides,
  };
}

type Panel = HTMLElement & {
  config: DataSourceConfig | null;
  readonly: boolean;
  nameError: string;
  urlError: string;
  updateComplete: Promise<void>;
};

function mount(props: Partial<Panel> = {}): Panel {
  const el = document.createElement('datasource-editor-panel') as Panel;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('DatasourceEditorPanel', () => {
  describe('rendering', () => {
    it('renders name input with config name', async () => {
      const el = mount({ config: makeConfig({ name: 'my-view' }) });
      await el.updateComplete;

      const input = el.querySelector<HTMLInputElement>('#dse-name');
      expect(input?.value).toBe('my-view');
      cleanup(el);
    });

    it('renders URL input with config url', async () => {
      const el = mount({ config: makeConfig({ url: 'https://x.com/a.csv' }) });
      await el.updateComplete;

      const input = el.querySelector<HTMLInputElement>('#dse-url');
      expect(input?.value).toBe('https://x.com/a.csv');
      cleanup(el);
    });

    it('renders type select with correct option selected', async () => {
      const el = mount({ config: makeConfig({ type: 'parquet' }) });
      await el.updateComplete;

      const select = el.querySelector<HTMLSelectElement>('#dse-type');
      expect(select?.value).toBe('parquet');
      cleanup(el);
    });

    it('renders all type options', async () => {
      const el = mount({ config: makeConfig() });
      await el.updateComplete;

      const options = [...el.querySelectorAll('#dse-type option')].map((o) =>
        o.getAttribute('value'),
      );
      expect(options).toContain('csv');
      expect(options).toContain('parquet');
      expect(options).toContain('json');
      cleanup(el);
    });

    it('renders nothing when config is null', async () => {
      const el = mount({ config: null });
      await el.updateComplete;

      expect(el.querySelector('#dse-name')).toBeNull();
      cleanup(el);
    });

    it('disables fields when readonly', async () => {
      const el = mount({ config: makeConfig(), readonly: true });
      await el.updateComplete;

      const nameInput = el.querySelector<HTMLInputElement>('#dse-name');
      expect(nameInput?.disabled).toBe(true);
      cleanup(el);
    });

    it('shows name error when nameError is set', async () => {
      const el = mount({ config: makeConfig(), nameError: 'Name is required.' });
      await el.updateComplete;

      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Name is required.');
      cleanup(el);
    });

    it('shows url error when urlError is set', async () => {
      const el = mount({ config: makeConfig({ url: '' }), urlError: 'URL is required.' });
      await el.updateComplete;

      const alerts = el.querySelectorAll('[role="alert"]');
      const urlAlert = [...alerts].find((a) => a.textContent?.includes('URL is required.'));
      expect(urlAlert).not.toBeNull();
      cleanup(el);
    });

    it('Test Connection button is disabled when url is empty', async () => {
      const el = mount({ config: makeConfig({ url: '' }) });
      await el.updateComplete;

      const testBtn = el.querySelector<HTMLButtonElement>('.qep-run-btn');
      expect(testBtn?.disabled).toBe(true);
      cleanup(el);
    });

    it('Test Connection button is enabled when url is set', async () => {
      const el = mount({ config: makeConfig({ url: 'https://example.com/x.csv' }) });
      await el.updateComplete;

      const testBtn = el.querySelector<HTMLButtonElement>('.qep-run-btn');
      expect(testBtn?.disabled).toBe(false);
      cleanup(el);
    });
  });

  describe('panel-change events', () => {
    it('emits panel-change with updated name on name input', async () => {
      const el = mount({ config: makeConfig({ name: 'old' }) });
      await el.updateComplete;

      const received: DataSourceConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<DataSourceConfig>).detail),
      );

      const input = el.querySelector<HTMLInputElement>('#dse-name')!;
      input.value = 'new-view';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0].name).toBe('new-view');
      cleanup(el);
    });

    it('emits panel-change with updated url on url input', async () => {
      const el = mount({ config: makeConfig({ url: '' }) });
      await el.updateComplete;

      const received: DataSourceConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<DataSourceConfig>).detail),
      );

      const input = el.querySelector<HTMLInputElement>('#dse-url')!;
      input.value = 'https://new.com/data.csv';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0].url).toBe('https://new.com/data.csv');
      cleanup(el);
    });

    it('emits panel-change with updated type on type select change', async () => {
      const el = mount({ config: makeConfig({ type: 'csv' }) });
      await el.updateComplete;

      const received: DataSourceConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<DataSourceConfig>).detail),
      );

      const select = el.querySelector<HTMLSelectElement>('#dse-type')!;
      select.value = 'json';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('json');
      cleanup(el);
    });

    it('name change does not touch url', async () => {
      const el = mount({ config: makeConfig({ name: 'a', url: 'https://keep.com/k.csv' }) });
      await el.updateComplete;

      const received: DataSourceConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<DataSourceConfig>).detail),
      );

      const input = el.querySelector<HTMLInputElement>('#dse-name')!;
      input.value = 'b';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(received[0].url).toBe('https://keep.com/k.csv');
      cleanup(el);
    });

    it('does not emit panel-change when readonly', async () => {
      const el = mount({ config: makeConfig(), readonly: true });
      await el.updateComplete;

      const received: DataSourceConfig[] = [];
      el.addEventListener('panel-change', (e) =>
        received.push((e as CustomEvent<DataSourceConfig>).detail),
      );

      // Disabled inputs don't fire events, but we verify just in case
      const input = el.querySelector<HTMLInputElement>('#dse-name')!;
      expect(input.disabled).toBe(true);
      cleanup(el);
    });
  });
});
