import './index';

import { describe, expect, it, vi } from 'vitest';

import { UiCodeEditor } from './code-editor';
import { SQL } from './languages';

function mount(
  props: Partial<Pick<UiCodeEditor, 'value' | 'language' | 'readonly' | 'placeholder'>> = {},
): UiCodeEditor {
  const el = document.createElement('ui-code-editor') as UiCodeEditor;
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement): void {
  el.remove();
}

function getView(el: UiCodeEditor): import('@codemirror/view').EditorView {
  return (el as unknown as Record<string, unknown>)[
    '_view'
  ] as import('@codemirror/view').EditorView;
}

describe('UiCodeEditor', () => {
  describe('rendering', () => {
    it('renders a .cm-host div', async () => {
      const el = mount();
      await el.updateComplete;
      expect(el.querySelector('.cm-host')).not.toBeNull();
      cleanup(el);
    });

    it('mounts a .cm-editor element inside .cm-host on firstUpdated', async () => {
      const el = mount({ value: 'SELECT 1' });
      await el.updateComplete;
      expect(el.querySelector('.cm-host .cm-editor')).not.toBeNull();
      cleanup(el);
    });

    it('renders line numbers in the gutter', async () => {
      const el = mount({ value: 'line one\nline two' });
      await el.updateComplete;
      expect(el.querySelector('.cm-lineNumbers')).not.toBeNull();
      cleanup(el);
    });
  });

  describe('value property', () => {
    it('initialises the editor with the given value', async () => {
      const el = mount({ value: 'SELECT id FROM users' });
      await el.updateComplete;
      expect(getView(el).state.doc.toString()).toBe('SELECT id FROM users');
      cleanup(el);
    });

    it('updates editor content when value property changes from outside', async () => {
      const el = mount({ value: 'SELECT 1' });
      await el.updateComplete;
      el.value = 'SELECT 2';
      await el.updateComplete;
      expect(getView(el).state.doc.toString()).toBe('SELECT 2');
      cleanup(el);
    });

    it('does not update the editor when new value equals current content', async () => {
      const el = mount({ value: 'SELECT 1' });
      await el.updateComplete;
      const view = getView(el);
      const dispatchSpy = vi.spyOn(view, 'dispatch');
      el.value = 'SELECT 1';
      await el.updateComplete;
      expect(dispatchSpy).not.toHaveBeenCalled();
      cleanup(el);
    });

    it('does NOT fire value-change when value property is set externally', async () => {
      const el = mount({ value: '' });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('value-change', handler);
      el.value = 'SELECT 1';
      await el.updateComplete;
      expect(handler).not.toHaveBeenCalled();
      cleanup(el);
    });
  });

  describe('value-change event', () => {
    it('fires value-change with full doc content when a transaction is dispatched', async () => {
      const el = mount({ value: '' });
      await el.updateComplete;
      const handler = vi.fn();
      el.addEventListener('value-change', handler);
      const view = getView(el);
      view.dispatch({ changes: { from: 0, to: 0, insert: 'hello' } });
      expect(handler).toHaveBeenCalledOnce();
      expect((handler.mock.calls[0][0] as CustomEvent<string>).detail).toBe('hello');
      cleanup(el);
    });
  });

  describe('readonly property', () => {
    it('sets contenteditable=false on the editor content when readonly is true', async () => {
      const el = mount({ value: 'SELECT 1', readonly: true });
      await el.updateComplete;
      const content = el.querySelector<HTMLElement>('.cm-content');
      expect(content?.getAttribute('contenteditable')).toBe('false');
      cleanup(el);
    });

    it('sets contenteditable=true on the editor content when readonly is false', async () => {
      const el = mount({ value: 'SELECT 1', readonly: false });
      await el.updateComplete;
      const content = el.querySelector<HTMLElement>('.cm-content');
      expect(content?.getAttribute('contenteditable')).toBe('true');
      cleanup(el);
    });

    it('reconfigures editable compartment when readonly changes without recreating the view', async () => {
      const el = mount({ value: 'SELECT 1', readonly: false });
      await el.updateComplete;
      const viewBefore = getView(el);
      el.readonly = true;
      await el.updateComplete;
      expect(getView(el)).toBe(viewBefore);
      const content = el.querySelector<HTMLElement>('.cm-content');
      expect(content?.getAttribute('contenteditable')).toBe('false');
      cleanup(el);
    });
  });

  describe('language property', () => {
    it('reconfigures language compartment when language changes without recreating the view', async () => {
      const el = mount({ value: 'SELECT 1', language: SQL });
      await el.updateComplete;
      const viewBefore = getView(el);
      el.language = null;
      await el.updateComplete;
      expect(getView(el)).toBe(viewBefore);
      cleanup(el);
    });
  });

  describe('lifecycle', () => {
    it('destroys the EditorView on disconnectedCallback', async () => {
      const el = mount({ value: 'SELECT 1' });
      await el.updateComplete;
      const view = getView(el);
      const destroySpy = vi.spyOn(view, 'destroy');
      cleanup(el);
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('sets _view to undefined after disconnectedCallback', async () => {
      const el = mount({ value: 'SELECT 1' });
      await el.updateComplete;
      cleanup(el);
      expect((el as unknown as Record<string, unknown>)['_view']).toBeUndefined();
    });
  });
});
