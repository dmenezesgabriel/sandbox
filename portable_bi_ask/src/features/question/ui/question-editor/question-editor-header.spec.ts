import './index';

import { describe, expect, it, vi } from 'vitest';

import { AppBreadcrumb } from '../../../../shared/ui/app-breadcrumb/app-breadcrumb';
import { QuestionEditorHeader } from './question-editor-header';

function mount(
  props: Partial<{
    title: string;
    isNew: boolean;
    isDirty: boolean;
    isYaml: boolean;
  }>,
): QuestionEditorHeader {
  const el = document.createElement('question-editor-header') as QuestionEditorHeader;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

describe('QuestionEditorHeader', () => {
  describe('breadcrumb', () => {
    it('renders <app-breadcrumb> (not .qeh-back-btn)', async () => {
      const el = mount({ title: 'My Question' });
      await el.updateComplete;
      expect(el.querySelector('app-breadcrumb')).not.toBeNull();
      expect(el.querySelector('.qeh-back-btn')).toBeNull();
      cleanup(el);
    });

    it('breadcrumb is rendered above .qeh-left, not inside it', async () => {
      const el = mount({ title: 'My Question' });
      await el.updateComplete;
      expect(el.querySelector('.qeh-left app-breadcrumb')).toBeNull();
      expect(el.querySelector('.qeh-header > app-breadcrumb')).not.toBeNull();
      cleanup(el);
    });

    it('first breadcrumb item has label "Questions" and href "#/questions"', async () => {
      const el = mount({ title: 'My Question' });
      await el.updateComplete;
      const bc = el.querySelector('app-breadcrumb') as AppBreadcrumb;
      expect(bc.items[0].label).toBe('Questions');
      expect(bc.items[0].href).toBe('#/questions');
      cleanup(el);
    });

    it('last breadcrumb item label matches title prop', async () => {
      const el = mount({ title: 'My Question' });
      await el.updateComplete;
      const bc = el.querySelector('app-breadcrumb') as AppBreadcrumb;
      expect(bc.items[bc.items.length - 1].label).toBe('My Question');
      cleanup(el);
    });

    it('last breadcrumb item label is "Untitled Question" when title is empty', async () => {
      const el = mount({ title: '' });
      await el.updateComplete;
      const bc = el.querySelector('app-breadcrumb') as AppBreadcrumb;
      expect(bc.items[bc.items.length - 1].label).toBe('Untitled Question');
      cleanup(el);
    });
  });

  describe('rendering', () => {
    it('.qeh-back-btn is not present', async () => {
      const el = mount({ title: 'My Question' });
      await el.updateComplete;
      expect(el.querySelector('.qeh-back-btn')).toBeNull();
      cleanup(el);
    });

    it('dirty dot renders when isDirty=true', async () => {
      const el = mount({ isDirty: true });
      await el.updateComplete;
      expect(el.querySelector('.qeh-dirty-dot')).not.toBeNull();
      cleanup(el);
    });

    it('dirty dot is absent when isDirty=false', async () => {
      const el = mount({ isDirty: false });
      await el.updateComplete;
      expect(el.querySelector('.qeh-dirty-dot')).toBeNull();
      cleanup(el);
    });

    it('read-only badge is not rendered', async () => {
      const el = mount({ isYaml: true });
      await el.updateComplete;
      expect(el.querySelector('.qeh-badge')).toBeNull();
      cleanup(el);
    });

    it('save button label is "Create" when isNew=true', async () => {
      const el = mount({ isNew: true });
      await el.updateComplete;
      expect(el.querySelector('.qeh-save-btn')?.textContent?.trim()).toBe('Create');
      cleanup(el);
    });

    it('save button label is "Save" when isNew=false', async () => {
      const el = mount({ isNew: false });
      await el.updateComplete;
      expect(el.querySelector('.qeh-save-btn')?.textContent?.trim()).toBe('Save');
      cleanup(el);
    });

    it('delete button is absent when isNew=true', async () => {
      const el = mount({ isNew: true });
      await el.updateComplete;
      expect(el.querySelector('.qeh-delete-btn')).toBeNull();
      cleanup(el);
    });
  });

  describe('events', () => {
    it('question-save event fires when save button clicked', async () => {
      const el = mount({ isNew: false });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('question-save', handler);
      el.querySelector<HTMLButtonElement>('.qeh-save-btn')!.click();
      expect(handler).toHaveBeenCalledOnce();
      cleanup(el);
    });

    it('question-delete event fires when delete button clicked (isNew=false, isYaml=false)', async () => {
      const el = mount({ isNew: false, isYaml: false });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('question-delete', handler);
      el.querySelector<HTMLButtonElement>('.qeh-delete-btn')!.click();
      expect(handler).toHaveBeenCalledOnce();
      cleanup(el);
    });
  });
});
