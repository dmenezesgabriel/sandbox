import './index';

import { describe, expect, it, vi } from 'vitest';

import { DashboardWorkspace } from './dashboard-workspace';

function mount(): DashboardWorkspace {
  const el = document.createElement('dashboard-workspace') as DashboardWorkspace;
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('DashboardWorkspace — overflow menu alignment', () => {
  it('sets _overflowMenuAlign to "left" when there is enough room to the right', async () => {
    const el = mount();
    await el.updateComplete;

    const btn = el.querySelector<HTMLButtonElement>('.toolbar-overflow-btn')!;

    // Simulate button positioned far from the right edge
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      right: 100,
      left: 80,
      top: 0,
      bottom: 40,
      width: 20,
      height: 40,
      x: 80,
      y: 0,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

    btn.click();
    await el.updateComplete;

    const menu = el.querySelector<HTMLDivElement>('.toolbar-overflow-menu');
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute('style')).toContain('left: 0');

    cleanup(el);
  });

  it('sets _overflowMenuAlign to "right" when there is not enough room to the right', async () => {
    const el = mount();
    await el.updateComplete;

    const btn = el.querySelector<HTMLButtonElement>('.toolbar-overflow-btn')!;

    // Simulate button positioned close to the right edge: rect.right + 160 > window.innerWidth
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      right: 1100,
      left: 1080,
      top: 0,
      bottom: 40,
      width: 20,
      height: 40,
      x: 1080,
      y: 0,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

    btn.click();
    await el.updateComplete;

    const menu = el.querySelector<HTMLDivElement>('.toolbar-overflow-menu');
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute('style')).toContain('right: 0');

    cleanup(el);
  });

  it('does not recompute alignment when closing the menu (toggle off)', async () => {
    const el = mount();
    await el.updateComplete;

    const btn = el.querySelector<HTMLButtonElement>('.toolbar-overflow-btn')!;

    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      right: 100,
      left: 80,
      top: 0,
      bottom: 40,
      width: 20,
      height: 40,
      x: 80,
      y: 0,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

    // Open menu
    btn.click();
    await el.updateComplete;

    // Close menu by clicking again
    btn.click();
    await el.updateComplete;

    expect(el.querySelector('.toolbar-overflow-menu')).toBeNull();
    cleanup(el);
  });
});
