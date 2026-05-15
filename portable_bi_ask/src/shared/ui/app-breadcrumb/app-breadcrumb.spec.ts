import './index';

import { describe, expect, it } from 'vitest';

import { AppBreadcrumb } from './app-breadcrumb';

function mount(props: Partial<{ items: AppBreadcrumb['items'] }>): AppBreadcrumb {
  const el = document.createElement('app-breadcrumb') as AppBreadcrumb;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('AppBreadcrumb', () => {
  describe('rendering', () => {
    it('renders the correct number of <li> elements for 2 items', async () => {
      const el = mount({
        items: [{ label: 'Home', href: '#/' }, { label: 'Dashboard' }],
      });
      await el.updateComplete;
      expect(el.querySelectorAll('li.breadcrumb-item').length).toBe(2);
      cleanup(el);
    });

    it('renders the correct number of <li> elements for 3 items', async () => {
      const el = mount({
        items: [
          { label: 'Home', href: '#/' },
          { label: 'Dashboards', href: '#/dashboard' },
          { label: 'Sales' },
        ],
      });
      await el.updateComplete;
      expect(el.querySelectorAll('li.breadcrumb-item').length).toBe(3);
      cleanup(el);
    });

    it('renders all items except the last as <a class="breadcrumb-link"> with correct href', async () => {
      const el = mount({
        items: [
          { label: 'Home', href: '#/' },
          { label: 'Dashboards', href: '#/dashboard' },
          { label: 'Sales' },
        ],
      });
      await el.updateComplete;
      const links = el.querySelectorAll<HTMLAnchorElement>('a.breadcrumb-link');
      expect(links.length).toBe(2);
      expect(links[0].getAttribute('href')).toBe('#/');
      expect(links[1].getAttribute('href')).toBe('#/dashboard');
      cleanup(el);
    });

    it('renders the last item as <span class="breadcrumb-current"> with aria-current="page" and no <a>', async () => {
      const el = mount({
        items: [{ label: 'Home', href: '#/' }, { label: 'Sales' }],
      });
      await el.updateComplete;
      const items = el.querySelectorAll('li.breadcrumb-item');
      const lastItem = items[items.length - 1];
      const current = lastItem.querySelector('span.breadcrumb-current');
      expect(current).not.toBeNull();
      expect(current?.getAttribute('aria-current')).toBe('page');
      expect(lastItem.querySelector('a')).toBeNull();
      cleanup(el);
    });

    it('<nav> has aria-label="Breadcrumb"', async () => {
      const el = mount({ items: [{ label: 'Home', href: '#/' }] });
      await el.updateComplete;
      const nav = el.querySelector('nav.breadcrumb-nav');
      expect(nav).not.toBeNull();
      expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');
      cleanup(el);
    });

    it('renders no children in <ol> when items is empty', async () => {
      const el = mount({ items: [] });
      await el.updateComplete;
      const ol = el.querySelector('ol.breadcrumb-list');
      expect(ol).not.toBeNull();
      expect(ol?.children.length).toBe(0);
      cleanup(el);
    });

    it('renders a single item as <span class="breadcrumb-current" aria-current="page">', async () => {
      const el = mount({ items: [{ label: 'Only Page' }] });
      await el.updateComplete;
      const current = el.querySelector('span.breadcrumb-current');
      expect(current).not.toBeNull();
      expect(current?.getAttribute('aria-current')).toBe('page');
      expect(current?.textContent?.trim()).toBe('Only Page');
      cleanup(el);
    });

    it('renders a non-last item with no href as <span class="breadcrumb-item-text">, not an <a>', async () => {
      const el = mount({
        items: [{ label: 'Section' }, { label: 'Current Page' }],
      });
      await el.updateComplete;
      const items = el.querySelectorAll('li.breadcrumb-item');
      const firstItem = items[0];
      const text = firstItem.querySelector('span.breadcrumb-item-text');
      expect(text).not.toBeNull();
      expect(text?.textContent?.trim()).toBe('Section');
      expect(firstItem.querySelector('a')).toBeNull();
      cleanup(el);
    });
  });
});
