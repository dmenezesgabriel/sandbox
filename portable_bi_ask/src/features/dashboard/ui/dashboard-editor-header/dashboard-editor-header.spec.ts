import './index';

import { describe, expect, it, vi } from 'vitest';

import { AppBreadcrumb } from '../../../../shared/ui/app-breadcrumb/app-breadcrumb';
import { DashboardEditorHeader } from './dashboard-editor-header';

function mount(
  props: Partial<{
    title: string;
    subtitle: string;
    mode: 'dashboard' | 'askData';
    editMode: boolean;
  }>,
): DashboardEditorHeader {
  const el = document.createElement('dashboard-editor-header') as DashboardEditorHeader;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('DashboardEditorHeader', () => {
  describe('rendering', () => {
    it('renders the title', async () => {
      const el = mount({ title: 'Sales Overview' });
      await el.updateComplete;
      expect(el.querySelector('.editor-header-title')?.textContent?.trim()).toBe('Sales Overview');
      cleanup(el);
    });

    it('renders subtitle when provided', async () => {
      const el = mount({ subtitle: 'Q1 report' });
      await el.updateComplete;
      expect(el.querySelector('.editor-header-subtitle')?.textContent?.trim()).toBe('Q1 report');
      cleanup(el);
    });

    it('omits subtitle element when empty', async () => {
      const el = mount({ subtitle: '' });
      await el.updateComplete;
      expect(el.querySelector('.editor-header-subtitle')).toBeNull();
      cleanup(el);
    });

    it('applies active class to the Editor button when mode is dashboard', async () => {
      const el = mount({ mode: 'dashboard' });
      await el.updateComplete;
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      expect(btns[0].classList.contains('editor-mode-btn-active')).toBe(true);
      expect(btns[1].classList.contains('editor-mode-btn-active')).toBe(false);
      cleanup(el);
    });

    it('applies active class to the Ask Data button when mode is askData', async () => {
      const el = mount({ mode: 'askData' });
      await el.updateComplete;
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      expect(btns[0].classList.contains('editor-mode-btn-active')).toBe(false);
      expect(btns[1].classList.contains('editor-mode-btn-active')).toBe(true);
      cleanup(el);
    });

    it('shows "Edit" when editMode is false', async () => {
      const el = mount({ editMode: false });
      await el.updateComplete;
      expect(el.querySelector('.editor-edit-btn')?.textContent?.trim()).toBe('Edit');
      expect(el.querySelector('.editor-edit-btn')?.classList.contains('active')).toBe(false);
      cleanup(el);
    });

    it('shows "Done Editing" and active class when editMode is true', async () => {
      const el = mount({ editMode: true });
      await el.updateComplete;
      expect(el.querySelector('.editor-edit-btn')?.textContent?.trim()).toBe('Done Editing');
      expect(el.querySelector('.editor-edit-btn')?.classList.contains('active')).toBe(true);
      cleanup(el);
    });
  });

  describe('breadcrumb', () => {
    it('renders <app-breadcrumb> element', async () => {
      const el = mount({ title: 'Sales Overview' });
      await el.updateComplete;
      expect(el.querySelector('app-breadcrumb')).not.toBeNull();
      cleanup(el);
    });

    it('first breadcrumb item has label "Dashboards" and href "#/"', async () => {
      const el = mount({ title: 'Sales Overview' });
      await el.updateComplete;
      const bc = el.querySelector('app-breadcrumb') as AppBreadcrumb;
      expect(bc.items[0].label).toBe('Dashboards');
      expect(bc.items[0].href).toBe('#/');
      cleanup(el);
    });

    it('last breadcrumb item label matches the title prop', async () => {
      const el = mount({ title: 'Sales Overview' });
      await el.updateComplete;
      const bc = el.querySelector('app-breadcrumb') as AppBreadcrumb;
      expect(bc.items[bc.items.length - 1].label).toBe('Sales Overview');
      cleanup(el);
    });

    it('last breadcrumb item label is "Untitled Dashboard" when title is empty string', async () => {
      const el = mount({ title: '' });
      await el.updateComplete;
      const bc = el.querySelector('app-breadcrumb') as AppBreadcrumb;
      expect(bc.items[bc.items.length - 1].label).toBe('Untitled Dashboard');
      cleanup(el);
    });
  });

  describe('events', () => {
    it('fires mode-change with "askData" when Ask Data clicked', async () => {
      const el = mount({ mode: 'dashboard' });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('mode-change', handler);
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      btns[1].click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe('askData');
      cleanup(el);
    });

    it('fires mode-change with "dashboard" when Editor clicked', async () => {
      const el = mount({ mode: 'askData' });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('mode-change', handler);
      const btns = el.querySelectorAll<HTMLButtonElement>('.editor-mode-btn');
      btns[0].click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe('dashboard');
      cleanup(el);
    });

    it('fires edit-mode-toggle with {editMode: true} when Edit clicked (editMode=false)', async () => {
      const el = mount({ editMode: false });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('edit-mode-toggle', handler);
      el.querySelector<HTMLButtonElement>('.editor-edit-btn')!.click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ editMode: true });
      cleanup(el);
    });

    it('fires edit-mode-toggle with {editMode: false} when Done Editing clicked (editMode=true)', async () => {
      const el = mount({ editMode: true });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('edit-mode-toggle', handler);
      el.querySelector<HTMLButtonElement>('.editor-edit-btn')!.click();
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ editMode: false });
      cleanup(el);
    });
  });
});
