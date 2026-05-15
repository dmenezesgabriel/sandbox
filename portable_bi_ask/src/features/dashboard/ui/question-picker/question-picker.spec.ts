import './index';

import { describe, expect, it, vi } from 'vitest';

import { QuestionPicker } from './question-picker';

function mount(props: Partial<{ open: boolean }> = {}): QuestionPicker {
  const el = document.createElement('question-picker') as QuestionPicker;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('QuestionPicker', () => {
  describe('updated() — showModal()', () => {
    it('calls showModal() synchronously when open transitions to true', async () => {
      const el = mount({ open: false });
      await el.updateComplete;

      const dialog = el.querySelector<HTMLDialogElement>('dialog.qpicker-modal')!;
      const showModal = vi.spyOn(dialog, 'showModal').mockImplementation(() => {});

      el.open = true;
      await el.updateComplete;

      expect(showModal).toHaveBeenCalledOnce();
      cleanup(el);
    });

    it('calls close() when open transitions to false', async () => {
      const el = mount({ open: false });
      await el.updateComplete;

      const dialog = el.querySelector<HTMLDialogElement>('dialog.qpicker-modal')!;
      const closeSpy = vi.spyOn(dialog, 'close').mockImplementation(() => {});
      vi.spyOn(dialog, 'showModal').mockImplementation(() => {});

      el.open = true;
      await el.updateComplete;

      el.open = false;
      await el.updateComplete;

      expect(closeSpy).toHaveBeenCalledOnce();
      cleanup(el);
    });
  });

  describe('_close()', () => {
    it('does NOT emit picker-close when close button is clicked', async () => {
      const el = mount({ open: false });
      await el.updateComplete;

      const dialog = el.querySelector<HTMLDialogElement>('dialog.qpicker-modal')!;
      vi.spyOn(dialog, 'showModal').mockImplementation(() => {});
      vi.spyOn(dialog, 'close').mockImplementation(() => {});

      el.open = true;
      await el.updateComplete;

      const handler = vi.fn();
      el.addEventListener('picker-close', handler);

      const closeBtn = el.querySelector<HTMLButtonElement>('.qpicker-close')!;
      closeBtn.click();

      expect(handler).not.toHaveBeenCalled();
      cleanup(el);
    });
  });

  describe('_onNativeClose()', () => {
    it('emits picker-close when the native close event fires on the dialog', async () => {
      const el = mount({ open: false });
      await el.updateComplete;

      const dialog = el.querySelector<HTMLDialogElement>('dialog.qpicker-modal')!;
      vi.spyOn(dialog, 'showModal').mockImplementation(() => {});

      el.open = true;
      await el.updateComplete;

      const handler = vi.fn();
      el.addEventListener('picker-close', handler);

      dialog.dispatchEvent(new Event('close'));

      expect(handler).toHaveBeenCalledOnce();
      cleanup(el);
    });
  });

  describe('rendering', () => {
    it('renders the dialog with the qpicker-modal class', async () => {
      const el = mount({ open: false });
      await el.updateComplete;

      expect(el.querySelector('dialog.qpicker-modal')).not.toBeNull();
      cleanup(el);
    });

    it('renders the title "Add from library"', async () => {
      const el = mount({ open: false });
      await el.updateComplete;

      expect(el.querySelector('.qpicker-title')?.textContent?.trim()).toBe('Add from library');
      cleanup(el);
    });
  });
});
