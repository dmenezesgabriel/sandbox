import './datasource-list';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addDatasource,
  deleteDatasource,
  getDatasourceBySlug,
} from '../../data/datasource-registry';

function mount(): HTMLElement {
  const el = document.createElement('datasource-list');
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

async function updateComplete(el: HTMLElement): Promise<void> {
  await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
}

describe('DatasourceList', () => {
  const createdSlugs: string[] = [];

  afterEach(() => {
    for (const slug of createdSlugs) {
      try {
        deleteDatasource(slug);
      } catch {
        /* ignore */
      }
    }
    createdSlugs.length = 0;
  });

  describe('rendering', () => {
    it('renders seed datasources (sales, customer, product)', async () => {
      const el = mount();
      await updateComplete(el);

      const titles = [...el.querySelectorAll('.collection-list-row-title')].map((n) =>
        n.textContent?.trim(),
      );
      expect(titles).toContain('sales');
      expect(titles).toContain('customer');
      expect(titles).toContain('product');
      cleanup(el);
    });

    it('shows CSV type badge for seed entries', async () => {
      const el = mount();
      await updateComplete(el);

      const badge = el.querySelector('.ds-type-badge');
      expect(badge?.textContent).toContain('CSV');
      cleanup(el);
    });

    it('shows read-only label for yaml-sourced entries', async () => {
      const el = mount();
      await updateComplete(el);

      expect(el.textContent).toContain('read-only');
      cleanup(el);
    });

    it('shows delete button only for user-sourced entries', async () => {
      const ds = addDatasource({ name: 'tmp', type: 'csv', url: 'https://x.com/a.csv' });
      createdSlugs.push(ds.slug);

      const el = mount();
      await updateComplete(el);

      // Seed entries have no delete button; only the user entry has one
      const deleteButtons = el.querySelectorAll('button[aria-label="Delete"]');
      expect(deleteButtons).toHaveLength(1);
      cleanup(el);
    });

    it('renders item count label', async () => {
      const el = mount();
      await updateComplete(el);

      expect(el.textContent).toContain('datasource');
      cleanup(el);
    });
  });

  describe('datasource-select event', () => {
    it('dispatches datasource-select with correct slug on row click', async () => {
      const el = mount();
      await updateComplete(el);

      const received: string[] = [];
      el.addEventListener('datasource-select', (e) =>
        received.push((e as CustomEvent<{ slug: string }>).detail.slug),
      );

      const firstRow = el.querySelector<HTMLElement>('.collection-list-row');
      firstRow?.click();

      expect(received).toHaveLength(1);
      expect(typeof received[0]).toBe('string');
      expect(received[0].length).toBeGreaterThan(0);
      cleanup(el);
    });

    it('dispatches datasource-select on View button click', async () => {
      const el = mount();
      await updateComplete(el);

      const received: string[] = [];
      el.addEventListener('datasource-select', (e) =>
        received.push((e as CustomEvent<{ slug: string }>).detail.slug),
      );

      const viewBtn = el.querySelector<HTMLButtonElement>('button[aria-label="View"]');
      viewBtn?.click();

      expect(received).toHaveLength(1);
      cleanup(el);
    });
  });

  describe('datasource-delete event', () => {
    it('dispatches datasource-delete and removes entry after confirming delete', async () => {
      const ds = addDatasource({ name: 'to-delete', type: 'csv', url: 'https://x.com/d.csv' });
      createdSlugs.push(ds.slug);

      const el = mount();
      await updateComplete(el);

      const received: string[] = [];
      el.addEventListener('datasource-delete', (e) =>
        received.push((e as CustomEvent<{ slug: string }>).detail.slug),
      );

      // Mock confirm to return true
      const origConfirm = window.confirm;
      window.confirm = () => true;

      const deleteBtn = el.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
      deleteBtn?.click();

      window.confirm = origConfirm;

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(ds.slug);
      expect(getDatasourceBySlug(ds.slug)).toBeUndefined();
      cleanup(el);
    });

    it('does not delete when confirm is cancelled', async () => {
      const ds = addDatasource({ name: 'no-delete', type: 'csv', url: 'https://x.com/e.csv' });
      createdSlugs.push(ds.slug);

      const el = mount();
      await updateComplete(el);

      const origConfirm = window.confirm;
      window.confirm = () => false;

      const deleteBtn = el.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
      deleteBtn?.click();

      window.confirm = origConfirm;

      expect(getDatasourceBySlug(ds.slug)).toBeDefined();
      cleanup(el);
    });
  });

  describe('datasource-create event', () => {
    it('opens create dialog on New Datasource click', async () => {
      const el = mount();
      await updateComplete(el);

      const newBtn =
        el.querySelector<HTMLButtonElement>('button[aria-label="New Datasource"]') ??
        el.querySelector<HTMLButtonElement>('button');
      newBtn?.click();
      await updateComplete(el);

      const dialog = el.querySelector('dialog');
      expect(dialog).not.toBeNull();
      cleanup(el);
    });
  });
});
