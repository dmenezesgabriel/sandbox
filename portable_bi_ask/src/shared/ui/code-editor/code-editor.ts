import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { html, LitElement, type TemplateResult } from 'lit';

const _theme = EditorView.theme({
  '&': {
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-bg)',
    fontSize: 'var(--text-xs, 0.75rem)',
    fontFamily: 'var(--font-mono, monospace)',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent)',
    padding: '4px 0',
    minHeight: '80px',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent, #6366f1) 6%, transparent)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent, #6366f1) 8%, transparent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent, #6366f1) 20%, transparent)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-accent)',
  },
  '.cm-placeholder': {
    color: 'var(--color-text-secondary)',
  },
});

const _baseExtensions: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  drawSelection(),
  foldGutter(),
  indentOnInput(),
  history(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...closeBracketsKeymap,
    ...completionKeymap,
  ]),
  _theme,
];

export class UiCodeEditor extends LitElement {
  static override readonly properties = {
    value: { type: String },
    language: { attribute: false },
    readonly: { type: Boolean },
    placeholder: { type: String },
  };

  value = '';
  language: Extension | null = null;
  readonly = false;
  placeholder = '';

  private _view: EditorView | undefined;
  private _langCompartment = new Compartment();
  private _editableCompartment = new Compartment();
  private _placeholderCompartment = new Compartment();
  private _suppressChangeEvent = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    return html`<div class="cm-host"></div>`;
  }

  override firstUpdated(): void {
    const host = this.querySelector<HTMLElement>('.cm-host')!;
    this._view = new EditorView({
      doc: this.value,
      extensions: [
        ..._baseExtensions,
        this._langCompartment.of(this.language ?? []),
        this._editableCompartment.of(EditorView.editable.of(!this.readonly)),
        this._placeholderCompartment.of(this.placeholder ? cmPlaceholder(this.placeholder) : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this._suppressChangeEvent) {
            this.dispatchEvent(
              new CustomEvent<string>('value-change', {
                detail: update.state.doc.toString(),
                bubbles: true,
                composed: true,
              }),
            );
          }
        }),
      ],
      parent: host,
    });
  }

  override updated(changed: Map<string, unknown>): void {
    if (!this._view) return;

    if (changed.has('value')) {
      const current = this._view.state.doc.toString();
      if (current !== this.value) {
        this._suppressChangeEvent = true;
        this._view.dispatch({
          changes: { from: 0, to: this._view.state.doc.length, insert: this.value },
        });
        this._suppressChangeEvent = false;
      }
    }

    if (changed.has('language')) {
      this._view.dispatch({
        effects: this._langCompartment.reconfigure(this.language ?? []),
      });
    }

    if (changed.has('readonly')) {
      this._view.dispatch({
        effects: this._editableCompartment.reconfigure(EditorView.editable.of(!this.readonly)),
      });
    }

    if (changed.has('placeholder')) {
      this._view.dispatch({
        effects: this._placeholderCompartment.reconfigure(
          this.placeholder ? cmPlaceholder(this.placeholder) : [],
        ),
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._view?.destroy();
    this._view = undefined;
  }
}

if (!customElements.get('ui-code-editor')) {
  customElements.define('ui-code-editor', UiCodeEditor);
}
